/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { execa, execaNode } from 'execa';

/** @type {import('execa').ResultPromise | undefined} */
let backendProcess;
let restartQueued = false;
let restarting = false;

async function execBuildAssets() {
	await execa('pnpm', ['run', 'build-assets'], {
		cwd: '../../',
		stdout: process.stdout,
		stderr: process.stderr,
	});
}

function execStart() {
	// pnpm run start を呼び出したいが、windowsだとプロセスグループ単位でのkillが出来ずゾンビプロセス化するので
	// 上記と同等の動きをするコマンドで子・孫プロセスを作らないようにしたい
	backendProcess = execaNode('./built/boot/entry.js', [], {
		stdout: process.stdout,
		stderr: process.stderr,
		env: {
			'NODE_ENV': 'development',
		},
	});
}

async function killProc() {
	if (backendProcess) {
		backendProcess.catch(() => {}); // backendProcess.kill()によって発生する例外を無視するためにcatch()を呼び出す
		backendProcess.kill();
		await new Promise(resolve => backendProcess?.on('exit', resolve))
			.finally(() => backendProcess = undefined);
	}
}

async function processRestarts() {
	if (restarting) return;

	restarting = true;
	try {
		while (restartQueued) {
			restartQueued = false;
			// Keep this order: the backend must not start while build-assets is
			// still updating the files it serves.
			await killProc();
			await execBuildAssets();
			execStart();
		}
	} catch (error) {
		console.error('Failed to restart backend:', error);
		restartQueued = false;
		process.exitCode ||= 1;
	} finally {
		restarting = false;
		// A file change can arrive after the loop observes an empty queue but
		// before this function releases the guard. Consume that request after
		// releasing the guard instead of leaving it stranded.
		if (restartQueued) void processRestarts();
	}
}

function requestRestart() {
	restartQueued = true;
	void processRestarts();
}

(async () => {
	execaNode(
		'./node_modules/nodemon/bin/nodemon.js',
		[
			'-w', 'src',
			'-e', 'ts,js,mjs,cjs,json',
			'--exec', 'pnpm', 'run', 'build',
		],
		{
			stdio: [process.stdin, process.stdout, process.stderr, 'ipc'],
			serialization: "json",
		})
		.on('message', /** @param {{type: string}} message */ (message) => {
			if (message.type === 'exit') {
				// かならずbuild->build-assetsの順番で呼び出したいので、
				// 少々トリッキーだがnodemonからのexitイベントを利用してbuild-assets->startを行う。
				// pnpm restartをbuildが終わる前にbuild-assetsが動いてしまうので、バラバラにする。
				// nodemon may emit multiple exit messages while files are changing; queue them
				// so two backend processes can never be started concurrently.
				requestRestart();
			}
		});
})();
