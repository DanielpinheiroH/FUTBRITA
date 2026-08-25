#!/bin/sh
set -eu

backup_path="${1:?Uso: restore-backup.sh CAMINHO_BACKUP BANCO_TEMPORARIO}"
target_database="${2:?Informe um banco temporário com prefixo futbrita_restore_}"
: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_DB:?POSTGRES_DB não configurado}"
: "${POSTGRES_USER:?POSTGRES_USER não configurado}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD não configurado}"

case "$target_database" in
  futbrita_restore_*) ;;
  *) echo "Recusado: o banco de destino deve começar com futbrita_restore_." >&2; exit 2 ;;
esac
[ "$target_database" != "$POSTGRES_DB" ] || { echo "Recusado: nunca restaure sobre o banco principal." >&2; exit 2; }
[ -f "$backup_path" ] || { echo "Backup não encontrado: $backup_path" >&2; exit 2; }

export PGPASSWORD="$POSTGRES_PASSWORD"
cleanup() {
  dropdb -h "$POSTGRES_HOST" -U "$POSTGRES_USER" --if-exists "$target_database"
}
trap cleanup EXIT INT TERM

cleanup
createdb -h "$POSTGRES_HOST" -U "$POSTGRES_USER" "$target_database"
pg_restore -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$target_database" --no-owner --no-privileges "$backup_path"

tables="$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$target_database" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('admins','jogadores','rodadas','partidas','gols')")"
[ "$tables" = "5" ] || { echo "Restore inválido: tabelas essenciais ausentes ($tables/5)." >&2; exit 1; }
echo "Restore validado em $target_database; o banco temporário será removido."
