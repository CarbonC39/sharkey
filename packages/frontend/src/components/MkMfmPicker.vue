<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.drawer]: asDrawer }]" :style="{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }">
	<input
		ref="searchEl"
		:value="query"
		:class="$style.search"
		:placeholder="i18n.ts.search"
		type="search"
		autocapitalize="off"
		@input="onInput"
		@keydown="onKeydown"
	>

	<div :class="$style.items" tabindex="-1">
		<section v-if="query !== ''" :class="$style.section">
			<header class="_acrylic" :class="$style.header"><i :class="[categoryIcons.search, $style.headerIcon]"></i> {{ i18n.ts.search }}</header>
			<div v-if="searchResults.length > 0" :class="$style.grid">
				<MfmPickerItemButton v-for="pickerItem in searchResults" :key="pickerItem.id" :item="pickerItem"/>
			</div>
			<div v-else :class="$style.empty">{{ i18n.ts.notFound }}</div>
		</section>

		<template v-else>
			<section :class="$style.section">
				<header class="_acrylic" :class="$style.header"><i :class="[categoryIcons.markdown, $style.headerIcon]"></i> {{ categoryLabels.markdown }}</header>
				<div :class="$style.grid">
					<MfmPickerItemButton v-for="pickerItem in itemsByCategory.markdown" :key="pickerItem.id" :item="pickerItem"/>
				</div>
			</section>

			<section v-if="recentItems.length > 0" :class="$style.section">
				<header class="_acrylic" :class="$style.header"><i :class="[categoryIcons.recent, $style.headerIcon]"></i> {{ i18n.ts.recentUsed }}</header>
				<div :class="$style.grid">
					<MfmPickerItemButton v-for="pickerItem in recentItems" :key="pickerItem.id" :item="pickerItem"/>
				</div>
			</section>

			<section v-for="category in remainingCategories" :key="category" :class="$style.section">
				<header class="_acrylic" :class="$style.header"><i :class="[categoryIcons[category], $style.headerIcon]"></i> {{ categoryLabels[category] }}</header>
				<div :class="$style.grid">
					<MfmPickerItemButton v-for="pickerItem in itemsByCategory[category]" :key="pickerItem.id" :item="pickerItem"/>
				</div>
			</section>
		</template>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, useCssModule, useTemplateRef } from 'vue';
import type { MenuItem } from '@/types/menu.js';
import type { MfmPickerCategory, MfmPickerItem } from '@/utility/mfm-function-picker.js';
import { MFM_PICKER_ITEMS, searchMfmPickerItems } from '@/utility/mfm-function-picker.js';
import { i18n } from '@/i18n.js';
import { store } from '@/store.js';
import * as os from '@/os.js';
import { deviceKind } from '@/utility/device-kind.js';
import { isTouchUsing } from '@/utility/touch.js';

withDefaults(defineProps<{
	maxHeight?: number;
	asDrawer?: boolean;
}>(), {
	maxHeight: undefined,
	asDrawer: false,
});

const emit = defineEmits<{
	(ev: 'chosen', value: { item: MfmPickerItem; params: string[] }): void;
	(ev: 'esc'): void;
}>();

const style = useCssModule();
const searchEl = useTemplateRef('searchEl');
const query = ref('');
const recentIds = store.r.recentlyUsedMfm;
const remainingCategories: Exclude<MfmPickerCategory, 'markdown'>[] = ['basic', 'layout', 'appearance', 'animation', 'advanced'];
const mfmLocale = i18n.ts._mfm as unknown as Record<string, string>;
const rootLocale = i18n.ts as unknown as Record<string, string>;

const categoryLabels: Record<MfmPickerCategory, string> = {
	markdown: mfmLocale.pickerMarkdown,
	basic: mfmLocale.pickerBasic,
	layout: mfmLocale.pickerLayout,
	appearance: i18n.ts.appearance,
	animation: mfmLocale.pickerAnimation,
	advanced: i18n.ts.advanced,
};

const categoryIcons: Record<MfmPickerCategory | 'search' | 'recent', string> = {
	search: 'ph-magnifying-glass ph-bold ph-lg',
	recent: 'ph-clock ph-bold ph-lg',
	markdown: 'ph-text-b ph-bold ph-lg',
	basic: 'ph-textbox ph-bold ph-lg',
	layout: 'ph-layout ph-bold ph-lg',
	appearance: 'ph-palette ph-bold ph-lg',
	animation: 'ph-sparkle ph-bold ph-lg',
	advanced: 'ph-flask ph-bold ph-lg',
};

const itemsByCategory = computed(() => Object.fromEntries(
	(['markdown', ...remainingCategories] as MfmPickerCategory[]).map(category => [
		category,
		MFM_PICKER_ITEMS.filter(item => item.category === category),
	]),
) as Record<MfmPickerCategory, MfmPickerItem[]>);

const recentItems = computed(() => recentIds.value
	.map(id => MFM_PICKER_ITEMS.find(item => item.id === id))
	.filter((item): item is MfmPickerItem => item != null));

const searchResults = computed(() => {
	return searchMfmPickerItems(query.value, getLabel);
});

function getLabel(item: MfmPickerItem): string {
	return mfmLocale[item.labelKey] ?? item.id;
}

function remember(item: MfmPickerItem) {
	const next = recentIds.value.filter(id => id !== item.id);
	next.unshift(item.id);
	store.set('recentlyUsedMfm', next.slice(0, 16));
}

function choose(item: MfmPickerItem, params: string[] = [], fromParameterMenu = false) {
	if (!fromParameterMenu && longPressedItemId === item.id) {
		longPressedItemId = null;
		return;
	}
	longPressedItemId = null;
	remember(item);
	emit('chosen', { item, params });
}

function parameterMenu(item: MfmPickerItem): MenuItem[] {
	return [
		{ type: 'label', text: getLabel(item), caption: mfmLocale.pickerParameterHint },
		{ text: item.defaultParams?.length ? i18n.ts.recommended : i18n.ts.default, icon: 'ph-check ph-bold ph-lg', action: () => choose(item, [], true) },
		...(item.parameterPresets ?? []).map(preset => ({
			text: preset.labelKey?.startsWith('_mfm.')
				? mfmLocale[preset.labelKey.slice('_mfm.'.length)] ?? preset.label
				: preset.labelKey ? rootLocale[preset.labelKey] ?? preset.label : preset.label,
			icon: 'ph-sliders-horizontal ph-bold ph-lg',
			action: () => choose(item, preset.params, true),
		})),
	];
}

function openParameters(item: MfmPickerItem, target: EventTarget | null) {
	if (!item.parameterPresets?.length || !(target instanceof HTMLElement)) return;
	void os.popupMenu(parameterMenu(item), target).finally(() => {
		if (longPressedItemId === item.id) longPressedItemId = null;
	});
}

let longPressTimer: number | null = null;
let longPressedItemId: string | null = null;
let longPressStart: { x: number; y: number } | null = null;
let suppressContextMenuUntil = 0;

function clearLongPress() {
	if (longPressTimer != null) window.clearTimeout(longPressTimer);
	longPressTimer = null;
	longPressStart = null;
}

function onPointerDown(item: MfmPickerItem, ev: PointerEvent) {
	clearLongPress();
	if (!item.parameterPresets?.length || ev.pointerType === 'mouse') return;
	const target = ev.currentTarget;
	longPressStart = { x: ev.clientX, y: ev.clientY };
	longPressTimer = window.setTimeout(() => {
		longPressTimer = null;
		longPressedItemId = item.id;
		suppressContextMenuUntil = Date.now() + 1000;
		openParameters(item, target);
	}, 500);
}

function onPointerMove(ev: PointerEvent) {
	if (longPressStart == null) return;
	if (Math.hypot(ev.clientX - longPressStart.x, ev.clientY - longPressStart.y) > 10) clearLongPress();
}

function onInput() {
	query.value = searchEl.value?.value ?? '';
}

function onKeydown(ev: KeyboardEvent) {
	if (ev.isComposing || ev.key === 'Process' || ev.keyCode === 229) return;
	if (ev.key === 'Enter' && searchResults.value[0]) {
		ev.preventDefault();
		choose(searchResults.value[0]);
	} else if (ev.key === 'Escape') {
		ev.preventDefault();
		emit('esc');
	}
}

function focus() {
	if (!['smartphone', 'tablet'].includes(deviceKind) && !isTouchUsing) searchEl.value?.focus({ preventScroll: true });
}

const MfmPickerItemButton = defineComponent({
	props: {
		item: { type: Object as () => MfmPickerItem, required: true },
	},
	setup(componentProps) {
		return () => h('div', {
			class: style.itemWrapper,
			onContextmenu: (ev: MouseEvent) => {
				ev.preventDefault();
				ev.stopPropagation();
				if (Date.now() < suppressContextMenuUntil) return;
				openParameters(componentProps.item, ev.currentTarget);
			},
			onPointerdown: (ev: PointerEvent) => onPointerDown(componentProps.item, ev),
			onPointermove: onPointerMove,
			onPointerup: clearLongPress,
			onPointercancel: clearLongPress,
			onPointerleave: clearLongPress,
		}, [
			h('button', {
				class: ['_button', style.item, { [style.itemWithParameters]: componentProps.item.parameterPresets?.length }],
				'aria-label': getLabel(componentProps.item),
				title: getLabel(componentProps.item),
				onClick: () => choose(componentProps.item),
			}, [
				h('i', { class: [componentProps.item.icon, style.icon], 'aria-hidden': 'true' }),
				h('span', { class: style.name }, getLabel(componentProps.item)),
			]),
			componentProps.item.parameterPresets?.length
				? h('button', {
					class: ['_button', style.parameterBadge],
					title: mfmLocale.pickerParameterHint,
					onClick: (ev: MouseEvent) => {
						ev.stopPropagation();
						openParameters(componentProps.item, ev.currentTarget);
					},
				}, h('i', { class: 'ph-sliders-horizontal ph-bold ph-lg', 'aria-hidden': 'true' }))
				: null,
		]);
	},
});

onMounted(focus);
onBeforeUnmount(clearLongPress);

defineExpose({ focus });
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	container-type: inline-size;
	width: min(520px, 100vw);
	height: min(620px, 75vh);
	background: var(--MI_THEME-popup);
	border-radius: var(--MI-radius);
	overflow: clip;
}

.drawer {
	width: 100%;
	border-bottom-right-radius: 0;
	border-bottom-left-radius: 0;
}

.search {
	width: 100%;
	box-sizing: border-box;
	padding: 12px;
	border: none;
	border-bottom: solid 0.5px var(--MI_THEME-divider);
	outline: none;
	background: transparent;
	color: var(--MI_THEME-fg);
	font: inherit;
}

.items {
	flex: 1;
	overflow-y: auto;
	overscroll-behavior: contain;
}

.section + .section {
	border-top: solid 0.5px var(--MI_THEME-divider);
}

.header {
	position: sticky;
	z-index: 1;
	top: 0;
	padding: 8px 12px;
	font-size: 12px;
	font-weight: bold;
}

.headerIcon {
	width: 1.2em;
	margin-right: 4px;
	text-align: center;
}

.grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
	gap: 4px;
	padding: 6px 8px 8px;
}

.itemWrapper {
	position: relative;
	min-width: 0;
}

.item {
	display: flex;
	align-items: center;
	min-width: 0;
	min-height: 48px;
	padding: 7px 8px;
	gap: 7px;
	border-radius: var(--MI-radius-sm);
	text-align: left;
	width: 100%;

	&:hover, &:focus-visible {
		background: light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08));
	}

	&:active {
		background: var(--MI_THEME-accentedBg);
	}

	&:focus-visible {
		outline: 2px solid var(--MI_THEME-accent);
		outline-offset: -2px;
	}
}

.itemWithParameters {
	padding-right: 40px;
}

.icon {
	flex: none;
	width: 18px;
	color: var(--MI_THEME-accent);
	text-align: center;
}

.name {
	min-width: 0;
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.parameterBadge {
	position: absolute;
	top: 50%;
	right: 9px;
	transform: translateY(-50%);
	display: grid;
	place-items: center;
	width: 22px;
	height: 22px;
	border-radius: var(--MI-radius-full);
	background: var(--MI_THEME-button);
	color: var(--MI_THEME-fg);
	opacity: 0.65;
	font-size: 12px;
}

.empty {
	padding: 32px 16px;
	opacity: 0.65;
	text-align: center;
}

@container (max-width: 360px) {
	.grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}
</style>
