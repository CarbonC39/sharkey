/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, jest, test } from '@jest/globals';
import { SearchService } from '@/core/SearchService.js';
import type { CacheService } from '@/core/CacheService.js';
import type { IdService } from '@/core/IdService.js';
import type { LoggerService } from '@/core/LoggerService.js';
import type { QueryService } from '@/core/QueryService.js';
import type { Config } from '@/config.js';
import type { MiNote, NotesRepository } from '@/models/_.js';
import type { MeiliSearch } from 'meilisearch';

type SearchOptions = {
	offset?: number;
	limit?: number;
	sort?: string[];
};

function note(id: string): MiNote {
	return { id } as MiNote;
}

function createService(rawHitIds: string[], visibleIds: string[]) {
	const visibleIdSet = new Set(visibleIds);
	const search = jest.fn(async (_query: string, options: SearchOptions = {}) => {
		const offset = options.offset ?? 0;
		const limit = options.limit ?? 20;
		return {
			hits: rawHitIds.slice(offset, offset + limit).map(id => ({ id, createdAt: 0 })),
		};
	});
	const updateSettings = jest.fn();
	const meilisearch = {
		index: jest.fn(() => ({
			search,
			updateSettings,
		})),
	} as unknown as MeiliSearch;

	const createQueryBuilder = jest.fn(() => {
		let batchIds: string[] = [];
		const queryBuilder = {
			innerJoinAndSelect: jest.fn(() => queryBuilder),
			leftJoinAndSelect: jest.fn(() => queryBuilder),
			where: jest.fn((_sql: string, params: { noteIds: string[] }) => {
				batchIds = params.noteIds;
				return queryBuilder;
			}),
			// Return database rows in deliberately different order. SearchService must
			// restore the order supplied by Meilisearch after applying DB-side filters.
			getMany: jest.fn(async () => batchIds
				.filter(id => visibleIdSet.has(id))
				.reverse()
				.map(note)),
		};
		return queryBuilder;
	});
	const notesRepository = { createQueryBuilder } as unknown as NotesRepository;

	const queryService = {
		generateBlockedHostQueryForNote: jest.fn(),
		generateSuspendedUserQueryForNote: jest.fn(),
		generateSilencedUserQueryForNotes: jest.fn(),
		generateBlockedUserQueryForNotes: jest.fn(),
		generateMutedUserQueryForNotes: jest.fn(),
	} as unknown as QueryService;
	const loggerService = {
		getLogger: jest.fn(() => ({ info: jest.fn() })),
	} as unknown as LoggerService;

	const service = new SearchService(
		{
			fulltextSearch: { provider: 'meilisearch' },
			meilisearch: { index: 'test' },
		} as Config,
		meilisearch,
		notesRepository,
		{} as CacheService,
		queryService,
		{} as IdService,
		loggerService,
	);

	return { service, search, createQueryBuilder };
}

describe('SearchService (Meilisearch)', () => {
	test('keeps Meilisearch relevance order after loading notes from the database', async () => {
		const { service, search } = createService(['c', 'a', 'b'], ['a', 'b', 'c']);

		const result = await service.searchNote('query', null, {
			order: 'relevance',
		}, {
			limit: 3,
		});

		expect(result.map(x => x.id)).toEqual(['c', 'a', 'b']);
		expect(search).toHaveBeenCalledTimes(1);
		expect(search.mock.calls[0][1]).not.toHaveProperty('sort');
	});

	test('continues scanning when the first batch is entirely filtered by the database', async () => {
		const filteredIds = Array.from({ length: 30 }, (_, i) => `filtered-${i}`);
		const { service, search } = createService([...filteredIds, 'visible-a', 'visible-b'], ['visible-a', 'visible-b']);

		const result = await service.searchNote('query', null, {
			order: 'relevance',
		}, {
			limit: 2,
		});

		expect(result.map(x => x.id)).toEqual(['visible-a', 'visible-b']);
		expect(search).toHaveBeenCalledTimes(2);
		expect(search.mock.calls.map(call => call[1]?.offset)).toEqual([0, 30]);
	});

	test('applies relevance offset to visible notes rather than raw hits', async () => {
		const trailingFilteredIds = Array.from({ length: 24 }, (_, i) => `trailing-filtered-${i}`);
		const rawHitIds = [
			'filtered-a',
			'visible-a',
			'filtered-b',
			'visible-b',
			'visible-c',
			'visible-d',
			...trailingFilteredIds,
		];
		const { service } = createService(rawHitIds, ['visible-a', 'visible-b', 'visible-c', 'visible-d']);

		const result = await service.searchNote('query', null, {
			order: 'relevance',
		}, {
			limit: 2,
			offset: 2,
		});

		expect(result.map(x => x.id)).toEqual(['visible-c', 'visible-d']);
	});
});
