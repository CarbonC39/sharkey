/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as http from 'node:http';

/**
 * The streaming server owns only the `/streaming` WebSocket endpoint. Other
 * upgrade requests, including Vite HMR, must be left for their respective
 * Fastify plugins to handle.
 */
export function isStreamingUpgradeRequest(request: Pick<http.IncomingMessage, 'url'>): boolean {
	if (request.url == null) return false;

	try {
		return new URL(request.url, 'http://localhost').pathname === '/streaming';
	} catch {
		return false;
	}
}
