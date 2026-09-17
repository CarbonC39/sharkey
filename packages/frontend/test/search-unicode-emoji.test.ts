/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { assert, describe, test } from 'vitest';
import { emojilist } from '@@/js/emojilist.js';
import zhCN from '@/unicode-emoji-indexes/zh-CN.json';
import zhTW from '@/unicode-emoji-indexes/zh-TW.json';
import { searchUnicodeEmoji } from '@/utility/search-unicode-emoji.js';

describe('Unicode emoji search', () => {
	test('finds emoji by Simplified Chinese CLDR short names and keywords', () => {
		assert.equal(searchUnicodeEmoji('笑哭', emojilist, [zhCN])[0]?.char, '😂');
		assert.ok(searchUnicodeEmoji('程序员', emojilist, [zhCN]).some(emoji => emoji.char === '🧑‍💻'));
	});

	test('finds emoji by Traditional Chinese CLDR annotations', () => {
		assert.ok(searchUnicodeEmoji('程式設計師', emojilist, [zhTW]).some(emoji => emoji.char === '🧑‍💻'));
	});

	test('supports AND searches within one localized index', () => {
		assert.ok(searchUnicodeEmoji('中国 旗', emojilist, [zhCN]).some(emoji => emoji.char === '🇨🇳'));
	});

	test('matches CLDR keys without a variation selector to Sharkey emoji', () => {
		assert.ok(searchUnicodeEmoji('红心', emojilist, [zhCN]).some(emoji => emoji.char === '❤️'));
	});

	test('generated indexes cover every canonical emoji lookup', () => {
		for (const emoji of emojilist) {
			assert.ok(zhCN[emoji.char]?.length > 0, `missing zh-CN keywords for ${emoji.char}`);
			assert.ok(zhTW[emoji.char]?.length > 0, `missing zh-TW keywords for ${emoji.char}`);
		}
	});
});
