#!/bin/bash
# Sur le VPS : expose MariaDB Mandala sur 127.0.0.1:3307 (Fleur reste sur 3306).
# Usage : ssh root@VPS 'bash -s' < scripts/setup-mariadb-tunnel-mandala.sh

CONTAINER="${MANDALA_DB_CONTAINER:-p11nw75ijqbg4lfzmwbw2m3m}"
NETWORK="coolify"

docker rm -f mariadb-tunnel-mandala 2>/dev/null
docker run -d --name mariadb-tunnel-mandala --restart unless-stopped \
  --network "$NETWORK" \
  -p 127.0.0.1:3307:3306 \
  alpine/socat \
  TCP-LISTEN:3306,fork,reuseaddr TCP:${CONTAINER}:3306

echo "Mandala : VPS 127.0.0.1:3307 -> ${CONTAINER}:3306"
docker ps --filter name=mariadb-tunnel-mandala
