/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { UnicodeEmojiDef } from '@@/js/emojilist.js';

export type UnicodeEmojiIndex = Partial<Record<string, string[]>>;

function normalize(value: string): string {
	return value.normalize('NFC').toLowerCase();
}

export function searchUnicodeEmoji(
	query: string,
	emojis: UnicodeEmojiDef[],
	indexes: UnicodeEmojiIndex[],
	max = 100,
): UnicodeEmojiDef[] {
	const normalizedQuery = normalize(query.trim().replaceAll(':', ''));
	if (normalizedQuery === '') return [];

	const matches = new Set<UnicodeEmojiDef>();
	const addMatching = (predicate: (emoji: UnicodeEmojiDef) => boolean): boolean => {
		for (const emoji of emojis) {
			if (predicate(emoji)) matches.add(emoji);
			if (matches.size >= max) return true;
		}
		return false;
	};
	const indexKeywords = (index: UnicodeEmojiIndex, emoji: UnicodeEmojiDef): string[] => (
		index[emoji.char]?.map(normalize) ?? []
	);

	const exactMatch = emojis.find(emoji => normalize(emoji.name) === normalizedQuery);
	if (exactMatch) matches.add(exactMatch);

	if (normalizedQuery.includes(' ')) {
		const keywords = normalizedQuery.split(/\s+/);
		if (addMatching(emoji => keywords.every(keyword => normalize(emoji.name).includes(keyword)))) return Array.from(matches);

		for (const index of indexes) {
			if (addMatching(emoji => {
				const localizedKeywords = indexKeywords(index, emoji);
				return keywords.every(keyword => localizedKeywords.some(candidate => candidate.includes(keyword)));
			})) break;
		}
	} else {
		if (addMatching(emoji => normalize(emoji.name).startsWith(normalizedQuery))) return Array.from(matches);

		for (const index of indexes) {
			if (addMatching(emoji => indexKeywords(index, emoji).some(keyword => keyword.startsWith(normalizedQuery)))) return Array.from(matches);
		}

		if (addMatching(emoji => normalize(emoji.name).includes(normalizedQuery))) return Array.from(matches);

		for (const index of indexes) {
			if (addMatching(emoji => indexKeywords(index, emoji).some(keyword => keyword.includes(normalizedQuery)))) break;
		}
	}

	return Array.from(matches);
}
