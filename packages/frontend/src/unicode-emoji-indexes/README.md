# Unicode emoji search indexes

`zh-CN.json` and `zh-TW.json` are generated from the Unicode Consortium's
[CLDR JSON annotations](https://github.com/unicode-org/cldr-json) version
46.1.0. CLDR 46 is aligned with Unicode Emoji 16.0, the version used by the
current emoji list.

Regenerate both indexes from the repository root with:

```sh
node packages/frontend/scripts/generate-unicode-emoji-index.mjs
```

The generated indexes are distributed under the Unicode License v3. Its
complete copyright and permission notice is included in `LICENSE-UNICODE`.
