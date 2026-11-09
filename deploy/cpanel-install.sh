#!/usr/bin/env bash
# cPanel (CloudLinux) artakip.artovy.com Tek Komutluk Kurulum Betiği
set -euo pipefail

export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$PATH"
export UV_THREADPOOL_SIZE=2
export RAYON_NUM_THREADS=1
export NODE_OPTIONS="--max-old-space-size=1536"

APP_DIR="$HOME/artakip.artovy.com"
REPO_URL="https://github.com/erpovy/artakip.git"

echo "=== 1. Node.js ve NPM Sürümleri Kontrol Ediliyor ==="
node -v
npm -v

echo "=== 2. Uygulama Klasörü Hazırlanıyor ($APP_DIR) ==="
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -d ".git" ]; then
  rm -rf cgi-bin .htaccess index.html 2>/dev/null || true
  git init -b main
  git remote add origin "$REPO_URL"
fi

git fetch origin main
git reset --hard origin/main

RAND_SECRET="$(openssl rand -hex 32)"
cat > .env <<EOF
DATABASE_URL="file:./artakip.db"
NEXTAUTH_URL="https://artakip.artovy.com"
NEXT_PUBLIC_APP_URL="https://artakip.artovy.com"
NEXTAUTH_SECRET="${RAND_SECRET}"
ADMIN_EMAIL="admin@artovy.com"
ADMIN_PASSWORD="AdminPassword123!"
SMTP_HOST="mail.artovy.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="bildirim@artovy.com"
SMTP_PASS=""
SMTP_FROM="Artakip Uptime <bildirim@artovy.com>"
EOF
echo ".env dosyası güncellendi."

echo "=== 3. Paketler Yükleniyor (npm install) ==="
npm install --no-audit --no-fund

echo "=== 4. Veritabanı (SQLite) ve Admin Kullanıcısı Hazırlanıyor ==="
npx prisma generate
npx prisma db push
npm run db:seed

echo "=== 5. Next.js Üretim Derlemesi (npm run build) ==="
npm run build

echo "================================================================"
echo "✅ KURULUM TAMAMLANDI!"
echo "Şimdi cPanel -> Setup Node.js App ekranından:"
echo "  - Node.js version: 20.x"
echo "  - Application mode: Production"
echo "  - Application root: artakip.artovy.com"
echo "  - Application URL: artakip.artovy.com"
echo "  - Application startup file: app.js"
echo "seçip 'Create / Restart' butonuna basmanız yeterlidir."
echo "Başlangıç Admin Girişi: admin@artovy.com / AdminPassword123!"
echo "================================================================"
