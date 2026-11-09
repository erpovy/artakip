import React from "react";
import Link from "next/link";
import {
  Activity,
  ShieldCheck,
  BellRing,
  FileSpreadsheet,
  Lock,
  Zap,
  CheckCircle2,
  ArrowRight,
  Globe,
  Sparkles,
  Clock,
  Server,
} from "lucide-react";
import { Button, Card, Badge, StatusPulse, UptimeHeartbeatBar } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DEFAULT_PLANS } from "@/lib/plans";

export default function LandingPage() {
  const plans = Object.values(DEFAULT_PLANS);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      {/* Üst Menü */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight">Artakip</span>
              <span className="hidden sm:inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20">
                v2.0 Cloud
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#ozellikler" className="hover:text-foreground transition-colors">
              Özellikler
            </a>
            <a href="#canli-onizleme" className="hover:text-foreground transition-colors">
              Canlı Önizleme
            </a>
            <a href="#fiyatlandirma" className="hover:text-foreground transition-colors">
              Fiyatlandırma
            </a>
            <a href="#sss" className="hover:text-foreground transition-colors">
              S.S.S.
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Giriş Yap
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="gap-1.5">
                Ücretsiz Başla <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Bölümü */}
      <section className="relative overflow-hidden py-20 sm:py-28 bg-radial-glow">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>300+ WordPress & Kurumsal Web Sitesi İçin Gerçek Zamanlı Kesinti Radarı</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]">
            Web Siteleriniz Kapandığında{" "}
            <span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              İlk Siz Haberdar Olun.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Müşterileriniz aramadan önce kesintileri yakalayın. Saniyeler içinde HTTP durum kodu,
            WHM askıya alınma tespiti, SSL sertifika ömrü ve sayfa içi anahtar kelime kontrolüyle
            tüm sitelerinizi tek komuta merkezinden yönetin.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-8">
                5 Siteye Kadar Ücretsiz Başla
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#canli-onizleme">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base">
                Canlı Komuta Merkezini İncele
              </Button>
            </a>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Kredi kartı gerekmez
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Çift kontrol (False-Positive) koruması
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> CSV ile 10 saniyede 300 site yükleme
            </span>
          </div>

          {/* Canlı Komuta Merkezi Mockup Önizlemesi */}
          <div id="canli-onizleme" className="pt-10 text-left">
            <Card className="p-4 sm:p-6 border-border/80 bg-card/90 shadow-2xl shadow-blue-950/20">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    artakip.artovy.com/dashboard — Canlı İzleme Radarı
                  </span>
                </div>
                <Badge variant="success" className="gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  299 / 300 Sistem Aktif (%99.98 Uptime)
                </Badge>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  {
                    name: "Artovy Kurumsal Web",
                    url: "https://artovy.com",
                    status: "UP" as const,
                    latency: "118 ms",
                    uptime: "%100",
                    ssl: "84 gün",
                  },
                  {
                    name: "E-Ticaret WooCommerce Mağaza",
                    url: "https://magaza.ornek.com/wp-json/",
                    status: "UP" as const,
                    latency: "214 ms",
                    uptime: "%99.96",
                    ssl: "62 gün",
                  },
                  {
                    name: "Müşteri Portal & B2B Bayi",
                    url: "https://bayi.ornek.com",
                    status: "DOWN" as const,
                    latency: "Zaman Aşımı",
                    uptime: "%98.40",
                    ssl: "19 gün",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/60 p-4 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <StatusPulse status={item.status} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{item.name}</span>
                          <Badge variant={item.status === "UP" ? "success" : "danger"}>
                            {item.status === "UP" ? "Çalışıyor (200 OK)" : "Kapalı (Bildirim Gönderildi)"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.url}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="hidden sm:block">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Son 24 Saat Nabız
                        </p>
                        <UptimeHeartbeatBar status={item.status} bars={22} />
                      </div>
                      <div className="text-right min-w-[75px]">
                        <p className="text-xs font-bold">{item.latency}</p>
                        <p className="text-[11px] text-muted-foreground">SSL: {item.ssl}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Özellikler Bento Grid */}
      <section id="ozellikler" className="py-20 border-t border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <Badge variant="default">Mühendislik Seviyesinde Koruma</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ajanslar ve Sistem Yöneticileri İçin Tasarlandı
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Sıradan ping araçlarının kaçırdığı WordPress veritabanı çökmelerini, WHM askıya alma
              sayfalarını ve SSL süresi bitimlerini anında yakalar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6 space-y-3 hover:border-primary/40 transition-all group">
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-105 transition-transform">
                <BellRing className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">Anında Kapanma & Açılma E-postası</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Siteniz çöktüğü anda hata kodu ve nedeni ile birlikte bildirim alırsınız. Tekrar
                açıldığında toplam kesinti süresi otomatik hesaplanıp raporlanır.
              </p>
            </Card>

            <Card className="p-6 space-y-3 hover:border-primary/40 transition-all group">
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">Yanlış Alarm & WHM Suspend Tespiti</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                İlk hatada hemen panik yaratmaz, 5 saniye sonra doğrulama kontrolü yapar. Ayrıca
                cPanel/WHM <code>suspendedpage.cgi</code> yönlendirmelerini yakalar.
              </p>
            </Card>

            <Card className="p-6 space-y-3 hover:border-primary/40 transition-all group">
              <div className="h-11 w-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">CSV ile Toplu Site İçe Aktarma</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                300+ WordPress sitenizi tek tek eklemeyin. CSV dosyanızı sürükleyin, canlı önizleme
                raporunu onaylayın ve saniyeler içinde izlemeyi başlatın.
              </p>
            </Card>

            <Card className="p-6 space-y-3 hover:border-primary/40 transition-all group">
              <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">SSL Sertifika Süresi Takibi</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                HTTPS sitelerinizin TLS/SSL sertifikalarını her kontrolde denetler. Süresi
                dolmadan 14, 7 ve 1 gün önce otomatik uyarı gönderir.
              </p>
            </Card>

            <Card className="p-6 space-y-3 hover:border-primary/40 transition-all group">
              <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 group-hover:scale-105 transition-transform">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">WordPress & Anahtar Kelime Kontrolü</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sadece HTTP 200 yetmez; beyaz ekran (WSOD) veya veritabanı hatasını yakalamak için
                sayfa içi metin veya <code>/wp-json/</code> uç noktasını denetleyin.
              </p>
            </Card>

            <Card className="p-6 space-y-3 hover:border-primary/40 transition-all group">
              <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 group-hover:scale-105 transition-transform">
                <Globe className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">Herkese Açık Durum Sayfası (Status Page)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Müşterilerinizle paylaşabileceğiniz şık ve canlı bir <code>/status/ajans-adiniz</code>{" "}
                sayfası oluşturun, güvenilirliğinizi şeffafça sergileyin.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Fiyatlandırma */}
      <section id="fiyatlandirma" className="py-20 border-t border-border/60 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <Badge variant="default">Şeffaf Paketler</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              İhtiyacınıza Göre Ölçeklenen Planlar
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              İster 5 kişisel sitenizi, ister 1.000 müşteri sitenizi izleyin. İstediğiniz an
              paket yükseltebilirsiniz.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => {
              const isPopular = p.plan === "PRO";
              return (
                <Card
                  key={p.plan}
                  className={`p-6 flex flex-col justify-between relative transition-all ${
                    isPopular
                      ? "border-primary ring-2 ring-primary/30 shadow-xl shadow-blue-500/10"
                      : "hover:border-border"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 right-4">
                      <Badge variant="default" className="bg-primary text-primary-foreground border-0 shadow">
                        300 Site İçin En Popüler
                      </Badge>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold">{p.name}</h3>
                    <div className="mt-4 mb-2 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">
                        {p.priceTry === 0 ? "Ücretsiz" : `₺${p.priceTry}`}
                      </span>
                      {p.priceTry > 0 && (
                        <span className="text-xs text-muted-foreground font-medium">/ ay</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 pb-4 border-b border-border/60">
                      <Server className="h-3.5 w-3.5 text-primary" />
                      <span>
                        <strong>{p.siteLimit}</strong> Site •{" "}
                        <strong>{p.minIntervalSeconds / 60} dk</strong> kontrol
                      </span>
                    </div>
                    <ul className="space-y-2.5 text-sm mb-8">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link href="/register">
                    <Button
                      variant={isPopular ? "default" : "outline"}
                      className="w-full"
                    >
                      {p.priceTry === 0 ? "Ücretsiz Başla" : "Planı Seç"}
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* SSS */}
      <section id="sss" className="py-20 border-t border-border/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <Badge variant="outline">Merak Edilenler</Badge>
            <h2 className="text-3xl font-extrabold tracking-tight">Sıkça Sorulan Sorular</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                300 WordPress sitesini aynı anda nasıl ekleyebilirim?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kayıt olduktan sonra <strong>CSV İçe Aktar</strong> sayfasına gidip{" "}
                <code>Site Adı,https://site.com</code> formatındaki listenizi tek tıkla
                yükleyebilirsiniz.
              </p>
            </Card>

            <Card className="p-5 space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <BellRing className="h-4 w-4 text-primary" />
                Anlık ağ dalgalanmalarında gereksiz e-posta gelir mi?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hayır. Çift aşamalı doğrulama mekanizmamız ilk hatada 5 saniye bekleyip ikinci
                kontrolü yapar; yalnızca gerçek kesintilerde e-posta gönderir.
              </p>
            </Card>

            <Card className="p-5 space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                WHM / cPanel üzerinden askıya alınan siteleri algılar mı?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Evet. Siteniz HTTP 200 döndürse bile <code>/cgi-sys/suspendedpage.cgi</code>{" "}
                yönlendirmesi veya hesap askıya alındı içeriği tespit edildiğinde anında DOWN
                alarmı üretilir.
              </p>
            </Card>

            <Card className="p-5 space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Ekip arkadaşlarıma da bildirim gidebilir mi?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bildirim Ayarları menüsünden istediğiniz kadar ek alıcı e-posta adresi, Slack veya
                Webhook bağlantısı tanımlayabilirsiniz.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Alt Bilgi */}
      <footer className="mt-auto border-t border-border/60 py-10 text-xs text-muted-foreground bg-card/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center text-white">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-foreground">Artakip</span>
            <span>© {new Date().getFullYear()} — Kesintisiz Web Sitesi İzleme Platformu.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Giriş Yap
            </Link>
            <Link href="/register" className="hover:text-foreground transition-colors">
              Kayıt Ol
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
