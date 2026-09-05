#!/usr/bin/env bash
# nginx + Let's Encrypt for bracket.arrobin.com (app and DB already running).
set -euo pipefail
ROOT=/var/www/bracket
DOMAIN=bracket.arrobin.com
sudo cp "${ROOT}/deploy/nginx-bracket.site.conf" /etc/nginx/sites-available/bracket
sudo ln -sfn /etc/nginx/sites-available/bracket /etc/nginx/sites-enabled/bracket
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --redirect --register-unsafely-without-email
echo "https://${DOMAIN} is live."
