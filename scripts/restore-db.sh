#!/usr/bin/env bash
# Restore a dump created by scripts/backup-db.sh.
# Refuses to run unless RESTORE=YES is set — this overwrites the live database.
#
# Usage:
#   RESTORE=YES ./scripts/restore-db.sh backups/bracket-20260905-061500.sql.gz

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${RESTORE:-}" != "YES" ]]; then
  echo "[restore-db] Refusing to run. Set RESTORE=YES if you intend to overwrite the database." >&2
  exit 1
fi

FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "[restore-db] Usage: RESTORE=YES $0 /path/to/bracket-YYYYMMDD-HHMMSS.sql.gz" >&2
  exit 1
fi

sanitize_database_url() {
  local url="$1"
  if [[ "$url" != *\?* ]]; then
    printf '%s' "$url"
    return 0
  fi
  local base="${url%%\?*}"
  local qs="${url#*\?}"
  local kept="" pair key
  IFS='&' read -ra parts <<< "$qs"
  for pair in "${parts[@]}"; do
    key="${pair%%=*}"
    case "$key" in
      schema|connection_limit|pool_timeout|pgbouncer|socket_timeout) continue ;;
    esac
    if [[ -n "$pair" ]]; then
      kept="${kept:+$kept&}$pair"
    fi
  done
  if [[ -n "$kept" ]]; then
    printf '%s?%s' "$base" "$kept"
  else
    printf '%s' "$base"
  fi
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  envf="$ROOT/apps/api/.env"
  if [[ ! -f "$envf" ]]; then
    echo "[restore-db] ERROR: DATABASE_URL is unset and $envf is missing." >&2
    exit 1
  fi
  DATABASE_URL="$(
    awk -F= '
      $1 == "DATABASE_URL" {
        val = substr($0, index($0, "=") + 1)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", val)
        if (val ~ /^".*"$/) { val = substr(val, 2, length(val) - 2) }
        else if (val ~ /^'\''.*'\''$/) { val = substr(val, 2, length(val) - 2) }
        print val
      }
    ' "$envf" | tail -1
  )"
  export DATABASE_URL
fi

DATABASE_URL="$(sanitize_database_url "${DATABASE_URL:-}")"
export DATABASE_URL

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[restore-db] ERROR: DATABASE_URL is empty." >&2
  exit 1
fi

PSQL="$(command -v psql || true)"
if [[ -z "$PSQL" ]]; then
  PSQL="$(ls -1d /usr/lib/postgresql/*/bin/psql 2>/dev/null | sort -V | tail -1 || true)"
fi
if [[ -z "$PSQL" || ! -x "$PSQL" ]]; then
  echo "[restore-db] ERROR: psql not found." >&2
  exit 1
fi

echo "[restore-db] restoring $FILE"
gzip -dc "$FILE" | "$PSQL" --dbname="$DATABASE_URL" -v ON_ERROR_STOP=1
echo "[restore-db] done"
