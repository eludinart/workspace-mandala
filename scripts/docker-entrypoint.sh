#!/bin/sh
set -e
echo "[mandala] PORT=${PORT:-3000} HOSTNAME=${HOSTNAME:-0.0.0.0}"
echo "[mandala] NODE_ENV=${NODE_ENV:-}"
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change_me_dev_mandala_only" ]; then
  echo "[mandala] ATTENTION: JWT_SECRET manquant ou valeur de dev — définir dans Coolify"
fi
if [ -z "$MARIADB_PASSWORD" ]; then
  echo "[mandala] ATTENTION: MARIADB_PASSWORD manquant — API DB échouera"
fi
exec node server.js
