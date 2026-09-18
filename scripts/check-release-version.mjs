import fs from 'node:fs';

const [tag] = process.argv.slice(2);
const releasePattern = /^\d+\.\d+\.\d+-lomia\.\d+$/;

if (!tag || !releasePattern.test(tag)) {
	console.error('Expected a release tag like 2025.5.2-lomia.1');
	process.exit(1);
}

const root = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const misskeyJs = JSON.parse(fs.readFileSync(new URL('../packages/misskey-js/package.json', import.meta.url), 'utf8'));

if (root.version !== tag || misskeyJs.version !== tag) {
	console.error(`Release tag ${tag} must match both package versions (root=${root.version}, misskey-js=${misskeyJs.version})`);
	process.exit(1);
}

console.log(`Release version ${tag} is synchronized.`);
