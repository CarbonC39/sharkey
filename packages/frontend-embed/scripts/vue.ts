/**
 * Hot-swaps tsconfig files to work around vite limitations.
 * Based on idea from https://github.com/vitejs/vite/discussions/8483#discussioncomment-6830634
 */

import nodeFs from 'node:fs';
import nodePath from 'node:path';
import { execa, ExecaError } from 'execa';

const [command, ...args] = process.argv.slice(2);
if (!command) {
	console.error('Aborting; no command provided');
	process.exit(1);
}

const rootDir = nodePath.resolve(import.meta.dirname, '../');
const tsConfig = nodePath.resolve(rootDir, 'tsconfig.json');
const tsConfigBak = nodePath.resolve(rootDir, 'tsconfig.json.bak');
const tsConfigVue = nodePath.resolve(rootDir, 'tsconfig.vue.json');
const tsConfigLock = nodePath.resolve(rootDir, 'tsconfig.json.lock');
const failIfConfigIsBusy = command === 'vite' && args[0] === 'build';

let clean = true;
let lockFd: number | undefined;
let lastLockNoticeAt = 0;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code !== 'ESRCH';
	}
}

async function acquireConfigLock(): Promise<void> {
	while (true) {
		try {
			lockFd = nodeFs.openSync(tsConfigLock, 'wx');
			nodeFs.writeFileSync(lockFd, `${process.pid}\n`);
			return;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

			let ownerPid: number | undefined;
			try {
				const value = Number.parseInt(nodeFs.readFileSync(tsConfigLock, 'utf8'), 10);
				if (Number.isInteger(value) && value > 0) ownerPid = value;
			} catch {
				// The lock may be between creation and writing its owner PID.
			}

			// Recover a lock left by a process that was killed before cleanup.
			let stale = ownerPid !== undefined && ownerPid !== process.pid && !isProcessAlive(ownerPid);
			if (ownerPid === undefined) {
				try {
					stale = Date.now() - nodeFs.statSync(tsConfigLock).mtimeMs > 30_000;
				} catch {
					// Another waiter may have removed the lock.
				}
			}
			if (stale) {
				try {
					nodeFs.rmSync(tsConfigLock);
				} catch {
					// Another waiter may have removed the stale lock.
				}
				continue;
			}

			const now = Date.now();
			if (failIfConfigIsBusy) {
				throw new Error(`tsconfig.json is locked by ${ownerPid == null ? 'another process' : `PID ${ownerPid}`}; a dev/watch process is already running, stop it before running a build`);
			}
			if (now - lastLockNoticeAt >= 5_000) {
				console.warn(`Waiting for tsconfig.json lock held by ${ownerPid == null ? 'another process' : `PID ${ownerPid}`}...`);
				lastLockNoticeAt = now;
			}

			await sleep(50);
		}
	}
}

function releaseConfigLock(): void {
	if (lockFd === undefined) return;
	nodeFs.closeSync(lockFd);
	lockFd = undefined;
	nodeFs.rmSync(tsConfigLock, { force: true });
}

function recoverInterruptedStage(): void {
	if (!nodeFs.existsSync(tsConfigBak)) return;

	console.warn('Recovering interrupted tsconfig.json staging...');
	if (nodeFs.existsSync(tsConfig)) nodeFs.rmSync(tsConfig);
	nodeFs.renameSync(tsConfigBak, tsConfig);
}

function cleanup() {
	if (clean) {
		releaseConfigLock();
		return;
	}

	console.log('Restoring original tsconfig.json...');
	try {
		if (nodeFs.existsSync(tsConfig)) nodeFs.rmSync(tsConfig);
		if (nodeFs.existsSync(tsConfigBak)) nodeFs.renameSync(tsConfigBak, tsConfig);
		clean = true;
	} finally {
		releaseConfigLock();
	}
}

process.on('exit', () => {
	try {
		cleanup();
	} catch (error) {
		console.error('Error in cleanup:', error);
		process.exitCode ||= -1;
	}
});

['SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException', 'SIGTERM'].forEach(evt => {
	process.on(evt, () => {
		// Don't trample an existing non-zero exit code
		if (!clean) process.exitCode ||= -1;

		try {
			cleanup();
		} catch (error) {
			console.error('Error in cleanup:', error);
			process.exitCode ||= -1;
		} finally {
			// No value will use process.exitCode
			process.exit();
		}
	});
});

try {
	await acquireConfigLock();
	recoverInterruptedStage();
	console.log('Staging tsconfig.vue.json as tsconfig.json...');
	nodeFs.renameSync(tsConfig, tsConfigBak);
	clean = false;
	nodeFs.copyFileSync(tsConfigVue, tsConfig);

	console.log(`Starting ${command}...`);
	const result = await execa(
		command,
		args,
		{
			stdout: process.stdout,
			stderr: process.stderr,
		},
	);

	cleanup();
	process.exitCode = result.exitCode;
} catch (error) {
	console.error(`Error running ${command}:`, error);

	cleanup();

	if (error instanceof ExecaError) {
		process.exitCode = error.exitCode || -1;
	} else {
		process.exitCode = -1;
	}
}
