#!/usr/bin/env bash
# Issue HTTPS for one community hostname that already points at this server.
# Usage (as root): ./deploy/enable-custom-domain.sh <hostname-you-own>
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" || "$DOMAIN" == *"/"* || "$DOMAIN" == *" "* || "$DOMAIN" == "localhost" || "$DOMAIN" != *.* \
  || "$DOMAIN" == "example.com" || "$DOMAIN" == *.example.com || "$DOMAIN" == *.example \
  || "$DOMAIN" == "yourclub.com" || "$DOMAIN" == *.yourclub.com ]]; then
  echo "Usage: sudo $0 <hostname-you-own>" >&2
  echo "Pass a hostname you control. The sample names in these messages are not yours." >&2
  exit 1
fi

EXPECTED="${SERVER_PUBLIC_IP:-}"
if [[ -z "$EXPECTED" ]]; then
  EXPECTED="$(getent ahostsv4 bracket.arrobin.com | awk '{print $1; exit}' || true)"
fi
RESOLVED="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u | paste -sd, - || true)"
if [[ -z "$EXPECTED" || -z "$RESOLVED" || ",$RESOLVED," != *",$EXPECTED,"* ]]; then
  echo "Refusing to request a certificate for ${DOMAIN}." >&2
  echo "It resolves to: ${RESOLVED:-nothing}" >&2
  echo "This server is: ${EXPECTED:-unknown} (same address as bracket.arrobin.com)." >&2
  echo "Create an A record for ${DOMAIN} pointing at that address, wait for DNS, then run this again." >&2
  exit 1
fi

CONF="/etc/nginx/sites-available/bracket-custom-${DOMAIN}"
cat > "$CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 10m;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4200/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /backend/ {
        proxy_pass http://127.0.0.1:4200/;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -sfn "$CONF" "/etc/nginx/sites-enabled/bracket-custom-${DOMAIN}"
nginx -t
systemctl reload nginx

mkdir -p /var/www/certbot
if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
else
  echo "nginx is serving http://${DOMAIN}. Install certbot to add HTTPS."
fi
