#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -n "${SHARKEY_NIX_TEST_STATE_DIR:-}" ]]; then
	STATE_DIR="$SHARKEY_NIX_TEST_STATE_DIR"
elif [[ -n "${XDG_STATE_HOME:-}" ]]; then
	STATE_DIR="$XDG_STATE_HOME/sharkey-nix-test"
else
	STATE_DIR="$ROOT_DIR/.nix-test"
fi

if [[ "$STATE_DIR" != /* ]]; then
	STATE_DIR="$ROOT_DIR/$STATE_DIR"
fi

PG_PORT="${SHARKEY_NIX_TEST_PG_PORT:-55432}"
REDIS_PORT="${SHARKEY_NIX_TEST_REDIS_PORT:-56379}"
TEST_PORT="${SHARKEY_NIX_TEST_APP_PORT:-61812}"
TEST_DB="test-misskey"
DEV_DB="dev-misskey"
DEV_STARTED_POSTGRES=0
DEV_STARTED_REDIS=0

PGDATA="$STATE_DIR/postgres"
PGSOCKET="$STATE_DIR/postgres-socket"
PGLOG="$STATE_DIR/postgres.log"
REDIS_DIR="$STATE_DIR/redis"
REDIS_PID="$STATE_DIR/redis.pid"
REDIS_LOG="$STATE_DIR/redis.log"
CONFIG_DIR="$STATE_DIR/config"
CONFIG_FILE="$CONFIG_DIR/test.yml"
MEDIA_DIR="$STATE_DIR/files"
DEV_LOCK_FILE="$STATE_DIR/dev-session.lock"
DEV_LOCK_OWNER_FILE="$STATE_DIR/dev-session.lock.owner"
DEV_LOCK_FD=""
DEV_LOCK_OWNED=0

die() {
	echo "nix test environment: $*" >&2
	exit 1
}

note() {
	echo "nix test environment: $*" >&2
}

acquire_dev_session_lock() {
	local operation="${1:-development session}"
	exec {DEV_LOCK_FD}>>"$DEV_LOCK_FILE"
	if ! flock -n "$DEV_LOCK_FD"; then
		local owner_pid=''
		read -r owner_pid < "$DEV_LOCK_OWNER_FILE" 2>/dev/null || true
		if [[ "$owner_pid" =~ ^[0-9]+$ ]] && kill -0 "$owner_pid" 2>/dev/null; then
			die "$operation cannot run while development session PID $owner_pid is active; URL: http://127.0.0.1:$TEST_PORT"
		fi
		die "$operation cannot run: development session lock is held by another process (recorded PID: ${owner_pid:-unknown})"
	fi
	local owner_tmp="$DEV_LOCK_OWNER_FILE.$$"
	printf '%s\n' "$$" > "$owner_tmp"
	mv -f "$owner_tmp" "$DEV_LOCK_OWNER_FILE"
	DEV_LOCK_OWNED=1
}

release_dev_session_lock() {
	if (( DEV_LOCK_OWNED == 1 )); then
		rm -f "$DEV_LOCK_OWNER_FILE"
		flock -u "$DEV_LOCK_FD" || true
		eval "exec ${DEV_LOCK_FD}>&-"
		DEV_LOCK_OWNED=0
	fi
}

case "$STATE_DIR" in
	"$ROOT_DIR"/*)
		;;
	"${XDG_STATE_HOME:-__no_xdg_state_home__}"/*)
		;;
	*)
		die "state directory must be under the repository or XDG_STATE_HOME: $STATE_DIR"
		;;
esac
[[ "$STATE_DIR" != "/" && "$STATE_DIR" != "$ROOT_DIR" ]] || die "refusing unsafe state directory: $STATE_DIR"
validate_port() {
	local name="$1"
	local value="$2"
	[[ "$value" =~ ^[0-9]+$ ]] || die "$name must be numeric (got: $value)"
	(( 10#$value >= 1 && 10#$value <= 65535 )) || die "$name must be between 1 and 65535 (got: $value)"
}

validate_port SHARKEY_NIX_TEST_PG_PORT "$PG_PORT"
validate_port SHARKEY_NIX_TEST_REDIS_PORT "$REDIS_PORT"
validate_port SHARKEY_NIX_TEST_APP_PORT "$TEST_PORT"
PG_PORT=$((10#$PG_PORT))
REDIS_PORT=$((10#$REDIS_PORT))
TEST_PORT=$((10#$TEST_PORT))
[[ "$PG_PORT" != "$REDIS_PORT" && "$PG_PORT" != "$TEST_PORT" && "$REDIS_PORT" != "$TEST_PORT" ]] || die "PostgreSQL, Redis, and app ports must be different"

mkdir -p "$STATE_DIR" "$CONFIG_DIR" "$MEDIA_DIR" "$REDIS_DIR"

write_config() {
	local config_file="$1"
	local database="$2"
	local url="$3"
	cat > "$config_file" <<EOF
url: '$url'
port: $TEST_PORT
address: '127.0.0.1'
setupPassword: nix_test_only

db:
  host: 127.0.0.1
  port: $PG_PORT
  db: $database
  user: postgres
  pass: ''

redis:
  host: 127.0.0.1
  port: $REDIS_PORT
  pass: ''

id: aidx
mediaDirectory: '$MEDIA_DIR'
EOF
}

init_postgres() {
	if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
		[[ ! -e "$PGDATA" || -z "$(find "$PGDATA" -mindepth 1 -maxdepth 1 -print -quit)" ]] || die "PostgreSQL state is not an empty initialized directory: $PGDATA"
		initdb --no-locale --encoding=UTF8 --auth=trust --username=postgres "$PGDATA" >/dev/null
		note "initialized PostgreSQL data at $PGDATA"
	fi
	mkdir -p "$PGSOCKET"
}

ensure_database() {
	local database="$1"
	if ! psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$database'" | grep -q '^1$'; then
		createdb -h 127.0.0.1 -p "$PG_PORT" -U postgres "$database"
	fi
}

postgres_owned_running() {
	pg_ctl -D "$PGDATA" status >/dev/null 2>&1
}

redis_process_running() {
	[[ -s "$REDIS_PID" ]] || return 1
	local pid
	pid="$(<"$REDIS_PID")"
	[[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null
}

redis_owned_running() {
	redis_process_running || return 1
	redis-cli -h 127.0.0.1 -p "$REDIS_PORT" ping 2>/dev/null | grep -q '^PONG$'
}

start_postgres() {
	if postgres_owned_running; then
		if pg_isready -h 127.0.0.1 -p "$PG_PORT" -U postgres >/dev/null 2>&1; then
			note "PostgreSQL already running on 127.0.0.1:$PG_PORT"
		else
			die "PostgreSQL from this state directory is running on another port; stop it before changing SHARKEY_NIX_TEST_PG_PORT"
		fi
		return
	fi
	if pg_isready -h 127.0.0.1 -p "$PG_PORT" -U postgres >/dev/null 2>&1; then
		die "port $PG_PORT is already in use by a PostgreSQL server outside $PGDATA"
	fi
	pg_ctl -D "$PGDATA" -o "-p $PG_PORT -h 127.0.0.1 -k $PGSOCKET" -l "$PGLOG" -w start >/dev/null
	DEV_STARTED_POSTGRES=1
	for _ in {1..60}; do
		pg_isready -h 127.0.0.1 -p "$PG_PORT" -U postgres >/dev/null 2>&1 && break
		sleep 0.2
	done
	pg_isready -h 127.0.0.1 -p "$PG_PORT" -U postgres >/dev/null 2>&1 || die "PostgreSQL did not become ready; see $PGLOG"

	ensure_database "$TEST_DB"
	ensure_database "$DEV_DB"
	note "PostgreSQL ready on 127.0.0.1:$PG_PORT (databases $TEST_DB, $DEV_DB)"
}

start_redis() {
	if redis_process_running; then
		if redis_owned_running; then
			note "Redis already running on 127.0.0.1:$REDIS_PORT"
		else
			die "Redis from this state directory is running on another port; stop it before changing SHARKEY_NIX_TEST_REDIS_PORT"
		fi
		return
	fi
	if redis_owned_running; then
		note "Redis already running on 127.0.0.1:$REDIS_PORT"
		return
	fi
	if redis-cli -h 127.0.0.1 -p "$REDIS_PORT" ping >/dev/null 2>&1; then
		die "port $REDIS_PORT is already in use by a Redis server outside $STATE_DIR"
	fi
	redis-server \
		--bind 127.0.0.1 \
		--protected-mode yes \
		--port "$REDIS_PORT" \
		--dir "$REDIS_DIR" \
		--dbfilename dump.rdb \
		--save "" \
		--appendonly no \
		--daemonize yes \
		--pidfile "$REDIS_PID" \
		--logfile "$REDIS_LOG" >/dev/null
	DEV_STARTED_REDIS=1
	for _ in {1..60}; do
		redis-cli -h 127.0.0.1 -p "$REDIS_PORT" ping 2>/dev/null | grep -q '^PONG$' && break
		sleep 0.2
	done
	redis_owned_running || die "Redis did not become ready; see $REDIS_LOG"
	note "Redis ready on 127.0.0.1:$REDIS_PORT"
}

init_environment() {
	init_postgres
	write_config "$CONFIG_FILE" "$TEST_DB" 'http://misskey.local'
	note "test config: $CONFIG_FILE"
}

DEV_CONFIG_FILE="$CONFIG_DIR/dev.yml"

init_dev_environment() {
	init_postgres
	write_config "$DEV_CONFIG_FILE" "$DEV_DB" "http://127.0.0.1:$TEST_PORT"
	note "development config: $DEV_CONFIG_FILE"
}

start_environment() {
	init_environment
	start_postgres
	start_redis
}

stop_environment() {
	if postgres_owned_running; then
		pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null
		note "stopped PostgreSQL"
	fi
	if redis_owned_running; then
		redis-cli -h 127.0.0.1 -p "$REDIS_PORT" shutdown nosave >/dev/null
		note "stopped Redis"
	fi
}

stop_dev_environment() {
	local exit_status=$?
	if (( DEV_STARTED_POSTGRES == 1 )) && postgres_owned_running; then
		pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null || true
		note "stopped PostgreSQL"
	fi
	if (( DEV_STARTED_REDIS == 1 )) && redis_owned_running; then
		redis-cli -h 127.0.0.1 -p "$REDIS_PORT" shutdown nosave >/dev/null || true
		note "stopped Redis"
	fi
	return "$exit_status"
}

cleanup_dev_environment() {
	local exit_status=$?
	stop_dev_environment || true
	release_dev_session_lock
	return "$exit_status"
}

status_environment() {
	local postgres_status=stopped
	local redis_status=stopped
	postgres_owned_running && postgres_status="running"
	redis_owned_running && redis_status="running"
	echo "state: $STATE_DIR"
	echo "postgres: $postgres_status (127.0.0.1:$PG_PORT, test-misskey)"
	echo "redis: $redis_status (127.0.0.1:$REDIS_PORT)"
	echo "config: $CONFIG_FILE"
}

run_with_test_env() {
	init_environment
	export NODE_ENV=test
	export MISSKEY_CONFIG_DIR="$CONFIG_DIR"
	export MISSKEY_CONFIG_YML=test.yml
	"$@"
}

run_with_dev_env() {
	init_dev_environment
	export NODE_ENV=development
	export MISSKEY_CONFIG_DIR="$CONFIG_DIR"
	export MISSKEY_CONFIG_YML=dev.yml
	"$@"
}

prepare_backend() {
	run_with_test_env pnpm --filter backend build:pre
	run_with_test_env pnpm --filter backend build
}

migrate_backend() {
	# Unit suites expect a dedicated, migrated database. Recreate only the
	# database owned by this test environment so a prior failed run cannot leave
	# a partially synchronized schema behind.
	dropdb -h 127.0.0.1 -p "$PG_PORT" -U postgres --if-exists --force "$TEST_DB" >/dev/null
	createdb -h 127.0.0.1 -p "$PG_PORT" -U postgres "$TEST_DB"
	run_with_test_env pnpm --filter backend migrate
}

migrate_dev_backend() {
	# Keep interactive development data persistent. Re-run only pending
	# migrations; if a migration fails, return the error without deleting data.
	ensure_database "$DEV_DB"
	run_with_dev_env pnpm --filter backend migrate
}

port_is_listening() {
	timeout 1 bash -c ": </dev/tcp/127.0.0.1/$TEST_PORT" >/dev/null 2>&1
}

reset_dev_database() {
	acquire_dev_session_lock "dev database reset"
	if port_is_listening; then
		release_dev_session_lock
		die "dev database reset refused: port $TEST_PORT is already in use; stop the running dev session first"
	fi

	trap cleanup_dev_environment EXIT
	init_dev_environment
	start_postgres
	dropdb -h 127.0.0.1 -p "$PG_PORT" -U postgres --if-exists --force "$DEV_DB" >/dev/null
	createdb -h 127.0.0.1 -p "$PG_PORT" -U postgres "$DEV_DB"
	note "reset dev database: $DEV_DB"
}

usage() {
	cat >&2 <<'EOF'
Usage:
  sharkey-nix-test <init|start|stop|reset-dev|status|env|prepare>
  sharkey-nix-test dev [pnpm dev arguments]
  sharkey-nix-test unit [Jest arguments]
  sharkey-nix-test e2e [Jest arguments]

  init    initialize isolated data and write the generated test config
  start   initialize and start PostgreSQL and Redis
  stop    stop only services owned by this test environment
  reset-dev  reset persistent dev-misskey (refuses active dev sessions)
  status     show service state and paths
  env        print shell exports (use: eval "$(sharkey-nix-test env)")
  prepare    build backend prerequisites and output for unit/E2E tests
  dev        run the local frontend/backend development server with isolated
             PostgreSQL, Redis, config, and a migrated dev-misskey database
  unit       start services, prepare backend, and run backend unit tests (args are passed to Jest)
  e2e        start services, build prerequisites, and run backend E2E tests (args are passed to Jest)
EOF
}

case "${1:-}" in
	init)
		init_environment
		;;
	start)
		start_environment
		;;
	stop)
		stop_environment
		;;
	status)
		status_environment
		;;
	env)
		init_environment >&2
		printf 'export NODE_ENV=test\n'
		printf 'export MISSKEY_CONFIG_DIR=%q\n' "$CONFIG_DIR"
		printf 'export MISSKEY_CONFIG_YML=test.yml\n'
		;;
	prepare)
		prepare_backend
		;;
	dev)
		shift
		acquire_dev_session_lock "development session"
		trap cleanup_dev_environment EXIT
		start_environment
		run_with_dev_env pnpm --filter backend build
		migrate_dev_backend
		note "starting development server; the first build can take a few minutes"
		note "URL: http://127.0.0.1:$TEST_PORT (wait for the backend and Vite watchers to report ready before opening it)"
		run_with_dev_env pnpm dev "$@"
		;;
	reset-dev)
		reset_dev_database
		;;
	unit)
		shift
		start_environment
		prepare_backend
		migrate_backend
		run_with_test_env pnpm --filter backend jest "$@"
		;;
	e2e)
		shift
		start_environment
		run_with_test_env pnpm --filter backend build:pre
		run_with_test_env pnpm --filter backend build
		run_with_test_env pnpm --filter backend build:test
		run_with_test_env pnpm --filter backend jest:e2e "$@"
		;;
	*)
		usage
		exit 2
		;;
esac
