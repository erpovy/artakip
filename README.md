# Artakip — Web Sitesi Uptime Takip SaaS

300+ WordPress sitesinin ve her türlü web sitesinin **ne zaman kapandığını, ne zaman tekrar açıldığını** izleyen, üyelik sistemli, çok kiracılı (multi-tenant) SaaS uptime izleme platformu.

---

## Özellikler

- **Çok Kiracılı (Multi-tenant) Mimari**: Her kullanıcı yalnızca kendi sitelerine, olaylarına ve bildirim ayarlarına erişebilir.
- **Akıllı İzleme Motoru (Worker)**:
  - HTTP durum kodu (`200-399` vb.) ve sayfa içi anahtar kelime (`KEYWORD`) kontrolü.
  - WordPress dostu özel kontrol yolu (`/wp-login.php`, `/wp-json/`) ve özelleştirilebilir timeout.
  - Yanlış alarm koruması (`failuresBeforeDown` ardışık hata + ilk hatada 5 sn sonra anında retry).
  - SSL sertifika bitiş tarihi takibi ve erken uyarı.
- **Gelişmiş Bildirim Sistemi**:
  - Kuyruk tabanlı (BullMQ + Redis) e-posta gönderimi (3 kez otomatik yeniden deneme).
  - Alarm fırtınası koruması: Aynı anda 20+ site kapanırsa tek toplu e-posta gönderimi.
  - Sessiz saatler (Quiet Hours) ve kullanıcı saat dilimi (`Europe/Istanbul` vb.) desteği.
  - Günlük/Haftalık özet e-postaları, Webhook / Slack / Telegram entegrasyonları.
- **Güvenlik**:
  - Tam SSRF koruması (özel IP aralıkları, localhost ve DNS çözümleme sonrası iç ağ IP engellemesi).
  - Rate limiting, bcrypt şifreleme, güvenli oturum yönetimi, KVKK/GDPR uyumlu hesap silme.
- **SaaS & Faturalama**:
  - `FREE`, `STARTER`, `PRO`, `AGENCY` planları ve sunucu taraflı zorunlu limit denetimi.
  - Stripe ödeme ve webhook entegrasyonu.
  - Admin paneli (kullanıcı yönetimi, plan/fiyat düzenleme, impersonation, sistem/kuyruk sağlığı, SMTP test aracı).

---

## Kurulum Adımları

### 1. Ortam Değişkenlerini Hazırlayın

```bash
cp .env.example .env
```

`.env` dosyasındaki `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET` ve `SMTP_*` bilgilerini kendi ortamınıza göre düzenleyin.

### 2. Docker Compose ile Tek Komutla Çalıştırma (Önerilen)

```bash
docker compose up -d --build
```

İlk kurulumda admin kullanıcısını ve varsayılan planları oluşturmak için:

```bash
docker compose exec web npm run db:seed
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

### 3. Yerel Geliştirme Ortamı

```bash
# Bağımlılıkları yükleyin
npm install

# Prisma istemcisini oluşturun ve veritabanı şemasını uygulayın
npm run db:generate
npm run db:migrate
npm run db:seed

# Web panelini başlatın
npm run dev

# Ayrı bir terminalde Worker sürecini başlatın
npm run worker:dev
```

### 4. Testleri Çalıştırma

```bash
# Birim testleri (Vitest)
npm test

# 300 site yük ve eşzamanlılık (concurrency) testi
npm run load-test
```

---

## Kullanılan Bağımlılıklar ve Gerekçeleri

| Paket | Gerekçe |
|---|---|
| `next`, `react`, `react-dom` | App Router tabanlı full-stack web paneli ve API uç noktaları |
| `@prisma/client`, `prisma` | Tip güvenli PostgreSQL ORM ve veritabanı şema/migration yönetimi |
| `next-auth`, `jose`, `bcryptjs` | Güvenli kimlik doğrulama, JWT oturum yönetimi ve şifre hash'leme |
| `bullmq`, `ioredis` | Redis tabanlı kalıcı iş kuyruğu, periyodik site kontrolü ve e-posta kuyruğu |
| `nodemailer` | SMTP üzerinden HTML + düz metin e-posta gönderimi |
| `zod` | Tüm API uç noktalarında ve formlarda katı girdi doğrulama |
| `recharts` | Site yanıt süresi ve uptime grafiklerinin görselleştirilmesi |
| `lucide-react`, `clsx`, `tailwind-merge` | shadcn/ui uyumlu modern arayüz bileşenleri ve ikonlar |
| `stripe` | SaaS abonelik, checkout ve webhook yönetimi |
| `vitest` | Kritik iş mantığı (SSRF, durum geçişi, plan limiti, e-posta tetikleme) birim testleri |

---

## Varsayımlar

1. **Veritabanı ve Kuyruk Yedekliliği**: Üretimde PostgreSQL ve Redis kullanılır. Geliştirme veya Redis erişimi olmayan ortamlarda uygulamanın kesintisiz test edilebilmesi için kuyruk katmanı Redis bağlantısı olmadığında otomatik olarak bellek içi (in-memory) zamanlayıcıya düşer (fallback).
2. **Varsayılan Plan Fiyatları**: Başlangıç fiyatları `STARTER: 199 ₺`, `PRO: 499 ₺`, `AGENCY: 1299 ₺` olarak tanımlanmıştır ve Admin panelinden canlı olarak değiştirilebilir.
3. **E-posta Doğrulama**: SMTP yapılandırılmamış geliştirme ortamlarında doğrulama bağlantıları konsola ve `NotificationLog` tablosuna kaydedilir; üretimde SMTP üzerinden gönderilir.
4. **WordPress Özel Kontrolü**: WordPress sitelerinde önbellek (cache) yanıltmasını önlemek veya gerçek çalışırlığı doğrulamak için isteğe bağlı `/wp-login.php` veya `/wp-json/` kontrol yolu seçeneği monitör ayarlarına eklenmiştir.

---

## Üretim Dağıtım Rehberi (Nginx / Caddy + HTTPS)

Detaylı üretim ortamı kurulumu, ters vekil (Reverse Proxy) yapılandırması ve otomatik veritabanı yedekleme betiği için `deploy/` klasörüne bakabilirsiniz:
- `deploy/Caddyfile` — Otomatik Let's Encrypt SSL ile Caddy yapılandırması
- `deploy/nginx.conf` — Nginx ters vekil yapılandırması
- `deploy/backup.sh` — Günlük PostgreSQL yedekleme ve eski yedekleri temizleme betiği
