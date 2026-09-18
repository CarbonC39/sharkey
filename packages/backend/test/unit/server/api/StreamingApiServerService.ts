/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from '@jest/globals';
import { isStreamingUpgradeRequest } from '@/server/api/is-streaming-upgrade-request.js';

describe('isStreamingUpgradeRequest', () => {
	test('accepts the streaming endpoint and preserves its query string', () => {
		expect(isStreamingUpgradeRequest({ url: '/streaming?i=token' })).toBe(true);
	});

	test('does not claim Vite HMR upgrades', () => {
		expect(isStreamingUpgradeRequest({ url: '/vite/' })).toBe(false);
		expect(isStreamingUpgradeRequest({ url: '/vite/@vite/client' })).toBe(false);
	});

	test('rejects malformed or unrelated upgrade URLs', () => {
		expect(isStreamingUpgradeRequest({ url: '/streaming/' })).toBe(false);
		expect(isStreamingUpgradeRequest({ url: '/api/streaming' })).toBe(false);
		expect(isStreamingUpgradeRequest({ url: undefined })).toBe(false);
		expect(isStreamingUpgradeRequest({ url: 'http://[invalid' })).toBe(false);
	});
});
