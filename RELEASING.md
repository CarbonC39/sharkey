# Releasing the Lomia soft fork

This repository follows upstream Sharkey through the Forgejo remote while
publishing a separately versioned Lomia build. Forgejo is the source of truth
for the branch; the GitHub mirror currently provides the public CI and GHCR
release path. The repository has a legacy `.gitlab-ci.yml`, but does not yet
have a Forgejo Actions runner, so it must not be treated as an active Forgejo
deployment gate.

## Version and tag rules

Use a fork-owned calendar version with the `-lomia.N` suffix, for example:

```text
2025.5.2-lomia.1
```

The version in the root `package.json`, the version in
`packages/misskey-js/package.json`, and the annotated Git tag must be exactly
the same. Development versions may use a `-dev` suffix, but must not be
published as releases. Run the local check before tagging:

```bash
node scripts/check-release-version.mjs 2025.5.2-lomia.1
```

Keep the fork suffix in the tag and package version. Do not reuse an upstream
or Misskey tag: tags are not scoped by remote. Create the release tag only
after the GitHub CI checks are green, and make it annotated:

```bash
git fetch --tags origin
git tag -a 2025.5.2-lomia.1 <release-commit> -m 'Release 2025.5.2-lomia.1'
git push origin 2025.5.2-lomia.1
```

The release workflow accepts a matching pushed tag or an explicitly supplied
tag in a manual run. A normal branch push or pull request never publishes to
GHCR. The workflow intentionally publishes only the immutable version tag and
the full-commit `sha-<commit>` tag; it does not move `latest` or `stable`.

## Forgejo and GitHub mirror flow

1. Update `develop` from the upstream remote using the merge procedure in
   `CONTRIBUTING.Sharkey.md`, resolve fork-specific changes, and regenerate
   generated assets as required.
2. Mirror the tested commit to GitHub. GitHub CI runs the frozen
   install, full workspace build, ESLint, frontend tests, and the targeted
   backend remote-reaction E2E selection.
3. Keep `.gitlab-ci.yml` as a reference for the existing full build/test and
   security coverage. If a Forgejo Actions runner is added later, port those
   jobs and require both the protected Forgejo pipeline and GitHub CI as
   release gates.
4. Update both package versions, run `check-release-version.mjs`, and wait for
   GitHub CI to pass.
5. Create and push the annotated tag from the exact release commit. Confirm
   that the release workflow validates the tag and pushes both GHCR tags.

The GitHub checkout must fetch tags. `scripts/build-pre.js` uses
`git tag --points-at HEAD`; a shallow or tag-less checkout makes a tagged build
look like a development build and adds a `+g<sha>` runtime version.

## Image deployment

Deploy the GHCR image by digest, not by a moving channel tag:

```text
ghcr.io/<owner>/<repository>@sha256:<digest>
```

Record the digest, source commit, package version, and deployment time. Keep
the previous digest available for a quick application rollback. The Docker
image starts with `pnpm run migrateandstart`, so a rollback must account for
database migrations rather than only replacing the container.

## Backup and rollback

Before deploying a release:

1. Take and verify a PostgreSQL backup or snapshot.
2. Record the currently running image digest and migration state.
3. Deploy the new digest to a canary or a single instance and check health,
   login, posting, federation, and media paths.
4. Promote it only after the checks pass.

For a failure, switch the deployment back to the recorded previous digest and
inspect application and migration logs. Only roll back the database when a
verified backup is available and the migration is known to be safely
reversible. For an irreversible migration, restore the database snapshot or
ship a forward-fix release; never blindly downgrade migrations.

## Changelog and upstream maintenance

Keep upstream changelog entries when merging upstream, and add the fork's
user-visible changes to the release notes under the fork-owned version. Avoid
rewriting upstream history merely to make the fork appear to be an upstream
release. Preserve the generated-file regeneration steps and the documented
Misskey-to-Sharkey merge checks in `CONTRIBUTING.Sharkey.md`.
