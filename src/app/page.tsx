"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ShieldCheck,
  BellRing,
  FileSpreadsheet,
  Lock,
  CheckCircle2,
  Sun,
  Moon,
  Globe,
  ArrowRight,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui/primitives";
import { DEFAULT_PLANS } from "@/lib/plans";
import { useTheme } from "@/components/providers";

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [lang, setLang] = useState<"tr" | "en">("tr");

  const t = {
    tr: {
      badge: "300+ WordPress Sitesi İçin Tasarlandı",
      heroTitle: "Siteleriniz Kapandığında İlk Siz Haberdar Olun",
      heroDesc:
        "Yüzlerce WordPress ve kurumsal sitenizi 1 dakika aralıklarla izleyin. Ne zaman kapandığını, ne zaman tekrar açıldığını ve toplam kesinti süresini saniyesiyle takip edin.",
      startBtn: "Ücretsiz Başla",
      panelBtn: "Panele Giriş Yap",
      featuresTitle: "Neden Artakip Uptime?",
      pricingTitle: "Şeffaf ve Ölçeklenebilir Planlar",
      pricingSub: "İhtiyacınıza uygun planı seçin, istediğiniz zaman yükseltin.",
    },
    en: {
      badge: "Engineered for 300+ WordPress Sites",
      heroTitle: "Be the First to Know When Your Websites Go Down",
      heroDesc:
        "Monitor hundreds of WordPress and corporate sites every 60 seconds. Track exact downtime timestamps, recovery times, and SSL expiration.",
      startBtn: "Start Free",
      panelBtn: "Sign In",
      featuresTitle: "Why Artakip Uptime?",
      pricingTitle: "Simple, Scalable Pricing",
      pricingSub: "Choose the plan that fits your agency and upgrade anytime.",
    },
  }[lang];

  const plans = Object.values(DEFAULT_PLANS);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Üst Menü */}
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Artakip</span>
            <Badge variant="success" className="hidden sm:inline-flex">
              %99.98 Uptime
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === "tr" ? "en" : "tr")}
              title="Dil Değiştir"
            >
              <Globe className="h-4 w-4 mr-1.5" />
              {lang.toUpperCase()}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title="Tema Değiştir"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/login">
              <Button variant="outline" size="sm">
                {t.panelBtn}
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">{t.startBtn}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Bölümü */}
      <section className="py-20 px-4 sm:px-6 text-center max-w-4xl mx-auto">
        <Badge variant="default" className="mb-4 px-3 py-1 text-sm">
          {t.badge}
        </Badge>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6">
          {t.heroTitle}
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          {t.heroDesc}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              {t.startBtn} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="#pricing">
            <Button size="lg" variant="outline">
              Fiyatlandırmayı İncele
            </Button>
          </Link>
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-16 px-4 sm:px-6 bg-muted/30 border-y">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t.featuresTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <BellRing className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-2">
                Anlık Kapanma & Açılma Bildirimi
              </h3>
              <p className="text-sm text-muted-foreground">
                Yanlış alarmları önlemek için ardışık hata doğrulaması ve 5 sn hızlı tekrar deneme. Site açıldığında toplam kesinti süresiyle tek mail.
              </p>
            </Card>
            <Card className="p-6">
              <FileSpreadsheet className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-2">
                300+ Site CSV Toplu İçe Aktarma
              </h3>
              <p className="text-sm text-muted-foreground">
                WordPress ajansları için tek tıkla CSV yükleme, SSRF güvenlik taraması, `/wp-json/` kontrolü ve özel timeout ayarları.
              </p>
            </Card>
            <Card className="p-6">
              <ShieldCheck className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-bold mb-2">
                Alarm Fırtınası & SSL Koruması
              </h3>
              <p className="text-sm text-muted-foreground">
                Sunucu çöktüğünde 20+ site aynı anda kapanırsa gelen kutunuzu boğmaz, tek toplu rapor gönderir. SSL bitiş tarihini önceden haber verir.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Fiyatlandırma Tablosu */}
      <section id="pricing" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">{t.pricingTitle}</h2>
          <p className="text-muted-foreground">{t.pricingSub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => {
            const isPopular = p.plan === "PRO";
            return (
              <Card
                key={p.plan}
                className={`p-6 flex flex-col justify-between relative ${
                  isPopular ? "border-primary ring-2 ring-primary/30" : ""
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 right-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    En Popüler (300 Site)
                  </span>
                )}
                <div>
                  <h3 className="text-xl font-bold mb-1">{p.name}</h3>
                  <div className="my-4">
                    <span className="text-3xl font-extrabold">
                      {p.priceTry === 0 ? "Ücretsiz" : `₺${p.priceTry}`}
                    </span>
                    {p.priceTry > 0 && (
                      <span className="text-sm text-muted-foreground"> / ay</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">
                    Maksimum <strong>{p.siteLimit}</strong> site • Min.{" "}
                    <strong>{p.minIntervalSeconds / 60} dk</strong> kontrol •{" "}
                    <strong>{p.retentionDays} gün</strong> geçmiş
                  </p>
                  <ul className="space-y-2.5 mb-8 text-sm">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link href={`/register?plan=${p.plan}`}>
                  <Button
                    variant={isPopular ? "default" : "outline"}
                    className="w-full"
                  >
                    {p.priceTry === 0 ? "Ücretsiz Başla" : `${p.name} Seç`}
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Alt Bilgi */}
      <footer className="mt-auto border-t py-8 px-4 sm:px-6 text-center text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span>Artakip SaaS Uptime Monitoring — KVKK & GDPR Uyumlu</span>
          </div>
          <div className="flex gap-4">
            <Link href="/status/sistem" className="hover:underline">
              Sistem Durumu
            </Link>
            <Link href="/login" className="hover:underline">
              Giriş
            </Link>
            <Link href="/register" className="hover:underline">
              Kayıt Ol
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
