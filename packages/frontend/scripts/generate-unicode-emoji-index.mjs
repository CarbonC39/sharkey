/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// CLDR 46 is the release aligned with Unicode Emoji 16.0, which is the
// version currently represented by frontend-shared/js/emojilist.json.
const CLDR_JSON_VERSION = '46.1.0';
const localeSources = {
	'zh-CN': 'zh',
	'zh-TW': 'zh-Hant',
};

const frontendDir = new URL('../', import.meta.url);
const emojiListUrl = new URL('../frontend-shared/js/emojilist.json', frontendDir);
const englishFallbackUrl = new URL('src/unicode-emoji-indexes/en-US.json', frontendDir);

async function fetchAnnotations(locale, derived) {
	const packageName = derived ? 'cldr-annotations-derived-full' : 'cldr-annotations-full';
	const directoryName = derived ? 'annotationsDerived' : 'annotations';
	const url = `https://raw.githubusercontent.com/unicode-org/cldr-json/${CLDR_JSON_VERSION}/cldr-json/${packageName}/${directoryName}/${locale}/annotations.json`;
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`);
	const data = /** @type {Record<string, { annotations: Record<string, { default?: string[], tts?: string[] }> }>} */ (await response.json());
	return data[directoryName].annotations;
}

function formatIndex(index) {
	const entries = Object.entries(index).map(([emoji, keywords]) => `\t${JSON.stringify(emoji)}: ${JSON.stringify(keywords)}`);
	return `{\n${entries.join(',\n')}\n}\n`;
}

async function generate(locale, sourceLocale, emojiList, englishFallback) {
	const [annotations, derivedAnnotations] = await Promise.all([
		fetchAnnotations(sourceLocale, false),
		fetchAnnotations(sourceLocale, true),
	]);
	const index = {};

	for (const [emoji] of emojiList) {
		// CLDR removes U+FE0F from annotation keys, while Sharkey keeps it in
		// the canonical emoji list where it is needed for colour presentation.
		const annotationKey = emoji.replaceAll('\uFE0F', '');
		const annotation = derivedAnnotations[emoji]
			?? annotations[emoji]
			?? derivedAnnotations[annotationKey]
			?? annotations[annotationKey];
		const localizedKeywords = [...new Set([
			...(annotation?.tts ?? []),
			...(annotation?.default ?? []),
		])];

		// Sharkey also carries one legacy private-use emoji that CLDR cannot
		// describe. Reusing its existing index keeps every lookup total.
		index[emoji] = localizedKeywords.length > 0 ? localizedKeywords : englishFallback[emoji];
		if (!index[emoji]) throw new Error(`No annotations available for ${emoji}`);
	}

	const outputUrl = new URL(`src/unicode-emoji-indexes/${locale}.json`, frontendDir);
	await writeFile(outputUrl, formatIndex(index));
	console.log(`Generated ${fileURLToPath(outputUrl)} (${Object.keys(index).length} emoji)`);
}

const requestedLocales = process.argv.slice(2);
const locales = requestedLocales.length > 0 ? requestedLocales : Object.keys(localeSources);
for (const locale of locales) {
	if (!(locale in localeSources)) throw new Error(`Unsupported locale: ${locale}`);
}

const emojiList = JSON.parse(await readFile(emojiListUrl, 'utf8'));
const englishFallback = JSON.parse(await readFile(englishFallbackUrl, 'utf8'));
for (const locale of locales) {
	await generate(locale, localeSources[locale], emojiList, englishFallback);
}
