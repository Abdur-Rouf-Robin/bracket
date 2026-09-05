#!/usr/bin/env bash
# Make bracket.arrobin.com live — same flow as anime (nginx + certbot + PM2).
# Prerequisite: DNS A record bracket.arrobin.com → 27.147.128.177
set -euo pipefail

ROOT=/var/www/bracket
DOMAIN=bracket.arrobin.com

echo "==> Isolated Postgres for Bracket only (does not touch VMS or Anemi)"
"${ROOT}/deploy/setup-postgres.sh"

echo "==> Prisma migrate"
cd "${ROOT}"
npm run prisma:deploy -w @bracket/api

echo "==> nginx site"
sudo cp "${ROOT}/deploy/nginx-bracket.site.conf" /etc/nginx/sites-available/bracket
sudo ln -sfn /etc/nginx/sites-available/bracket /etc/nginx/sites-enabled/bracket
sudo nginx -t
sudo systemctl reload nginx

echo "==> Let's Encrypt HTTPS"
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --redirect --register-unsafely-without-email

echo "==> PM2"
pm2 start "${ROOT}/deploy/ecosystem.config.cjs" || pm2 restart bracket-api bracket-web
pm2 save

echo "https://${DOMAIN} is live."
