#!/usr/bin/env bash
# Rebuild changed apps and reload PM2 — your deploy loop:
#   edit code → ./scripts/pm2-restart-bracket.sh → hard refresh browser
#
# Optional env:
#   BRACKET_FORCE_REBUILD=1   rebuild packages + api + web even if unchanged
#   BRACKET_BUILD=api         only rebuild the API (then reload PM2)
#   BRACKET_BUILD=web         only rebuild the web app (then reload PM2)
#   BRACKET_BUILD=all         rebuild both (default; skips unchanged sides)
#
# Run from repo root: ./scripts/pm2-restart-bracket.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export NPM_CONFIG_LOGLEVEL="${NPM_CONFIG_LOGLEVEL:-warn}"

# Always talk to the user daemon that already runs bracket-api / bracket-web.
# A relative PM2_HOME (or a Cursor worktree) can spawn an empty second daemon
# that then fails with EADDRINUSE on 4200/3200.
export PM2_HOME="${PM2_HOME:-$HOME/.pm2}"

# Do not source .env — PM2 ports come from deploy/ecosystem.config.cjs.
unset PORT HOST

API_PORT=4200
WEB_PORT=3200
BRACKET_BUILD="${BRACKET_BUILD:-all}"

echo "[pm2-restart-bracket] repo: $ROOT"

ensure_node_path() {
  if command -v npm >/dev/null 2>&1 && command -v pm2 >/dev/null 2>&1; then
    return 0
  fi
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi
  if command -v npm >/dev/null 2>&1 && command -v pm2 >/dev/null 2>&1; then
    return 0
  fi
  local latest
  latest="$(find "${NVM_DIR:-$HOME/.nvm}/versions/node" -maxdepth 1 -type d -name 'v*' 2>/dev/null \
    | sort -V | tail -1)"
  if [[ -n "$latest" && -x "${latest}/bin/npm" ]]; then
    PATH="${latest}/bin:$PATH"
    export PATH
  fi
  if ! command -v npm >/dev/null 2>&1; then
    echo "[pm2-restart-bracket] ERROR: npm not in PATH." >&2
    exit 1
  fi
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "[pm2-restart-bracket] ERROR: pm2 not in PATH. Run: npm install -g pm2" >&2
    exit 1
  fi
}

pm2_app_online() {
  pm2 describe "$1" >/dev/null 2>&1
}

any_path_newer_than() {
  local marker="$1"
  shift
  [[ -e "$marker" ]] || return 0
  find "$@" -type f -newer "$marker" -print -quit 2>/dev/null | grep -q .
}

needs_packages_build() {
  if [[ "${BRACKET_FORCE_REBUILD:-}" == "1" ]]; then
    return 0
  fi
  local marker="$ROOT/packages/shared/dist/index.js"
  [[ -f "$marker" && -f "$ROOT/packages/bracket-engine/dist/index.js" ]] || return 0
  any_path_newer_than "$marker" \
    "$ROOT/packages/shared/src" \
    "$ROOT/packages/shared/package.json" \
    "$ROOT/packages/shared/tsconfig.json" \
    || any_path_newer_than "$ROOT/packages/bracket-engine/dist/index.js" \
      "$ROOT/packages/bracket-engine/src" \
      "$ROOT/packages/bracket-engine/package.json" \
      "$ROOT/packages/bracket-engine/tsconfig.json"
}

needs_api_build() {
  if [[ "${BRACKET_FORCE_REBUILD:-}" == "1" ]]; then
    return 0
  fi
  if [[ "$BRACKET_BUILD" == "web" ]]; then
    return 1
  fi
  if [[ "$BRACKET_BUILD" == "api" ]]; then
    return 0
  fi
  local marker="$ROOT/apps/api/dist/main.js"
  [[ -f "$marker" ]] || return 0
  any_path_newer_than "$marker" \
    "$ROOT/apps/api/src" \
    "$ROOT/apps/api/prisma/schema.prisma" \
    "$ROOT/apps/api/prisma/migrations" \
    "$ROOT/apps/api/tsconfig.json" \
    "$ROOT/apps/api/nest-cli.json" \
    "$ROOT/apps/api/package.json" \
    "$ROOT/packages/shared/src" \
    "$ROOT/packages/bracket-engine/src" \
    "$ROOT/package.json"
}

needs_web_build() {
  if [[ "${BRACKET_FORCE_REBUILD:-}" == "1" ]]; then
    return 0
  fi
  if [[ "$BRACKET_BUILD" == "api" ]]; then
    return 1
  fi
  if [[ "$BRACKET_BUILD" == "web" ]]; then
    return 0
  fi
  local marker="$ROOT/apps/web/.next/BUILD_ID"
  [[ -f "$marker" ]] || return 0
  any_path_newer_than "$marker" \
    "$ROOT/apps/web/src" \
    "$ROOT/apps/web/public" \
    "$ROOT/apps/web/.env.local" \
    "$ROOT/apps/web/next.config.ts" \
    "$ROOT/apps/web/tsconfig.json" \
    "$ROOT/apps/web/package.json" \
    "$ROOT/packages/shared/src" \
    "$ROOT/package.json"
}

fix_ownership() {
  local me target
  me="$(id -un)"
  for target in "$@"; do
    [[ -e "$target" ]] || continue
    if find "$target" ! -user "$me" -print -quit 2>/dev/null | grep -q .; then
      if sudo -n true 2>/dev/null; then
        sudo chown -R "${me}:${me}" "$@" 2>/dev/null || true
      else
        echo "[pm2-restart-bracket] NOTE: some files are not owned by ${me}." >&2
        echo "[pm2-restart-bracket]       Run once: sudo chown -R ${me}:${me} ${ROOT}" >&2
      fi
      return 0
    fi
  done
}

build_packages() {
  echo "[pm2-restart-bracket] building packages..."
  cd "$ROOT"
  npm run build:packages
}

build_api() {
  echo "[pm2-restart-bracket] building api..."
  cd "$ROOT/apps/api"
  fix_ownership dist node_modules
  if any_path_newer_than "$ROOT/node_modules/.prisma/client/index.js" \
    "$ROOT/apps/api/prisma/schema.prisma" 2>/dev/null \
    || [[ ! -f "$ROOT/node_modules/.prisma/client/index.js" ]]; then
    echo "[pm2-restart-bracket] prisma generate..."
    npm run prisma:generate
  fi
  npm run build
}

build_web() {
  echo "[pm2-restart-bracket] building web..."
  cd "$ROOT/apps/web"
  fix_ownership .next node_modules
  npm run build
}

free_port() {
  local p="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${p}/tcp" >/dev/null 2>&1 || true
  fi
}

port_busy() {
  local p="$1"
  ss -ltn "( sport = :${p} )" 2>/dev/null | grep -q ":${p}\\b"
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local i
  for i in $(seq 1 20); do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      echo "[pm2-restart-bracket] ${label} ready (${url})"
      return 0
    fi
    sleep 0.5
  done
  echo "[pm2-restart-bracket] WARN: ${label} not responding yet at ${url}" >&2
  return 1
}

ensure_node_path

BUILD_PACKAGES=false
BUILD_API=false
BUILD_WEB=false
if needs_packages_build; then BUILD_PACKAGES=true; fi
if needs_api_build; then BUILD_API=true; fi
if needs_web_build; then BUILD_WEB=true; fi
if [[ "$BUILD_API" == true || "$BUILD_WEB" == true ]]; then
  if needs_packages_build || [[ "${BRACKET_FORCE_REBUILD:-}" == "1" ]]; then
    BUILD_PACKAGES=true
  fi
fi

if [[ "$BUILD_PACKAGES" == false && "$BUILD_API" == false && "$BUILD_WEB" == false ]]; then
  echo "[pm2-restart-bracket] no source changes detected — skipping build (use BRACKET_FORCE_REBUILD=1 to force)"
else
  echo "[pm2-restart-bracket] rebuild plan: packages=$BUILD_PACKAGES api=$BUILD_API web=$BUILD_WEB"
  SECONDS=0
  if [[ "$BUILD_PACKAGES" == true ]]; then
    build_packages
  fi
  if [[ "$BUILD_API" == true && "$BUILD_WEB" == true ]]; then
    build_api &
    api_pid=$!
    build_web &
    web_pid=$!
    wait "$api_pid"
    wait "$web_pid"
  elif [[ "$BUILD_API" == true ]]; then
    build_api
  elif [[ "$BUILD_WEB" == true ]]; then
    build_web
  fi
  echo "[pm2-restart-bracket] build finished in ${SECONDS}s"
fi

cd "$ROOT"

PM2_ONLINE=false
if pm2_app_online bracket-api && pm2_app_online bracket-web; then
  PM2_ONLINE=true
fi

if [[ "$PM2_ONLINE" == true ]]; then
  echo "[pm2-restart-bracket] reloading PM2 apps..."
  pm2 reload bracket-api --update-env
  pm2 reload bracket-web --update-env
else
  echo "[pm2-restart-bracket] PM2 apps not running — freeing ports and starting fresh..."
  free_port "$API_PORT"
  free_port "$WEB_PORT"
  sleep 0.5
  if port_busy "$API_PORT" || port_busy "$WEB_PORT"; then
    echo "[pm2-restart-bracket] ports still busy — stop whatever is on ${API_PORT}/${WEB_PORT} and retry." >&2
    exit 1
  fi
  pm2 start "$ROOT/deploy/ecosystem.config.cjs" --update-env
fi

pm2 save

wait_for_http "http://127.0.0.1:${API_PORT}/games" "api" || true
wait_for_http "http://127.0.0.1:${WEB_PORT}/" "web" || true

echo "[pm2-restart-bracket] status:"
pm2 status

echo "[pm2-restart-bracket] done — hard refresh https://bracket.arrobin.com (Ctrl+Shift+R)."
