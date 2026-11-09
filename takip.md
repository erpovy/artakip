# takip.md — Web Sitesi Uptime Takip SaaS

> Bu dosya Antigravity (AI kodlama ajanı) için proje şartnamesidir. Ajan bu dosyayı baştan sona okuyup aşamaları sırayla uygulamalıdır. Her aşama bittiğinde çalıştırıp test etmeli, sonra bir sonraki aşamaya geçmelidir.

---

## 1. Proje Özeti

300+ WordPress sitesinin (ve ileride herhangi bir web sitesinin) **ne zaman kapandığını, ne zaman tekrar açıldığını** izleyen, üyelik sistemli, çok kiracılı (multi-tenant) bir **SaaS uptime monitoring** uygulaması.

**Temel ihtiyaçlar:**
1. Kullanıcı kayıt olur / giriş yapar (e-posta + şifre).
2. Kullanıcı kendi sitelerini ekler (tek tek veya CSV ile toplu).
3. Sistem siteleri belirli aralıklarla kontrol eder.
4. Site **kapandığında** ve **tekrar açıldığında** e-posta gönderir.
5. Kullanıcı, bildirim ayarlarını panelden yönetir.
6. Her site için geçmiş (açılma/kapanma kayıtları, kesinti süreleri, uptime %) görüntülenir.
7. Planlara göre site limiti olan, ücretli satılabilir SaaS yapısı.

---

## 2. Teknoloji Yığını (Önerilen)

| Katman | Teknoloji |
|---|---|
| Framework | **Next.js 14+ (App Router) + TypeScript** |
| UI | Tailwind CSS + shadcn/ui |
| Veritabanı | **PostgreSQL** |
| ORM | **Prisma** |
| Auth | **Auth.js (NextAuth)** — e-posta/şifre (bcrypt/argon2) |
| Kuyruk / Zamanlayıcı | **BullMQ + Redis** (alternatif: node-cron tek worker) |
| E-posta | **Nodemailer (SMTP)** — Resend/Brevo/Mailgun ile uyumlu |
| Ödeme | **Stripe** (TR için alternatif: **iyzico**) — Aşama 8 |
| Grafik | Recharts |
| Deploy | **Docker Compose** (web + worker + postgres + redis), VPS'te çalışacak |

> Not: Ajan farklı bir yığın daha uygun görürse gerekçesini yazıp onay istemeden devam etmemeli; varsayılan yukarıdakidir.

---

## 3. Mimari

```
[Tarayıcı] → [Next.js Web (panel + API)] → [PostgreSQL]
                         ↑
              [Worker (ayrı süreç)] → [Redis/BullMQ]
                         ↓
        HTTP kontrolleri → durum değişimi → e-posta kuyruğu → SMTP
```

- **Web** ve **Worker** ayrı süreçler/konteynerler olmalı. Worker çökerse panel çalışmaya devam etmeli.
- Worker, her monitör için `interval` süresine göre kontrol işi planlar.
- 300 site × 1 dk = dakikada 300 istek; eşzamanlılık (concurrency) ayarlanabilir olmalı (varsayılan 20).

---

## 4. Veritabanı Şeması (Prisma taslağı)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String?
  role          Role     @default(USER)   // USER | ADMIN
  emailVerified DateTime?
  plan          Plan     @default(FREE)
  planSiteLimit Int      @default(5)
  createdAt     DateTime @default(now())
  monitors      Monitor[]
  settings      NotificationSettings?
  contacts      AlertContact[]
}

model Monitor {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String
  url             String
  type            MonitorType @default(HTTP)  // HTTP | KEYWORD
  keyword         String?                     // KEYWORD tipinde sayfada aranacak metin
  intervalSeconds Int      @default(300)      // 60, 300, 600, 1800...
  timeoutSeconds  Int      @default(15)
  expectedStatus  String   @default("200-399")
  followRedirects Boolean  @default(true)
  paused          Boolean  @default(false)
  checkSsl        Boolean  @default(true)
  currentStatus   Status   @default(UNKNOWN)  // UP | DOWN | UNKNOWN
  lastCheckedAt   DateTime?
  lastStatusChangeAt DateTime?
  consecutiveFails Int     @default(0)
  sslExpiresAt    DateTime?
  tags            String[]
  createdAt       DateTime @default(now())
  checks          Check[]
  incidents       Incident[]
  @@index([userId])
}

model Check {                      // Her kontrol sonucu
  id         BigInt   @id @default(autoincrement())
  monitorId  String
  monitor    Monitor  @relation(fields: [monitorId], references: [id], onDelete: Cascade)
  checkedAt  DateTime @default(now())
  status     Status
  httpCode   Int?
  responseMs Int?
  error      String?
  @@index([monitorId, checkedAt])
}

model Incident {                   // Kapanma → açılma kaydı
  id          String   @id @default(cuid())
  monitorId   String
  monitor     Monitor  @relation(fields: [monitorId], references: [id], onDelete: Cascade)
  startedAt   DateTime            // Kapandığı an
  resolvedAt  DateTime?           // Tekrar açıldığı an (null = hâlâ kapalı)
  reason      String?             // timeout, 500, DNS hatası vb.
  @@index([monitorId, startedAt])
}

model NotificationSettings {
  id                 String  @id @default(cuid())
  userId             String  @unique
  user               User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  notifyOnDown       Boolean @default(true)
  notifyOnUp         Boolean @default(true)
  notifyOnSslExpiry  Boolean @default(true)
  sslExpiryDaysBefore Int    @default(14)
  failuresBeforeDown Int     @default(2)   // Yanlış alarmı önlemek için ardışık hata sayısı
  digestDaily        Boolean @default(false)
  digestWeekly       Boolean @default(false)
  quietHoursStart    String?              // "23:00"
  quietHoursEnd      String?              // "07:00"
  timezone           String  @default("Europe/Istanbul")
}

model AlertContact {               // Birden fazla bildirim e-postası
  id        String  @id @default(cuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  email     String
  verified  Boolean @default(false)
}

model NotificationLog {            // Gönderilen mailler
  id        String   @id @default(cuid())
  userId    String
  monitorId String?
  type      String   // DOWN | UP | SSL | DIGEST
  toEmail   String
  success   Boolean
  error     String?
  sentAt    DateTime @default(now())
}

enum Role { USER ADMIN }
enum Plan { FREE STARTER PRO AGENCY }
enum MonitorType { HTTP KEYWORD }
enum Status { UP DOWN UNKNOWN }
```

---

## 5. İzleme Mantığı (Worker)

1. Her aktif (paused=false) monitör için `intervalSeconds` aralığında bir iş çalışır.
2. HTTP isteği: `GET`, timeout = `timeoutSeconds`, User-Agent: `TakipBot/1.0`.
3. **UP kabul koşulu:** HTTP kodu `expectedStatus` aralığında **ve** (KEYWORD tipinde) yanıt gövdesinde `keyword` var.
4. **DOWN nedenleri:** timeout, DNS hatası, bağlantı reddi, SSL hatası, beklenmeyen HTTP kodu, anahtar kelime yok.
5. **Yanlış alarm koruması:** DOWN'a geçmek için `failuresBeforeDown` kadar **ardışık** hata gerekir. İlk hatada hemen 5 sn sonra tekrar dene (retry).
6. **Durum geçişleri:**
   - `UP → DOWN`: yeni `Incident` oluştur (`startedAt = ilk hata zamanı`), **"Site kapandı"** maili kuyruğa at.
   - `DOWN → UP`: açık `Incident`'ı kapat (`resolvedAt = şimdi`), **"Site tekrar açıldı"** maili at (kesinti süresiyle birlikte).
   - Aynı durumda kalırsa **mail atma** (spam yok).
7. Her kontrol `Check` tablosuna yazılır. **30 gün (plana göre ayarlanabilir)** sonrası eski kayıtlar günlük bir job ile silinir.
8. SSL bitiş tarihi günde 1 kez kontrol edilir; `sslExpiryDaysBefore` kala mail.
9. WordPress dostu: `wp-cron`/cache nedeniyle yavaş siteler için timeout ayarı monitör bazında değiştirilebilir. İsteğe bağlı: `/wp-login.php` veya `/wp-json/` yolunu kontrol seçeneği.
10. Sunucu yeniden başladığında worker, planlanmış işleri kaybetmeden devam etmeli (Redis kalıcılığı).

---

## 6. E-posta Bildirimleri

**Şablonlar (Türkçe, HTML + düz metin):**

- **Site Kapandı:** site adı, URL, kapanma zamanı (kullanıcının saat dilimi), hata nedeni, panel linki.
- **Site Açıldı:** site adı, açılma zamanı, **toplam kesinti süresi**, panel linki.
- **SSL Süresi Doluyor:** site adı, kalan gün, bitiş tarihi.
- **Günlük/Haftalık Özet (opsiyonel):** toplam site, kapanan site sayısı, uptime %.
- **Hesap e-postaları:** e-posta doğrulama, şifre sıfırlama, hoş geldin.

**Kurallar:**
- Mail gönderimi kuyruk üzerinden, hata olursa 3 kez yeniden dene.
- Sessiz saatlerde (quiet hours) gelen bildirimler biriktirilip bitişte tek mailde gönderilebilir.
- Aynı anda 20+ site kapanırsa (örn. sunucu çöktü) **toplu tek mail** gönder (alarm fırtınası koruması).
- Her maile "abonelikten çık / ayarları değiştir" linki.
- SMTP bilgileri `.env` içinden okunur.

---

## 7. Panel Ekranları

### Herkese açık
- `/` — Tanıtım (landing) sayfası + fiyatlandırma
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`

### Kullanıcı paneli (giriş gerekli)
1. **Dashboard** — toplam site, şu an UP / DOWN sayısı, son 24 saatteki olaylar, genel uptime %.
2. **Siteler (liste)** — tablo: ad, URL, durum rozeti (yeşil/kırmızı), son kontrol, yanıt süresi, 30 günlük uptime. Arama, filtre (durum, etiket), sıralama, sayfalama (300+ site performanslı olmalı).
3. **Site ekle / düzenle** — ad, URL, tip, kontrol aralığı, timeout, anahtar kelime, etiketler, duraklat/devam.
4. **Toplu içe aktarma** — CSV yükle (`ad,url`), önizleme ve hata raporu; plan limitine uyar.
5. **Site detay** — durum, yanıt süresi grafiği (24s/7g/30g), **olay geçmişi tablosu (ne zaman kapandı → ne zaman açıldı → süre)**, son kontroller, SSL bilgisi.
6. **Olaylar (Incidents)** — tüm sitelerdeki kesintilerin zaman çizelgesi, tarih aralığı filtresi, CSV dışa aktarma.
7. **Bildirim ayarları** — kapandı/açıldı/SSL mail aç-kapa, bildirim e-postaları listesi (ekle/doğrula/sil), ardışık hata sayısı, sessiz saatler, saat dilimi, günlük/haftalık özet.
8. **Hesap** — profil, şifre değiştir, hesabı sil.
9. **Abonelik / Faturalama** — mevcut plan, kullanım (kaç site), plan yükselt (Aşama 8).

### Admin paneli (`role = ADMIN`)
- Kullanıcı listesi (arama, plan değiştir, askıya al, kullanıcı adına gir/impersonate).
- Sistem durumu: worker canlı mı, kuyruk uzunluğu, son hatalar, gönderilen mail sayısı.
- Plan limitleri ve fiyatlarını düzenleme.
- Genel SMTP test maili gönderme.

---

## 8. Planlar (başlangıç önerisi, panelden düzenlenebilir)

| Plan | Site limiti | Min. kontrol aralığı | Geçmiş saklama | Fiyat (örnek) |
|---|---|---|---|---|
| FREE | 5 | 10 dk | 7 gün | Ücretsiz |
| STARTER | 50 | 5 dk | 30 gün | ₺ |
| PRO | 300 | 1 dk | 90 gün | ₺ |
| AGENCY | 1000 | 1 dk | 180 gün | ₺ |

Limit aşımı sunucu tarafında zorunlu denetlenmeli (sadece UI değil).

---

## 9. API Uç Noktaları (Next.js Route Handlers)

```
POST   /api/auth/register
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/monitors            ?q=&status=&tag=&page=
POST   /api/monitors
GET    /api/monitors/:id
PATCH  /api/monitors/:id
DELETE /api/monitors/:id
POST   /api/monitors/:id/pause
POST   /api/monitors/:id/resume
POST   /api/monitors/import     (CSV)
GET    /api/monitors/:id/checks ?range=24h|7d|30d
GET    /api/incidents           ?from=&to=&monitorId=
GET    /api/incidents/export    (CSV)
GET    /api/settings/notifications
PUT    /api/settings/notifications
POST   /api/settings/contacts
DELETE /api/settings/contacts/:id
POST   /api/billing/checkout
POST   /api/billing/webhook
GET    /api/admin/users         (ADMIN)
GET    /api/admin/system        (ADMIN)
GET    /api/health              (uygulama sağlık kontrolü)
```

Tüm uç noktalarda: oturum doğrulama, **kullanıcı sadece kendi verisine erişir** (userId kontrolü), Zod ile girdi doğrulama.

---

## 10. Güvenlik Gereksinimleri

- Şifreler argon2/bcrypt ile hash'lenir.
- **SSRF koruması:** Eklenen URL'lerde `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` ve iç ağ adresleri **engellenir** (DNS çözümlendikten sonra IP de kontrol edilir). Sadece `http`/`https`.
- Rate limiting: giriş, kayıt, şifre sıfırlama, API.
- CSRF/XSS korumaları, güvenli cookie (`httpOnly`, `secure`, `sameSite`).
- E-posta doğrulaması olmadan bildirim gönderilmez.
- Sırlar `.env` içinde; repoya commit edilmez (`.env.example` verilir).
- Admin uç noktaları rol kontrolü ile korunur.
- KVKK/GDPR: hesap silince tüm veriler silinir.

---

## 11. Uygulama Aşamaları (Sırayla Yap)

### Aşama 1 — İskelet
- [x] Next.js + TypeScript + Tailwind + shadcn/ui projesi
- [x] Docker Compose: `web`, `worker`, `postgres`, `redis`
- [x] Prisma kurulumu, şema, ilk migration, seed (admin kullanıcı)
- [x] `.env.example`, `README.md` (kurulum adımları)

### Aşama 2 — Kimlik Doğrulama
- [x] Kayıt, giriş, çıkış, e-posta doğrulama, şifre sıfırlama
- [x] Oturum yönetimi ve korumalı sayfalar (middleware)
- [x] Rol bazlı erişim (USER/ADMIN)

### Aşama 3 — Monitör Yönetimi
- [x] Monitör CRUD + doğrulama + SSRF koruması
- [x] Site listesi (arama/filtre/sayfalama), duraklat/devam
- [x] CSV toplu içe aktarma
- [x] Plan limiti denetimi

### Aşama 4 — Worker ve İzleme Motoru
- [x] BullMQ ile periyodik kontrol sistemi
- [x] HTTP + KEYWORD kontrolü, retry, ardışık hata mantığı
- [x] Durum geçişi tespiti, `Incident` açma/kapama
- [x] SSL bitiş tarihi kontrolü
- [x] Eski `Check` kayıtlarını temizleme job'ı
- [x] 300 siteyle yük testi (concurrency ayarı)

### Aşama 5 — E-posta Sistemi
- [x] Nodemailer + kuyruk + yeniden deneme
- [x] Kapandı / Açıldı / SSL mail şablonları (TR)
- [x] Toplu alarm (alarm fırtınası) koruması
- [x] `NotificationLog` kaydı
- [x] SMTP test aracı

### Aşama 6 — Panel Arayüzü
- [x] Dashboard, site detay, grafikler (Recharts)
- [x] Olay geçmişi (kapandı → açıldı → süre) ve dışa aktarma
- [x] Bildirim ayarları sayfası (tüm ayarlar panelden yönetilir)
- [x] Hesap sayfası
- [x] Mobil uyumlu (responsive) + koyu/açık tema

### Aşama 7 — Admin Paneli
- [x] Kullanıcı yönetimi, plan atama, askıya alma
- [x] Sistem sağlık ekranı (worker, kuyruk, mail istatistikleri)

### Aşama 8 — SaaS / Ödeme
- [x] Landing page + fiyat tablosu
- [x] Stripe (veya iyzico) abonelik entegrasyonu + webhook
- [x] Plan yükseltme/düşürme, limit uygulama
- [x] Fatura/abonelik sayfası

### Aşama 9 — Son Rötuşlar
- [x] Günlük/haftalık özet mailleri
- [x] (Opsiyonel) Herkese açık durum sayfası `/status/:slug`
- [x] (Opsiyonel) Telegram / Slack / webhook bildirimi
- [x] (Opsiyonel) Çok dilli arayüz (TR/EN)
- [x] Hata izleme (Sentry), loglama, yedekleme betiği
- [x] Üretim dağıtım rehberi (Nginx/Caddy + HTTPS)

---

## 12. Kabul Kriterleri (Bitti sayılması için)

- [x] Yeni kullanıcı kayıt olup e-postasını doğrulayıp giriş yapabiliyor.
- [x] 300 site CSV ile yüklenebiliyor ve hepsi izleniyor.
- [x] Bir site kapatıldığında en geç `failuresBeforeDown × interval` içinde **tek bir** "kapandı" maili geliyor.
- [x] Site açılınca **tek bir** "açıldı" maili (kesinti süresiyle) geliyor.
- [x] Kapanma/açılma geçmişi panelde tarih-saat ve süre olarak görünüyor.
- [x] Bildirim ayarları panelden değiştirilince worker bir sonraki kontrolde yeni ayarı kullanıyor.
- [x] Bir kullanıcı başka kullanıcının verisine erişemiyor.
- [x] Plan limiti sunucu tarafında zorunlu.
- [x] İç ağ URL'leri (örn. `http://127.0.0.1`) eklenemiyor.
- [x] `docker compose up` ile tüm sistem tek komutla ayağa kalkıyor.
- [x] Worker yeniden başlatıldığında izleme kesintisiz devam ediyor.

---

## 13. Ajan İçin Çalışma Kuralları

1. Aşamaları **sırayla** yap; her aşama sonunda çalıştır ve test et.
2. Her aşama sonunda kısa bir ilerleme özeti yaz ve bu dosyadaki kutucukları `[x]` olarak işaretle.
3. Kod TypeScript, `strict` modda olsun; ESLint + Prettier kullan.
4. Kritik mantık (durum geçişi, SSRF filtresi, limit kontrolü, mail tetikleme) için **birim testi** yaz (Vitest).
5. Arayüz metinleri **Türkçe**; tarih/saat kullanıcının saat dilimine göre gösterilsin.
6. Belirsiz bir nokta olursa en makul varsayımı yap, README'ye "Varsayımlar" başlığı altında not düş.
7. Gizli bilgileri koda gömme; hepsi `.env` üzerinden.
8. Yeni bağımlılık eklerken gerekçesini kısa yaz.
