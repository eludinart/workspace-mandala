#!/bin/bash
set -e
PSQL='docker exec coolify-db psql -U coolify -d coolify -t -A'

echo "=== Projects Mandala ==="
$PSQL -c "SELECT id, name, uuid FROM projects WHERE name ILIKE '%mandala%';"

echo "=== Environments Mandala-db ==="
$PSQL -c "SELECT e.id, e.name, e.project_id FROM environments e JOIN projects p ON p.id = e.project_id WHERE p.name ILIKE '%mandala%';"

echo "=== Databases (standalone) ==="
$PSQL -c "SELECT id, name, uuid, status FROM standalone_postgresqls LIMIT 1;" 2>/dev/null || true
$PSQL -c "\dt" | grep -i database || true

echo "=== service_databases ==="
$PSQL -c "SELECT id, name, uuid FROM service_databases LIMIT 10;" 2>/dev/null || true

echo "=== Applications ==="
$PSQL -c "SELECT id, name, git_repository, fqdn FROM applications;"

echo "=== Fleur dockerfile ==="
$PSQL -c "SELECT dockerfile, dockerfile_location, build_pack, ports_exposes FROM applications WHERE id=2;"
