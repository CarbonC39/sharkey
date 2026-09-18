/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { assert, describe, test } from 'vitest';
import { findMfmPickerItem, insertMfm, MFM_PICKER_ITEMS, searchMfmPickerItems } from '@/utility/mfm-function-picker.js';

const CHEATSHEET_ITEMS = [
	'mention', 'hashtag', 'link', 'emoji', 'bold', 'small', 'quote', 'center', 'unixtime',
	'inlineCode', 'blockCode', 'inlineMath', 'blockMath', 'search', 'flip', 'font', 'x2', 'x3',
	'x4', 'blur', 'jelly', 'tada', 'jump', 'bounce', 'spin', 'shake', 'twitch', 'rainbow',
	'sparkle', 'rotate', 'crop', 'position', 'followMouse', 'scale', 'fade', 'foreground',
	'background', 'border', 'plain',
];

describe('MFM function picker', () => {
	test('covers every entry in the MFM cheatsheet', () => {
		const ids = new Set(MFM_PICKER_ITEMS.map(item => item.id));
		for (const id of CHEATSHEET_ITEMS) assert.ok(ids.has(id), `${id} is missing`);
	});

	test('has unique item IDs and the required common Markdown entries', () => {
		const ids = MFM_PICKER_ITEMS.map(item => item.id);
		assert.equal(new Set(ids).size, ids.length);
		for (const item of MFM_PICKER_ITEMS) assert.match(item.icon, /^ph-[^ ]+ ph-bold ph-lg$/);
		for (const id of ['bold', 'italic', 'strike', 'link', 'quote', 'inlineCode', 'blockCode']) {
			assert.equal(findMfmPickerItem(id)?.category, 'markdown');
		}
	});

	test('searches localized labels as well as syntax and tags', () => {
		const localized = searchMfmPickerItems('本地粗体', item => item.id === 'bold' ? '本地粗体' : item.id);
		assert.deepEqual(localized.map(item => item.id), ['bold']);
		assert.equal(searchMfmPickerItems('~~', item => item.id)[0]?.id, 'strike');
		assert.equal(searchMfmPickerItems('followmouse', item => item.id)[0]?.id, 'followMouse');
	});

	test('wraps a textarea selection and keeps it selected', () => {
		const item = findMfmPickerItem('bold')!;
		const result = insertMfm('say hello!', 4, 9, item);
		assert.equal(result.text, 'say **hello**!');
		assert.equal(result.text.slice(result.selectionStart, result.selectionEnd), 'hello');
	});

	test('preserves browser UTF-16 selection offsets for emoji and Chinese text', () => {
		const item = findMfmPickerItem('bold')!;
		const result = insertMfm('A😀中文B', 1, 5, item);
		assert.equal(result.text, 'A**😀中文**B');
		assert.equal(result.text.slice(result.selectionStart, result.selectionEnd), '😀中文');
	});

	test('wraps selected link text and selects the URL for editing', () => {
		const item = findMfmPickerItem('link')!;
		const result = insertMfm('Sharkey', 0, 7, item);
		assert.equal(result.text, '[Sharkey](https://)');
		assert.equal(result.text.slice(result.selectionStart, result.selectionEnd), 'https://');
	});

	test('wraps selected ruby base text and selects the reading', () => {
		const item = findMfmPickerItem('ruby')!;
		const result = insertMfm('漢字', 0, 2, item);
		assert.equal(result.text, '$[ruby 漢字 reading]');
		assert.equal(result.text.slice(result.selectionStart, result.selectionEnd), 'reading');
	});

	test('places the caret inside an empty function', () => {
		const item = findMfmPickerItem('shake')!;
		const result = insertMfm('before after', 7, 7, item, ['speed=0.5s']);
		assert.equal(result.text, 'before $[shake.speed=0.5s ]after');
		assert.equal(result.selectionStart, result.selectionEnd);
		assert.equal(result.text.slice(result.selectionStart - 1, result.selectionStart + 1), ' ]');
	});

	test('uses a visible default for functions that otherwise have no effect', () => {
		assert.equal(insertMfm('', 0, 0, findMfmPickerItem('font')!).text, '$[font.serif ]');
		assert.equal(insertMfm('', 0, 0, findMfmPickerItem('position')!).text, '$[position.x=1 ]');
		assert.equal(insertMfm('', 0, 0, findMfmPickerItem('crop')!).text, '$[crop.top=50 ]');
		assert.equal(insertMfm('', 0, 0, findMfmPickerItem('scale')!).text, '$[scale.x=1.5,y=1.5 ]');
	});

	test('quotes every selected line', () => {
		const item = findMfmPickerItem('quote')!;
		const result = insertMfm('one\ntwo', 0, 7, item);
		assert.equal(result.text, '> one\n> two');
		assert.equal(result.selectionStart, result.text.length);
		assert.equal(result.selectionEnd, result.text.length);
	});

	test('places the caret on the blank line in a code block', () => {
		const item = findMfmPickerItem('blockCode')!;
		const result = insertMfm('', 0, 0, item);
		assert.equal(result.text, '```\n\n```');
		assert.equal(result.selectionStart, 4);
		assert.equal(result.selectionEnd, 4);
	});

	test('keeps a code block valid when inserted in the middle of a line', () => {
		const item = findMfmPickerItem('blockCode')!;
		const result = insertMfm('beforeafter', 6, 6, item);
		assert.equal(result.text, 'before\n```\n\n```\nafter');
		assert.equal(result.text[result.selectionStart - 1], '\n');
		assert.equal(result.selectionStart, result.selectionEnd);
	});

	test('keeps search syntax on its own line', () => {
		const item = findMfmPickerItem('search')!;
		const result = insertMfm('before query after', 7, 12, item);
		assert.equal(result.text, 'before\nquery [search]\nafter');
		assert.equal(result.text.slice(result.selectionStart, result.selectionEnd), 'query');
	});

	test('uses the supplied time for Unix time insertion', () => {
		const item = findMfmPickerItem('unixtime')!;
		const result = insertMfm('', 0, 0, item, [], 1_700_000_000_000);
		assert.equal(result.text, '$[unixtime 1700000000]');
		assert.equal(result.text.slice(result.selectionStart, result.selectionEnd), '1700000000');
	});
});
