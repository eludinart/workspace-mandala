#!/bin/bash
PSQL='docker exec coolify-db psql -U coolify -d coolify -t -A'

echo "=== standalone mariadb/mysql tables ==="
$PSQL -c "\dt" | grep -iE 'mariadb|mysql|mongo' || true

for t in standalone_mariadbs standalone_mysqls shared_environment_variables; do
  echo "--- $t ---"
  $PSQL -c "SELECT * FROM $t LIMIT 3;" 2>/dev/null | head -5 || echo "(no table)"
done

echo "=== env vars count mandala project ==="
$PSQL -c "SELECT COUNT(*) FROM environment_variables ev JOIN environments e ON e.id = ev.environment_id WHERE e.project_id = 10;"

echo "=== servers ==="
$PSQL -c "SELECT id, name, ip FROM servers;"

echo "=== github_apps ==="
$PSQL -c "SELECT id, name, installation_id FROM github_apps LIMIT 5;"
