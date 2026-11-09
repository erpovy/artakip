#!/usr/bin/env bash
# Artakip (artakip.artovy.com) Tek Komutluk VPS Kurulum Betiği
set -euo pipefail

DOMAIN="artakip.artovy.com"
APP_DIR="/opt/artakip"
REPO_URL="https://github.com/erpovy/artakip.git"

echo "=== Artakip ($DOMAIN) Kurulumu Başlatılıyor ==="

if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR" && git pull origin main
fi

cd "$APP_DIR"

if [ ! -f ".env" ]; then
  cp .env.example .env
  RAND_SECRET="$(openssl rand -hex 32)"
  RAND_DB_PASS="$(openssl rand -hex 16)"
  sed -i "s|change-me-in-production-to-a-32-char-random-secret|${RAND_SECRET}|g" .env
  sed -i "s|artakip_secret|${RAND_DB_PASS}|g" .env
  echo "POSTGRES_PASSWORD=${RAND_DB_PASS}" >> .env
  echo ".env dosyası otomatik güvenli anahtarlarla oluşturuldu."
fi

docker compose up -d --build

echo "Veritabanı başlangıç verileri (seed) yükleniyor..."
sleep 5
docker compose exec -T web npm run db:seed

echo "=== Kurulum Tamamlandı! Uygulama 127.0.0.1:3000 portunda çalışıyor ==="
echo "Nginx veya Caddy üzerinden $DOMAIN -> http://127.0.0.1:3000 yönlendirmesi yapabilirsiniz."
