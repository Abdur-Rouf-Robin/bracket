#!/usr/bin/env bash
# Create Bracket's OWN Postgres cluster — completely separate from VMS and Anemi.
#
#   VMS    → cluster 18/main   port 5432  data /var/lib/postgresql/18/main
#   Anemi  → cluster 18/anemi  port 5434  data /var/lib/postgresql/18/anemi
#   Bracket→ cluster 18/bracket port 5433 data /var/lib/postgresql/18/bracket
#
# Dropping or deleting one cluster/folder cannot affect the other two.
set -euo pipefail

DB_USER=bracket
DB_NAME=bracket
DB_PASS=7e3d107489c325bc0df1f1c167feedf5
DB_PORT=5433

echo "==> Postgres cluster 18/bracket on ${DB_PORT} (isolated from VMS 5432 and Anemi 5434)"
if pg_lsclusters | awk '{print $1,$2}' | grep -qx '18 bracket'; then
  echo "    already exists"
else
  sudo pg_createcluster 18 bracket -p "${DB_PORT}" --start
fi

# Lock to localhost only (same as VMS).
CONF="/etc/postgresql/18/bracket/postgresql.conf"
if sudo test -f "${CONF}"; then
  if sudo grep -qE "^#?listen_addresses" "${CONF}"; then
    sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost'/" "${CONF}"
  else
    echo "listen_addresses = 'localhost'" | sudo tee -a "${CONF}" >/dev/null
  fi
  sudo pg_ctlcluster 18 bracket reload || sudo pg_ctlcluster 18 bracket restart
fi

sudo -u postgres psql -p "${DB_PORT}" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo "==> Isolated databases on this server:"
pg_lsclusters
echo "Bracket DATABASE_URL uses 127.0.0.1:${DB_PORT}/${DB_NAME} only."
