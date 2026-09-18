<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal
	ref="modal"
	v-slot="{ type, maxHeight }"
	:zPriority="'middle'"
	:preferType="prefer.s.emojiPickerStyle"
	:hasInteractionWithOtherFocusTrappedEls="true"
	:focusOnOpen="!props.preserveSourceFocus"
	:transparentBg="true"
	:src="src"
	@click="modal?.close()"
	@esc="modal?.close()"
	@opening="opening"
	@closed="emit('closed')"
>
	<MkMfmPicker
		ref="picker"
		class="_popup _shadow"
		:asDrawer="type === 'drawer'"
		:maxHeight="maxHeight"
		:autoFocus="!props.preserveSourceFocus"
		@chosen="chosen"
		@esc="modal?.close()"
	/>
</MkModal>
</template>

<script lang="ts" setup>
import { useTemplateRef } from 'vue';
import type { MfmPickerItem } from '@/utility/mfm-function-picker.js';
import MkModal from '@/components/MkModal.vue';
import MkMfmPicker from '@/components/MkMfmPicker.vue';
import { prefer } from '@/preferences.js';

const props = defineProps<{
	src?: HTMLElement;
	preserveSourceFocus?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'done', value: { item: MfmPickerItem; params: string[] }): void;
	(ev: 'closed'): void;
}>();

const modal = useTemplateRef('modal');
const picker = useTemplateRef('picker');

function chosen(value: { item: MfmPickerItem; params: string[] }) {
	emit('done', value);
	modal.value?.close();
}

function opening() {
	if (props.preserveSourceFocus) return;
	picker.value?.focus();
	window.setTimeout(() => picker.value?.focus(), 10);
}
</script>
