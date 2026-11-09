#!/usr/bin/env bash
# Artakip PostgreSQL Günlük Yedekleme Betiği
# Crontab örneği (Her gece 03:30):
# 30 3 * * * /opt/artakip/deploy/backup.sh >> /var/log/artakip-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/artakip}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CONTAINER_NAME="${CONTAINER_NAME:-artakip-postgres}"
DB_USER="${POSTGRES_USER:-artakip}"
DB_NAME="${POSTGRES_DB:-artakip}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/artakip_${TIMESTAMP}.sql.gz"

echo "[$(date -Iseconds)] Yedekleme başlatılıyor: $BACKUP_FILE"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "[$(date -Iseconds)] ${RETENTION_DAYS} günden eski yedekler temizleniyor..."
find "$BACKUP_DIR" -type f -name "artakip_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "[$(date -Iseconds)] Yedekleme başarıyla tamamlandı."
