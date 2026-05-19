#!/bin/bash
PSQL='docker exec coolify-db psql -U coolify -d coolify -t -A'
$PSQL -c "SELECT id, name, git_repository, build_pack, dockerfile, dockerfile_location, ports_exposes, health_check_path, environment_id FROM applications WHERE id IN (2,3);"
$PSQL -c "SELECT id, key, value FROM environment_variables WHERE resourceable_type LIKE '%Application%' AND resourceable_id=2 LIMIT 30;" 2>/dev/null || \
$PSQL -c "\d environment_variables" 
