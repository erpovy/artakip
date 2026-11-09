"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Globe, ShieldCheck, Sliders } from "lucide-react";
import { Button, Input, Card } from "@/components/ui/primitives";

export default function NewMonitorPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("https://");
  const [type, setType] = useState<"HTTP" | "KEYWORD">("HTTP");
  const [keyword, setKeyword] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(600);
  const [timeoutSeconds, setTimeoutSeconds] = useState(15);
  const [expectedStatus, setExpectedStatus] = useState("200-399");
  const [wpCheckPath, setWpCheckPath] = useState("");
  const [tagsText, setTagsText] = useState("wordpress");
  const [checkSsl, setCheckSsl] = useState(true);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          type,
          keyword: type === "KEYWORD" ? keyword : null,
          intervalSeconds: Number(intervalSeconds),
          timeoutSeconds: Number(timeoutSeconds),
          expectedStatus,
          wpCheckPath: wpCheckPath || null,
          checkSsl,
          followRedirects,
          tags,
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Site eklenemedi.");
        return;
      }

      router.push(`/dashboard/monitors/${data.monitor.id}`);
    } catch {
      setLoading(false);
      setError("Sunucu hatası oluştu.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Yeni Web Sitesi Ekle</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          HTTP durum kodu, WHM askıya alınma kontrolü veya sayfa içi anahtar kelime ile sitenizi 7/24 izlemeye alın.
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        {error && (
          <div className="mb-6 rounded-xl bg-rose-500/15 border border-rose-500/30 p-3.5 text-sm text-rose-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-primary border-b border-border/60 pb-2">
              <Globe className="h-4 w-4" />
              <span>Temel Site Bilgileri</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Site Adı
                </label>
                <Input
                  required
                  placeholder="Örn: Müşteri Kurumsal WP"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Site URL
                </label>
                <Input
                  required
                  type="url"
                  placeholder="https://ornek.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-primary border-b border-border/60 pb-2">
              <Sliders className="h-4 w-4" />
              <span>İzleme Kriterleri & Sıklık</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  İzleme Tipi
                </label>
                <select
                  className="h-10 w-full rounded-xl border border-input bg-background/80 px-3.5 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as "HTTP" | "KEYWORD")}
                >
                  <option value="HTTP">HTTP Durum Kodu Kontrolü</option>
                  <option value="KEYWORD">Sayfa İçi Anahtar Kelime (KEYWORD)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  WordPress Özel Kontrol Yolu
                </label>
                <select
                  className="h-10 w-full rounded-xl border border-input bg-background/80 px-3.5 text-sm"
                  value={wpCheckPath}
                  onChange={(e) => setWpCheckPath(e.target.value)}
                >
                  <option value="">Ana URL&apos;yi Kontrol Et (Varsayılan)</option>
                  <option value="/wp-json/">/wp-json/ (WP REST API Doğrulaması)</option>
                  <option value="/wp-login.php">/wp-login.php (WP Giriş Sayfası)</option>
                </select>
              </div>
            </div>

            {type === "KEYWORD" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Sayfada Aranacak Metin (Anahtar Kelime)
                </label>
                <Input
                  required
                  placeholder="Örn: Kurumsal Hizmetlerimiz"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Kontrol Aralığı
                </label>
                <select
                  className="h-10 w-full rounded-xl border border-input bg-background/80 px-3.5 text-sm"
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                >
                  <option value={60}>1 Dakika (PRO/AGENCY)</option>
                  <option value={300}>5 Dakika (STARTER+)</option>
                  <option value={600}>10 Dakika (FREE+)</option>
                  <option value={1800}>30 Dakika</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Zaman Aşımı (Timeout sn)
                </label>
                <Input
                  type="number"
                  min={2}
                  max={60}
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Beklenen HTTP Kodu
                </label>
                <Input
                  value={expectedStatus}
                  onChange={(e) => setExpectedStatus(e.target.value)}
                  placeholder="200-399"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Etiketler (Virgülle ayırın)
              </label>
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="wordpress, eticaret, kurumsal"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-bold text-primary border-b border-border/60 pb-2">
              <ShieldCheck className="h-4 w-4" />
              <span>SSL & Yönlendirme Seçenekleri</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkSsl}
                  onChange={(e) => setCheckSsl(e.target.checked)}
                  className="rounded"
                />
                <span>SSL sertifika süresini otomatik kontrol et</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={followRedirects}
                  onChange={(e) => setFollowRedirects(e.target.checked)}
                  className="rounded"
                />
                <span>Yönlendirmeleri (301/302) takip et</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/monitors")}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              {loading ? "Ekleniyor..." : "Siteyi İzlemeye Başla"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
