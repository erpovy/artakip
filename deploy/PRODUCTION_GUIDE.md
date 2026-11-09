# Üretim Dağıtım Rehberi (VPS + Docker Compose + HTTPS)

## 1. Sunucu Gereksinimleri
- Ubuntu 22.04 / 24.04 LTS (2 vCPU, 2-4 GB RAM — 300+ siteyi dakikada bir izlemek için fazlasıyla yeterlidir)
- Docker & Docker Compose v2
- Caddy veya Nginx (HTTPS sonlandırma için)

## 2. Adım Adım Kurulum

```bash
git clone <repo-url> /opt/artakip
cd /opt/artakip
cp .env.example .env
nano .env
```

`.env` içerisinde `NEXTAUTH_SECRET`, `POSTGRES_PASSWORD`, `SMTP_*` ve `NEXTAUTH_URL="https://uptime.alanadiniz.com"` değerlerini ayarlayın.

```bash
# Tüm servisleri (web, worker, postgres, redis) başlatın
docker compose up -d --build

# Varsayılan planları ve yönetici hesabını oluşturun
docker compose exec web npm run db:seed
```

## 3. HTTPS Kurulumu (Caddy ile Otomatik SSL)

```bash
sudo apt install -y caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 4. Otomatik Veritabanı Yedekleme

```bash
chmod +x deploy/backup.sh
(crontab -l 2>/dev/null; echo "30 3 * * * /opt/artakip/deploy/backup.sh") | crontab -
```
