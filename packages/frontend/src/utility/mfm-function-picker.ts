/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type MfmPickerCategory = 'markdown' | 'basic' | 'layout' | 'appearance' | 'animation' | 'advanced';

export type MfmPickerItem = {
	id: string;
	labelKey: string;
	category: MfmPickerCategory;
	icon: string;
	searchTerms: string[];
	template:
		| { type: 'wrap'; before: string; after: string; placeholder?: string }
		| { type: 'link' }
		| { type: 'search' }
		| { type: 'linePrefix'; prefix: string }
		| { type: 'block'; before: string; after: string }
		| { type: 'function'; name: string; placeholder?: string }
		| { type: 'ruby' }
		| { type: 'timestamp' };
	defaultParams?: string[];
	parameterPresets?: { label: string; labelKey?: string; params: string[] }[];
};

const animationPresets = [
	{ label: 'speed = 0.5s', params: ['speed=0.5s'] },
	{ label: 'speed = 2s', params: ['speed=2s'] },
	{ label: 'delay = 1s', params: ['delay=1s'] },
];

export const MFM_PICKER_ITEMS: MfmPickerItem[] = [
	// Keep the familiar Markdown-compatible formatting first.
	{ id: 'bold', labelKey: 'bold', category: 'markdown', icon: 'ph-text-b ph-bold ph-lg', searchTerms: ['bold', '**'], template: { type: 'wrap', before: '**', after: '**' } },
	{ id: 'italic', labelKey: 'italic', category: 'markdown', icon: 'ph-text-italic ph-bold ph-lg', searchTerms: ['italic', '*'], template: { type: 'wrap', before: '*', after: '*' } },
	{ id: 'strike', labelKey: 'strikethrough', category: 'markdown', icon: 'ph-text-strikethrough ph-bold ph-lg', searchTerms: ['strike', 'strikethrough', '~~'], template: { type: 'wrap', before: '~~', after: '~~' } },
	{ id: 'link', labelKey: 'link', category: 'markdown', icon: 'ph-link ph-bold ph-lg', searchTerms: ['link', 'url', '[]()'], template: { type: 'link' } },
	{ id: 'quote', labelKey: 'quote', category: 'markdown', icon: 'ph-quotes ph-bold ph-lg', searchTerms: ['quote', '>'], template: { type: 'linePrefix', prefix: '> ' } },
	{ id: 'inlineCode', labelKey: 'inlineCode', category: 'markdown', icon: 'ph-code ph-bold ph-lg', searchTerms: ['code', 'inline', '`'], template: { type: 'wrap', before: '`', after: '`', placeholder: 'code' } },
	{ id: 'blockCode', labelKey: 'blockCode', category: 'markdown', icon: 'ph-code-block ph-bold ph-lg', searchTerms: ['code', 'block', '```'], template: { type: 'block', before: '```\n', after: '\n```' } },

	{ id: 'mention', labelKey: 'mention', category: 'basic', icon: 'ph-at ph-bold ph-lg', searchTerms: ['mention', '@'], template: { type: 'wrap', before: '@', after: '', placeholder: 'username' } },
	{ id: 'hashtag', labelKey: 'hashtag', category: 'basic', icon: 'ph-hash ph-bold ph-lg', searchTerms: ['hashtag', '#'], template: { type: 'wrap', before: '#', after: '', placeholder: 'hashtag' } },
	{ id: 'emoji', labelKey: 'emoji', category: 'basic', icon: 'ph-smiley ph-bold ph-lg', searchTerms: ['emoji', ':emoji:'], template: { type: 'wrap', before: ':', after: ':', placeholder: 'emoji' } },
	{ id: 'small', labelKey: 'small', category: 'basic', icon: 'ph-text-aa ph-bold ph-lg', searchTerms: ['small', '<small>'], template: { type: 'wrap', before: '<small>', after: '</small>' } },
	{ id: 'inlineMath', labelKey: 'inlineMath', category: 'basic', icon: 'ph-math-operations ph-bold ph-lg', searchTerms: ['math', 'katex', '\\(\\)'], template: { type: 'wrap', before: '\\(', after: '\\)', placeholder: 'x' } },
	{ id: 'blockMath', labelKey: 'blockMath', category: 'basic', icon: 'ph-function ph-bold ph-lg', searchTerms: ['math', 'katex', '\\[\\]'], template: { type: 'wrap', before: '\\[', after: '\\]', placeholder: 'x' } },
	{ id: 'search', labelKey: 'search', category: 'basic', icon: 'ph-magnifying-glass ph-bold ph-lg', searchTerms: ['search', '[search]'], template: { type: 'search' } },
	{ id: 'plain', labelKey: 'plain', category: 'basic', icon: 'ph-textbox ph-bold ph-lg', searchTerms: ['plain', '<plain>'], template: { type: 'wrap', before: '<plain>', after: '</plain>' } },

	{ id: 'center', labelKey: 'center', category: 'layout', icon: 'ph-text-align-center ph-bold ph-lg', searchTerms: ['center', '<center>'], template: { type: 'wrap', before: '<center>', after: '</center>' } },
	{ id: 'position', labelKey: 'position', category: 'layout', icon: 'ph-arrows-out-cardinal ph-bold ph-lg', searchTerms: ['position', 'x', 'y'], template: { type: 'function', name: 'position' }, defaultParams: ['x=1'], parameterPresets: [
		{ label: 'x = -1', params: ['x=-1'] }, { label: 'x = 1', params: ['x=1'] },
		{ label: 'y = -1', params: ['y=-1'] }, { label: 'y = 1', params: ['y=1'] },
	] },
	{ id: 'crop', labelKey: 'crop', category: 'layout', icon: 'ph-crop ph-bold ph-lg', searchTerms: ['crop', 'top', 'right', 'bottom', 'left'], template: { type: 'function', name: 'crop' }, defaultParams: ['top=50'], parameterPresets: [
		{ label: 'top = 50', params: ['top=50'] }, { label: 'right = 50', params: ['right=50'] },
		{ label: 'bottom = 50', params: ['bottom=50'] }, { label: 'left = 50', params: ['left=50'] },
	] },
	{ id: 'scale', labelKey: 'scale', category: 'layout', icon: 'ph-arrows-out ph-bold ph-lg', searchTerms: ['scale', 'x', 'y'], template: { type: 'function', name: 'scale' }, defaultParams: ['x=1.5', 'y=1.5'], parameterPresets: [
		{ label: 'x = 1.5', params: ['x=1.5'] }, { label: 'y = 1.5', params: ['y=1.5'] },
		{ label: 'x = 1.5, y = 1.5', params: ['x=1.5', 'y=1.5'] },
	] },

	{ id: 'flip', labelKey: 'flip', category: 'appearance', icon: 'ph-arrows-left-right ph-bold ph-lg', searchTerms: ['flip', 'horizontal', 'vertical'], template: { type: 'function', name: 'flip' }, parameterPresets: [
		{ label: 'Horizontal', labelKey: 'horizontal', params: ['h'] }, { label: 'Vertical', labelKey: 'vertical', params: ['v'] }, { label: 'Horizontal + vertical', params: ['h', 'v'] },
	] },
	{ id: 'font', labelKey: 'font', category: 'appearance', icon: 'ph-text-t ph-bold ph-lg', searchTerms: ['font', 'serif', 'monospace', 'cursive', 'fantasy'], template: { type: 'function', name: 'font' }, defaultParams: ['serif'], parameterPresets: [
		{ label: 'Serif', params: ['serif'] }, { label: 'Monospace', params: ['monospace'] },
		{ label: 'Cursive', params: ['cursive'] }, { label: 'Fantasy', params: ['fantasy'] },
		{ label: 'Emoji', params: ['emoji'] }, { label: 'Math', params: ['math'] },
	] },
	{ id: 'x2', labelKey: 'x2', category: 'appearance', icon: 'ph-arrows-out ph-bold ph-lg', searchTerms: ['big', 'x2'], template: { type: 'function', name: 'x2' } },
	{ id: 'x3', labelKey: 'x3', category: 'appearance', icon: 'ph-arrows-out ph-bold ph-lg', searchTerms: ['big', 'x3'], template: { type: 'function', name: 'x3' } },
	{ id: 'x4', labelKey: 'x4', category: 'appearance', icon: 'ph-arrows-out ph-bold ph-lg', searchTerms: ['big', 'x4'], template: { type: 'function', name: 'x4' } },
	{ id: 'blur', labelKey: 'blur', category: 'appearance', icon: 'ph-eye-slash ph-bold ph-lg', searchTerms: ['blur'], template: { type: 'function', name: 'blur' } },
	{ id: 'foreground', labelKey: 'foreground', category: 'appearance', icon: 'ph-palette ph-bold ph-lg', searchTerms: ['foreground', 'fg', 'color'], template: { type: 'function', name: 'fg' }, parameterPresets: [
		{ label: '#eb6f92', params: ['color=eb6f92'] }, { label: '#31748f', params: ['color=31748f'] }, { label: '#9ccfd8', params: ['color=9ccfd8'] },
	] },
	{ id: 'background', labelKey: 'background', category: 'appearance', icon: 'ph-paint-brush ph-bold ph-lg', searchTerms: ['background', 'bg', 'color'], template: { type: 'function', name: 'bg' }, parameterPresets: [
		{ label: '#eb6f92', params: ['color=eb6f92'] }, { label: '#31748f', params: ['color=31748f'] }, { label: '#9ccfd8', params: ['color=9ccfd8'] },
	] },
	{ id: 'border', labelKey: 'border', category: 'appearance', icon: 'ph-frame-corners ph-bold ph-lg', searchTerms: ['border', 'width', 'style', 'color', 'radius'], template: { type: 'function', name: 'border' }, parameterPresets: [
		{ label: 'Rounded', labelKey: '_mfm.parameterRounded', params: ['radius=8'] }, { label: 'Dashed', labelKey: '_mfm.parameterDashed', params: ['style=dashed'] },
		{ label: 'Thick', labelKey: '_mfm.parameterThick', params: ['width=3'] }, { label: '#eb6f92', params: ['color=eb6f92'] },
		{ label: 'No clipping', labelKey: '_mfm.parameterNoClip', params: ['noclip'] },
	] },
	{ id: 'rotate', labelKey: 'rotate', category: 'appearance', icon: 'ph-arrow-clockwise ph-bold ph-lg', searchTerms: ['rotate', 'degree', 'deg'], template: { type: 'function', name: 'rotate' }, parameterPresets: [
		{ label: '45°', params: ['deg=45'] }, { label: '90°', params: ['deg=90'] }, { label: '180°', params: ['deg=180'] },
	] },

	{ id: 'jelly', labelKey: 'jelly', category: 'animation', icon: 'ph-wave-sine ph-bold ph-lg', searchTerms: ['jelly'], template: { type: 'function', name: 'jelly' }, parameterPresets: animationPresets },
	{ id: 'tada', labelKey: 'tada', category: 'animation', icon: 'ph-confetti ph-bold ph-lg', searchTerms: ['tada'], template: { type: 'function', name: 'tada' }, parameterPresets: animationPresets },
	{ id: 'jump', labelKey: 'jump', category: 'animation', icon: 'ph-arrow-up ph-bold ph-lg', searchTerms: ['jump'], template: { type: 'function', name: 'jump' }, parameterPresets: animationPresets },
	{ id: 'bounce', labelKey: 'bounce', category: 'animation', icon: 'ph-baseball ph-bold ph-lg', searchTerms: ['bounce'], template: { type: 'function', name: 'bounce' }, parameterPresets: animationPresets },
	{ id: 'shake', labelKey: 'shake', category: 'animation', icon: 'ph-wave-sine ph-bold ph-lg', searchTerms: ['shake'], template: { type: 'function', name: 'shake' }, parameterPresets: animationPresets },
	{ id: 'twitch', labelKey: 'twitch', category: 'animation', icon: 'ph-lightning ph-bold ph-lg', searchTerms: ['twitch'], template: { type: 'function', name: 'twitch' }, parameterPresets: animationPresets },
	{ id: 'spin', labelKey: 'spin', category: 'animation', icon: 'ph-spinner ph-bold ph-lg', searchTerms: ['spin', 'rotate', 'left', 'alternate', 'x', 'y'], template: { type: 'function', name: 'spin' }, parameterPresets: [
		{ label: 'Left', labelKey: 'left', params: ['left'] }, { label: 'Alternate', labelKey: '_mfm.parameterAlternate', params: ['alternate'] },
		{ label: 'X axis', labelKey: 'horizontal', params: ['x'] }, { label: 'Y axis', labelKey: 'vertical', params: ['y'] }, ...animationPresets,
	] },
	{ id: 'rainbow', labelKey: 'rainbow', category: 'animation', icon: 'ph-rainbow ph-bold ph-lg', searchTerms: ['rainbow'], template: { type: 'function', name: 'rainbow' }, parameterPresets: animationPresets },
	{ id: 'sparkle', labelKey: 'sparkle', category: 'animation', icon: 'ph-sparkle ph-bold ph-lg', searchTerms: ['sparkle'], template: { type: 'function', name: 'sparkle' } },
	{ id: 'fade', labelKey: 'fade', category: 'animation', icon: 'ph-gradient ph-bold ph-lg', searchTerms: ['fade', 'out'], template: { type: 'function', name: 'fade' }, parameterPresets: [
		{ label: 'Fade out', labelKey: '_mfm.parameterFadeOut', params: ['out'] }, ...animationPresets, { label: 'loop = 3', params: ['loop=3'] },
	] },

	{ id: 'unixtime', labelKey: 'unixtime', category: 'advanced', icon: 'ph-clock ph-bold ph-lg', searchTerms: ['unix', 'timestamp', 'time'], template: { type: 'timestamp' } },
	{ id: 'followMouse', labelKey: 'followMouse', category: 'advanced', icon: 'ph-mouse ph-bold ph-lg', searchTerms: ['followmouse', 'mouse', 'pointer'], template: { type: 'function', name: 'followmouse' }, parameterPresets: [
		{ label: 'X axis', labelKey: 'horizontal', params: ['x'] }, { label: 'Y axis', labelKey: 'vertical', params: ['y'] },
		{ label: 'X + Y axes', params: ['x', 'y'] }, { label: 'Rotate by velocity', params: ['x', 'y', 'rotateByVelocity'] },
		{ label: 'speed = 0.4', params: ['x', 'y', 'speed=0.4'] },
	] },
	{ id: 'ruby', labelKey: 'ruby', category: 'advanced', icon: 'ph-translate ph-bold ph-lg', searchTerms: ['ruby', 'furigana'], template: { type: 'ruby' } },
];

export type MfmInsertion = {
	text: string;
	selectionStart: number;
	selectionEnd: number;
};

export function insertMfm(
	text: string,
	selectionStart: number,
	selectionEnd: number,
	item: MfmPickerItem,
	params: string[] = [],
	now = Date.now(),
): MfmInsertion {
	const start = Math.max(0, Math.min(selectionStart, text.length));
	const end = Math.max(start, Math.min(selectionEnd, text.length));
	const selected = text.slice(start, end);
	let replacementStart = start;
	let replacementEnd = end;
	let inserted: string;
	let relativeStart: number;
	let relativeEnd: number;
	let keepEditableSelection = false;

	switch (item.template.type) {
		case 'wrap': {
			const content = selected || item.template.placeholder || '';
			inserted = `${item.template.before}${content}${item.template.after}`;
			relativeStart = item.template.before.length;
			relativeEnd = relativeStart + content.length;
			break;
		}
		case 'link': {
			const label = selected || 'text';
			const url = 'https://';
			inserted = `[${label}](${url})`;
			if (selected === '') {
				relativeStart = 1;
				relativeEnd = relativeStart + label.length;
			} else {
				keepEditableSelection = true;
				relativeStart = label.length + 3;
				relativeEnd = relativeStart + url.length;
			}
			break;
		}
		case 'search': {
			const content = (selected || 'query').replace(/\s*\n+\s*/g, ' ').trim() || 'query';
			while (replacementStart > 0 && /[\t ]/.test(text[replacementStart - 1])) replacementStart--;
			while (replacementEnd < text.length && /[\t ]/.test(text[replacementEnd])) replacementEnd++;
			const leading = replacementStart > 0 && text[replacementStart - 1] !== '\n' ? '\n' : '';
			const trailing = replacementEnd < text.length && text[replacementEnd] !== '\n' ? '\n' : '';
			inserted = `${leading}${content} [search]${trailing}`;
			relativeStart = leading.length;
			relativeEnd = relativeStart + content.length;
			break;
		}
		case 'linePrefix': {
			const prefix = item.template.prefix;
			if (selected === '') {
				const leading = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
				inserted = leading + prefix;
				relativeStart = relativeEnd = inserted.length;
			} else {
				const leading = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
				const trailing = end < text.length && text[end] !== '\n' ? '\n' : '';
				inserted = leading + selected.split('\n').map(line => prefix + line).join('\n') + trailing;
				relativeStart = relativeEnd = inserted.length;
			}
			break;
		}
		case 'block': {
			const leading = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
			const trailing = end < text.length && text[end] !== '\n' ? '\n' : '';
			inserted = `${leading}${item.template.before}${selected}${item.template.after}${trailing}`;
			relativeStart = leading.length + item.template.before.length;
			relativeEnd = relativeStart + selected.length;
			break;
		}
		case 'function': {
			const effectiveParams = params.length > 0 ? params : item.defaultParams ?? [];
			const args = effectiveParams.length > 0 ? `.${effectiveParams.join(',')}` : '';
			const content = selected || item.template.placeholder || '';
			const before = `$[${item.template.name}${args} `;
			inserted = `${before}${content}]`;
			relativeStart = before.length;
			relativeEnd = relativeStart + content.length;
			break;
		}
		case 'ruby': {
			const base = selected || 'text';
			const reading = 'reading';
			const before = '$[ruby ';
			inserted = `${before}${base} ${reading}]`;
			if (selected === '') {
				relativeStart = before.length;
				relativeEnd = relativeStart + base.length;
			} else {
				keepEditableSelection = true;
				relativeStart = before.length + base.length + 1;
				relativeEnd = relativeStart + reading.length;
			}
			break;
		}
		case 'timestamp': {
			const content = selected || String(Math.floor(now / 1000));
			const before = '$[unixtime ';
			inserted = `${before}${content}]`;
			relativeStart = before.length;
			relativeEnd = relativeStart + content.length;
			break;
		}
	}

	return {
		text: text.slice(0, replacementStart) + inserted + text.slice(replacementEnd),
		// Wrapping an existing selection is complete after insertion; an empty insertion
		// keeps the original editable placeholder/caret position.
		selectionStart: start !== end && !keepEditableSelection ? replacementStart + inserted.length : replacementStart + relativeStart,
		selectionEnd: start !== end && !keepEditableSelection ? replacementStart + inserted.length : replacementStart + relativeEnd,
	};
}

export function findMfmPickerItem(id: string): MfmPickerItem | undefined {
	return MFM_PICKER_ITEMS.find(item => item.id === id);
}

export function searchMfmPickerItems(query: string, getLabel: (item: MfmPickerItem) => string): MfmPickerItem[] {
	const normalized = query.trim().normalize('NFC').toLowerCase();
	if (normalized === '') return [];
	const words = normalized.split(/\s+/);
	return MFM_PICKER_ITEMS.filter(item => {
		const haystack = [getLabel(item), item.id, ...item.searchTerms]
			.join(' ')
			.normalize('NFC')
			.toLowerCase();
		return words.every(word => haystack.includes(word));
	});
}
