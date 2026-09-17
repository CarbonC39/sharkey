/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { type Config, FulltextSearchProvider } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { MiNote } from '@/models/Note.js';
import type { NotesRepository } from '@/models/_.js';
import { MiUser } from '@/models/_.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { isUserRelated } from '@/misc/is-user-related.js';
import { CacheService } from '@/core/CacheService.js';
import { QueryService } from '@/core/QueryService.js';
import { IdService } from '@/core/IdService.js';
import { LoggerService } from '@/core/LoggerService.js';
import type { Index, MeiliSearch } from 'meilisearch';

type K = string;
type V = string | number | boolean;
type Q =
	{ op: '=', k: K, v: V } |
	{ op: '!=', k: K, v: V } |
	{ op: '>', k: K, v: number } |
	{ op: '<', k: K, v: number } |
	{ op: '>=', k: K, v: number } |
	{ op: '<=', k: K, v: number } |
	{ op: 'is null', k: K } |
	{ op: 'is not null', k: K } |
	{ op: 'and', qs: Q[] } |
	{ op: 'or', qs: Q[] } |
	{ op: 'not', q: Q };

// Sync with consts.ts and const.ts
const fileTypes = {
	image: [
		'image/webp',
		'image/png',
		'image/jpeg',
		'image/avif',
		'image/apng',
		'image/gif',
		'image/bmp',
		'image/tiff',
		'image/x-icon',
	],
	video: [
		'video/mp4',
		'video/webm',
		'video/mpeg',
		'video/x-m4v',
		'video/ogg',
		'video/quicktime',
		'video/3gpp',
		'video/3gpp2',
		'video/x-matroska',
	],
	audio: [
		'audio/mpeg',
		'audio/flac',
		'audio/wav',
		'audio/aac',
		'audio/webm',
		'audio/opus',
		'audio/ogg',
		'audio/x-m4a',
		'audio/mp4',
		'audio/x-flac',
		'audio/vnd.wave',
		'audio/mod',
		'audio/s3m',
		'audio/xm',
		'audio/it',
		'audio/x-mod',
		'audio/x-s3m',
		'audio/x-xm',
		'audio/x-it',
	],
	// Keep in sync with frontend-shared/js/const.ts
	module: [
		'audio/mod',
		'audio/x-mod',
		'audio/s3m',
		'audio/x-s3m',
		'audio/xm',
		'audio/x-xm',
		'audio/it',
		'audio/x-it',
	],
	flash: [
		'application/x-shockwave-flash',
		'application/vnd.adobe.flash.movie',
	],
};

// Make sure to regenerate misskey-js and check search.note.vue after changing these
export const fileTypeCategories = ['image', 'video', 'audio', 'module', 'flash', null] as const;
export type FileTypeCategory = typeof fileTypeCategories[number];

export type SearchOpts = {
	userId?: MiNote['userId'] | null;
	channelId?: MiNote['channelId'] | null;
	host?: string | null;
	filetype?: FileTypeCategory;
	order?: 'asc' | 'desc' | 'relevance' | null;
	disableMeili?: boolean | null;
};

export type SearchPagination = {
	untilId?: MiNote['id'];
	sinceId?: MiNote['id'];
	limit: number;
	offset?: number;
};

function compileValue(value: V): string {
	if (typeof value === 'string') {
		return `'${value}'`; // TODO: escape
	} else if (typeof value === 'number') {
		return value.toString();
	} else if (typeof value === 'boolean') {
		return value.toString();
	}
	throw new Error('unrecognized value');
}

function compileQuery(q: Q): string {
	switch (q.op) {
		case '=': return `(${q.k} = ${compileValue(q.v)})`;
		case '!=': return `(${q.k} != ${compileValue(q.v)})`;
		case '>': return `(${q.k} > ${compileValue(q.v)})`;
		case '<': return `(${q.k} < ${compileValue(q.v)})`;
		case '>=': return `(${q.k} >= ${compileValue(q.v)})`;
		case '<=': return `(${q.k} <= ${compileValue(q.v)})`;
		case 'and': return q.qs.length === 0 ? '' : `(${ q.qs.map(_q => compileQuery(_q)).join(' AND ') })`;
		case 'or': return q.qs.length === 0 ? '' : `(${ q.qs.map(_q => compileQuery(_q)).join(' OR ') })`;
		case 'is null': return `(${q.k} IS NULL)`;
		case 'is not null': return `(${q.k} IS NOT NULL)`;
		case 'not': return `(NOT ${compileQuery(q.q)})`;
		default: throw new Error('unrecognized query operator');
	}
}

@Injectable()
export class SearchService {
	private readonly meilisearchIndexScope: 'local' | 'global' | string[] = 'local';
	private readonly meilisearchNoteIndex: Index | null = null;
	private readonly provider: FulltextSearchProvider;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meilisearch)
		private meilisearch: MeiliSearch | null,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private cacheService: CacheService,
		private queryService: QueryService,
		private idService: IdService,
		private loggerService: LoggerService,
	) {
		if (meilisearch) {
			this.meilisearchNoteIndex = meilisearch.index(`${this.config.meilisearch?.index}---notes`);
			this.meilisearchNoteIndex.updateSettings({
				searchableAttributes: [
					'text',
					'cw',
				],
				sortableAttributes: [
					'createdAt',
				],
				filterableAttributes: [
					'createdAt',
					'userId',
					'userHost',
					'channelId',
					'tags',
					'attachedFileTypes',
				],
				typoTolerance: {
					enabled: false,
				},
				pagination: {
					maxTotalHits: 10000,
				},
			});
		}

		if (this.config.meilisearch?.scope) {
			this.meilisearchIndexScope = this.config.meilisearch.scope;
		}

		this.provider = config.fulltextSearch?.provider ?? 'sqlLike';
		this.loggerService.getLogger('SearchService').info(`-- Provider: ${this.provider}`);
	}

	@bindThis
	public async indexNote(note: MiNote): Promise<void> {
		if (!this.meilisearch) return;
		if (note.text == null && note.cw == null) return;
		if (!['home', 'public'].includes(note.visibility)) return;

		switch (this.meilisearchIndexScope) {
			case 'global':
				break;

			case 'local':
				if (note.userHost == null) break;
				return;

			default: {
				if (note.userHost == null) break;
				if (this.meilisearchIndexScope.includes(note.userHost)) break;
				return;
			}
		}

		await this.meilisearchNoteIndex?.addDocuments([{
			id: note.id,
			createdAt: this.idService.parse(note.id).date.getTime(),
			userId: note.userId,
			userHost: note.userHost,
			channelId: note.channelId,
			cw: note.cw,
			text: note.text,
			tags: note.tags,
			attachedFileTypes: note.attachedFileTypes,
		}], {
			primaryKey: 'id',
		});
	}

	@bindThis
	public async unindexNote(note: MiNote): Promise<void> {
		if (!this.meilisearch) return;
		if (!['home', 'public'].includes(note.visibility)) return;

		await this.meilisearchNoteIndex?.deleteDocument(note.id);
	}

	@bindThis
	public async searchNote(
		q: string,
		me: MiUser | null,
		opts: SearchOpts,
		pagination: SearchPagination,
	): Promise<MiNote[]> {
		switch (this.provider) {
			case 'sqlLike':
			case 'sqlPgroonga':
			case 'sqlTsvector': {
				// ほとんど内容に差がないのでsqlLikeとsqlPgroongaを同じ処理にしている.
				// 今後の拡張で差が出る用であれば関数を分ける.
				return await this.searchNoteByLike(q, me, opts, pagination);
			}
			case 'meilisearch': {
				return await this.searchNoteByMeiliSearch(q, me, opts, pagination);
			}
			default: {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const typeCheck: never = this.provider;
				return [];
			}
		}
	}

	@bindThis
	private async searchNoteByLike(
		q: string,
		me: MiUser | null,
		opts: SearchOpts,
		pagination: SearchPagination,
	): Promise<MiNote[]> {
		const relevanceOrder = opts.order === 'relevance';
		const query = relevanceOrder
			? this.notesRepository.createQueryBuilder('note')
			: this.queryService.makePaginationQuery(this.notesRepository.createQueryBuilder('note'), pagination.sinceId, pagination.untilId);

		if (opts.userId) {
			query.andWhere('note.userId = :userId', { userId: opts.userId });
		} else if (opts.channelId) {
			query.andWhere('note.channelId = :channelId', { channelId: opts.channelId });
		}

		query
			.innerJoinAndSelect('note.user', 'user')
			.leftJoinAndSelect('note.reply', 'reply')
			.leftJoinAndSelect('note.renote', 'renote')
			.leftJoinAndSelect('reply.user', 'replyUser')
			.leftJoinAndSelect('renote.user', 'renoteUser');

		if (this.config.fulltextSearch?.provider === 'sqlPgroonga') {
			query.andWhere('note.text &@~ :q', { q });
		} else if (this.config.fulltextSearch?.provider === 'sqlTsvector') {
			query.andWhere('note.tsvector_embedding @@ websearch_to_tsquery(:q)', { q });
		} else {
			query.andWhere('note.text ILIKE :q', { q: `%${ sqlLikeEscape(q) }%` });
		}

		if (opts.host) {
			if (opts.host === '.') {
				query.andWhere('note.userHost IS NULL');
			} else {
				query.andWhere('note.userHost = :host', { host: opts.host });
			}
		}

		if (opts.filetype) {
			query.andWhere('note."attachedFileTypes" && :types', { types: fileTypes[opts.filetype] });
		}

		this.queryService.generateVisibilityQuery(query, me);
		this.queryService.generateBlockedHostQueryForNote(query);
		this.queryService.generateSuspendedUserQueryForNote(query);
		this.queryService.generateSilencedUserQueryForNotes(query, me);
		if (me) this.queryService.generateMutedUserQueryForNotes(query, me);
		if (me) this.queryService.generateBlockedUserQueryForNotes(query, me);

		if (relevanceOrder) {
			if (this.config.fulltextSearch?.provider === 'sqlTsvector') {
				query
					.addSelect('ts_rank_cd(note.tsvector_embedding, websearch_to_tsquery(:q))', 'search_relevance')
					.orderBy('search_relevance', 'DESC')
					.addOrderBy('note.id', 'DESC');
			} else if (this.config.fulltextSearch?.provider === 'sqlPgroonga') {
				query
					.addSelect('pgroonga_score(note.tableoid, note.ctid)', 'search_relevance')
					.orderBy('search_relevance', 'DESC')
					.addOrderBy('note.id', 'DESC');
			} else {
				// LIKE has no provider score. Prefer an exact match, then a prefix
				// match and finally the shortest match as a deterministic fallback.
				query
					.addSelect(`CASE
						WHEN LOWER(COALESCE(note.text, '')) = :relevanceExact THEN 0
						WHEN LOWER(COALESCE(note.text, '')) LIKE :relevancePrefix THEN 1
						ELSE 2
					END`, 'search_relevance')
					.addSelect('CHAR_LENGTH(COALESCE(note.text, \'\'))', 'search_match_length')
					.setParameters({
						relevanceExact: q.toLocaleLowerCase(),
						relevancePrefix: `${sqlLikeEscape(q.toLocaleLowerCase())}%`,
					})
					.orderBy('search_relevance', 'ASC')
					.addOrderBy('search_match_length', 'ASC')
					.addOrderBy('note.id', 'DESC');
			}
		} else if (opts.order === 'asc') {
			query.orderBy('note.id', 'ASC');
		}

		return await query
			.offset(relevanceOrder ? pagination.offset ?? 0 : undefined)
			.limit(pagination.limit)
			.getMany();
	}

	@bindThis
	private async searchNoteByMeiliSearch(
		q: string,
		me: MiUser | null,
		opts: SearchOpts,
		pagination: SearchPagination,
	): Promise<MiNote[]> {
		if (!this.meilisearch || !this.meilisearchNoteIndex) {
			throw new Error('MeiliSearch is not available');
		}

		const filter: Q = {
			op: 'and',
			qs: [],
		};
		if (pagination.untilId) filter.qs.push({
			op: '<',
			k: 'createdAt',
			v: this.idService.parse(pagination.untilId).date.getTime(),
		});
		if (pagination.sinceId) filter.qs.push({
			op: '>',
			k: 'createdAt',
			v: this.idService.parse(pagination.sinceId).date.getTime(),
		});
		if (opts.userId) filter.qs.push({ op: '=', k: 'userId', v: opts.userId });
		if (opts.channelId) filter.qs.push({ op: '=', k: 'channelId', v: opts.channelId });
		if (opts.host) {
			if (opts.host === '.') {
				filter.qs.push({ op: 'is null', k: 'userHost' });
			} else {
				filter.qs.push({ op: '=', k: 'userHost', v: opts.host });
			}
		}

		if (opts.filetype) {
			const filters = fileTypes[opts.filetype].map(mime => ({ op: '=' as const, k: 'attachedFileTypes', v: mime }));
			filter.qs.push({ op: 'or', qs: filters });
		}

		const relevanceOrder = opts.order === 'relevance';
		const visibleOffset = relevanceOrder ? pagination.offset ?? 0 : 0;
		const batchSize = Math.min(100, Math.max(30, pagination.limit * 2));
		const notes: MiNote[] = [];
		let skippedVisibleNotes = 0;
		let searchOffset = 0;

		// Meilisearch cannot apply all of Sharkey's visibility, block, mute and
		// suspension rules. Scan candidates in provider order and calculate the
		// public offset only after those database-side filters have run. Otherwise
		// a filtered hit would make offset pagination duplicate or skip notes.
		while (notes.length < pagination.limit && searchOffset < 10000) {
			const res = await this.meilisearchNoteIndex.search(q, {
				...(relevanceOrder ? {} : { sort: [`createdAt:${opts.order ?? 'desc'}`] }),
				matchingStrategy: 'all',
				attributesToRetrieve: ['id', 'createdAt'],
				filter: compileQuery(filter),
				limit: Math.min(batchSize, 10000 - searchOffset),
				offset: searchOffset,
			});
			if (res.hits.length === 0) break;
			searchOffset += res.hits.length;

			const query = this.notesRepository.createQueryBuilder('note')
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser')
				.where('note.id IN (:...noteIds)', { noteIds: res.hits.map(x => x.id) });

			this.queryService.generateBlockedHostQueryForNote(query);
			this.queryService.generateSuspendedUserQueryForNote(query);
			this.queryService.generateSilencedUserQueryForNotes(query, me);

			if (me) {
				this.queryService.generateBlockedUserQueryForNotes(query, me);
				this.queryService.generateMutedUserQueryForNotes(query, me);
			}

			const resultOrder = new Map(res.hits.map((hit, index) => [hit.id, index]));
			const visibleNotes = (await query.getMany())
				.sort((a, b) => (resultOrder.get(a.id) ?? 0) - (resultOrder.get(b.id) ?? 0));

			for (const note of visibleNotes) {
				if (skippedVisibleNotes < visibleOffset) {
					skippedVisibleNotes++;
					continue;
				}
				notes.push(note);
				if (notes.length === pagination.limit) break;
			}

			if (res.hits.length < batchSize) break;
		}

		return notes;
	}
}
