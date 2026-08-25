#!/bin/sh
set -eu

project_dir="${FUTBRITA_DIR:-/opt/futbrita}"
[ -d "$project_dir/.git" ] || { echo "Repositório FUTBRITA não encontrado em $project_dir" >&2; exit 1; }
cd "$project_dir"
[ -f docker-compose.prod.yml ] || { echo "Compose de produção do FUTBRITA não encontrado." >&2; exit 1; }
[ -f .env.production ] || { echo ".env.production ausente." >&2; exit 1; }

git pull --ff-only origin main
docker compose -p futbrita -f docker-compose.prod.yml config --quiet
docker compose -p futbrita -f docker-compose.prod.yml build api
docker compose -p futbrita -f docker-compose.prod.yml up -d postgres
docker compose -p futbrita -f docker-compose.prod.yml run --rm backup sh /scripts/backup-postgres.sh --once
docker compose -p futbrita -f docker-compose.prod.yml run --rm api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose -p futbrita -f docker-compose.prod.yml run --rm api npm run db:seed -w @fut-brita/api
docker compose -p futbrita -f docker-compose.prod.yml up -d --no-deps api
docker compose -p futbrita -f docker-compose.prod.yml up -d caddy backup

attempt=0
until docker compose -p futbrita -f docker-compose.prod.yml exec -T api node -e "fetch('http://127.0.0.1:3333/api/health').then(async r=>{const b=await r.json();if(!r.ok||b.database!=='connected')process.exit(1)}).catch(()=>process.exit(1))"; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 12 ] || { docker compose -p futbrita -f docker-compose.prod.yml logs --tail=100 api; exit 1; }
  sleep 5
done

docker compose -p futbrita -f docker-compose.prod.yml ps
