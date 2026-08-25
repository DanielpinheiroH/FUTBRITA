#!/bin/sh
set -eu
umask 077

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_DB:?POSTGRES_DB não configurado}"
: "${POSTGRES_USER:?POSTGRES_USER não configurado}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD não configurado}"
: "${BACKUP_DIR:=/backups}"

export PGPASSWORD="$POSTGRES_PASSWORD"
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary="$BACKUP_DIR/daily/.futbrita-$timestamp.dump.tmp"
destination="$BACKUP_DIR/daily/futbrita-$timestamp.dump"

pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$temporary"
mv "$temporary" "$destination"

if [ "$(date -u +%u)" = "7" ]; then
  cp "$destination" "$BACKUP_DIR/weekly/futbrita-weekly-$timestamp.dump"
fi

find "$BACKUP_DIR/daily" -type f -name 'futbrita-*.dump' -mtime +6 -delete
find "$BACKUP_DIR/weekly" -type f -name 'futbrita-weekly-*.dump' -mtime +27 -delete
echo "Backup concluído: $destination"
