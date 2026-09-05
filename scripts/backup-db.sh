#!/usr/bin/env bash
# Dump the Bracket Postgres database to backups/bracket-YYYYMMDD-HHMMSS.sql.gz
#
# Usage (from repo root or anywhere):
#   ./scripts/backup-db.sh
#
# Env:
#   DATABASE_URL          connection string (otherwise read from apps/api/.env)
#   BRACKET_BACKUP_DIR    destination folder (default: <repo>/backups)
#   BRACKET_BACKUP_KEEP   number of dumps to keep (default: 14)
#
# Cron example (daily 03:15) — install with `crontab -e`, do not paste into bash:
#   15 3 * * * /var/www/bracket/scripts/backup-db.sh >> /var/www/bracket/backups/backup.log 2>&1

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="${BRACKET_BACKUP_DIR:-$ROOT/backups}"
KEEP="${BRACKET_BACKUP_KEEP:-14}"

# Prisma puts `?schema=public` on DATABASE_URL; libpq/pg_dump reject that key.
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

load_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    DATABASE_URL="$(sanitize_database_url "$DATABASE_URL")"
    export DATABASE_URL
    return 0
  fi
  local envf="$ROOT/apps/api/.env"
  if [[ ! -f "$envf" ]]; then
    echo "[backup-db] ERROR: DATABASE_URL is unset and $envf is missing." >&2
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
  DATABASE_URL="$(sanitize_database_url "$DATABASE_URL")"
  export DATABASE_URL
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "[backup-db] ERROR: DATABASE_URL not found in $envf." >&2
    exit 1
  fi
}

find_pg_dump() {
  if command -v pg_dump >/dev/null 2>&1; then
    command -v pg_dump
    return 0
  fi
  local candidate
  candidate="$(ls -1d /usr/lib/postgresql/*/bin/pg_dump 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    echo "$candidate"
    return 0
  fi
  echo "[backup-db] ERROR: pg_dump not found." >&2
  exit 1
}

load_database_url
PG_DUMP="$(find_pg_dump)"

mkdir -p "$DIR"
umask 077
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$DIR/bracket-${STAMP}.sql.gz"
TMP="$OUT.partial"

echo "[backup-db] writing $OUT"
"$PG_DUMP" --no-owner --no-acl --dbname="$DATABASE_URL" | gzip -c > "$TMP"
mv "$TMP" "$OUT"
date -u +%Y-%m-%dT%H:%M:%SZ > "$DIR/.last-ok"

# Prune older dumps; keep the newest $KEEP files.
mapfile -t OLD < <(ls -1t "$DIR"/bracket-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) || true)
if ((${#OLD[@]})); then
  rm -f "${OLD[@]}"
  echo "[backup-db] pruned ${#OLD[@]} old dump(s); keeping $KEEP"
fi

BYTES="$(wc -c < "$OUT" | tr -d ' ')"
echo "[backup-db] done (${BYTES} bytes)"
