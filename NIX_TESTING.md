# Nix backend test environment

This repository provides a reproducible Nix development shell for the Node.js
22 toolchain and backend test dependencies. The flake pins nixpkgs through
`flake.lock`; Corepack resolves the exact `pnpm` version declared by the root
`package.json` (`10.26.2`).

## Enter the shell

```bash
nix develop
node --version       # v22.x
pnpm --version       # 10.26.2
```

The shell includes PostgreSQL 17, Redis, Git, GCC, GNU Make, pkg-config,
Python, libuuid, and the native libraries used by dependencies such as `re2`
and `canvas`.

## Isolated PostgreSQL and Redis

Inside the Nix shell, use the helper below. It does not use system services or
Docker. By default all state is in the ignored repository directory
`.nix-test/`; when `XDG_STATE_HOME` is set it uses
`$XDG_STATE_HOME/sharkey-nix-test` instead. The default ports are deliberately
different from the usual 5432/6379: PostgreSQL uses 55432 and Redis uses 56379.

```bash
sharkey-nix-test start
sharkey-nix-test status
sharkey-nix-test stop
```

The helper refuses to start if either test port belongs to another service and
only stops processes that it started from its own state directory. It creates
separate `test-misskey` and `dev-misskey` databases and generates configs under
the state directory; it never overwrites `.config/test.yml` or existing
repository data.

To choose another explicitly scoped state directory or ports:

```bash
SHARKEY_NIX_TEST_STATE_DIR="$XDG_STATE_HOME/sharkey-test-branch" \
SHARKEY_NIX_TEST_PG_PORT=55433 \
SHARKEY_NIX_TEST_REDIS_PORT=56380 \
sharkey-nix-test start
```

## Backend tests

The commands start the isolated services and set `NODE_ENV=test`,
`MISSKEY_CONFIG_DIR`, and `MISSKEY_CONFIG_YML` for the child process:

```bash
sharkey-nix-test unit
sharkey-nix-test e2e
```

Arguments after `unit` or `e2e` are passed directly to the corresponding
backend Jest command, which makes focused runs reproducible. For example:

```bash
sharkey-nix-test unit test/unit/activitypub.ts --testNamePattern='ActivityPub'
sharkey-nix-test e2e test/e2e/endpoints.ts --testNamePattern='remote'
```

The second example targets the two remote-reaction cases in `endpoints.ts`;
it is not a request to run the complete E2E suite.

`unit` first runs `pnpm --filter backend build:pre` and `build`, recreates the
dedicated `test-misskey` database, and applies migrations, so it does not
depend on a pre-existing `built/` tree or a clean schema left by an earlier
failed run. Only the database under this helper's isolated PostgreSQL data
directory is recreated.
`e2e` runs `build:pre`, backend `build`, and `build:test` once, then invokes
`jest:e2e` directly. Use `prepare` when you want to build the unit-test
artifacts without running tests; it is safe to rerun but requires dependencies
to have been installed first.

After cloning, initialize the pinned frontend asset submodules and install the
locked workspace dependencies once before using `prepare`, `unit`, `e2e`, or a
frontend build:

```bash
git submodule update --init --depth=1
pnpm install --frozen-lockfile
```

## Local frontend/backend development

The repository's plain `pnpm dev` command expects a user-created
`.config/default.yml`, because it is intended for a real instance. For local
browser work, use the isolated helper instead:

```bash
sharkey-nix-test dev
```

It starts the helper-owned PostgreSQL and Redis, builds the backend, ensures the
persistent `dev-misskey` database exists and migrates it, and runs the normal root
development watchers with a generated config. Open only the backend-served
app at `http://127.0.0.1:61812`; Vite's server is an internal HMR dependency,
not the browser entry point. The generated development URL is
`http://127.0.0.1:61812`, so no `/etc/hosts` entry or production domain is
needed. The helper prints the URL and a not-ready notice before starting the
watchers; the first build may take a few minutes, so wait for the backend and
Vite watcher startup messages before opening the page. Extra arguments are
forwarded to `pnpm dev`.

Only one `sharkey-nix-test dev` session may use a state directory at a time.
A second invocation exits immediately with the existing session PID and URL;
it does not stop or reuse that session's PostgreSQL, Redis, or watchers. The
session lock is released automatically when the owning helper exits.

The dev database is persistent by default: local accounts, browser tokens,
uploaded-file metadata, and other development data survive a helper restart.

The notes search endpoint is intentionally disabled by the default role policy
(`canSearchNotes: false`). To test search in this disposable instance, open
the control panel, go to `Roles`, and enable `是否可以搜索帖子` under the base
role/default policy (the English label is `Can search notes`). This only changes
the isolated development database; do not change Sharkey's production default
policy just to make the test environment searchable.

Press Ctrl-C to stop the development process; the helper then stops only its
own PostgreSQL and Redis processes. The development database is
kept for the next `sharkey-nix-test dev` invocation, so browser tokens and
local setup survive restarts. To intentionally clear it, stop the dev session
and run:

```bash
sharkey-nix-test reset-dev
```

This is an explicit destructive operation targeting only `dev-misskey`; it
refuses to run while the dev URL is active and leaves `test-misskey` untouched.
After resetting, start `dev` again to run the pending migrations, then visit
`http://127.0.0.1:61812/flush` in the browser to clear its old local token.
Use `start`/`stop` and `env` separately when you want to manage services
manually or run a command other than the local development watchers.

The frontend build imports files from `fluent-emojis/dist` and
`tossface-emojis/dist`; without the submodule step those directories are empty
and Vite fails with an `ENOENT` asset error.

For an interactive shell with the same generated config:

```bash
eval "$(sharkey-nix-test env)"
pnpm --filter backend jest
```

## Verification status

The current checkout has been verified with:

- `nix flake check --all-systems --no-build` passing.
- `nix develop` providing Node.js `v22.22.2`, pnpm `10.26.2`, PostgreSQL
  `17.10`, and Redis `8.6.4`.
- `re2` and `canvas` loading successfully from the backend workspace under
  the Nix shell.
- The ActivityPub unit selection passing 48/48 tests.
- The remote-reaction E2E selection passing 2/2 tests via `testNamePattern`.
  This is a targeted E2E selection and does not mean the complete E2E suite
  has passed.

E2E tests still require the normal Sharkey build steps performed by
`packages/backend`'s `test:e2e` script, and tests that contact external
ActivityPub/S3/SMTP services remain dependent on those services. `nix develop`
also needs network access the first time Corepack downloads pnpm and when pnpm
installs project dependencies.
