"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, XCircle, Eye, FileSpreadsheet } from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui/primitives";

interface ReportItem {
  line: number;
  name: string;
  url: string;
  valid: boolean;
  error?: string;
}

export default function CsvImportPage() {
  const router = useRouter();
  const [csvText, setCsvText] = useState(
    "ad,url\nÖrnek WordPress 1,https://wordpress.org\nÖrnek WordPress 2,https://woocommerce.com"
  );
  const [tag, setTag] = useState("wordpress");
  const [preview, setPreview] = useState<{
    validCount: number;
    invalidCount: number;
    limitAllowed: boolean;
    limitReason?: string;
    remainingSlots: number;
    report: ReportItem[];
  } | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(String(ev.target?.result || ""));
      setPreview(null);
    };
    reader.readAsText(file, "utf-8");
  }

  async function runPreview() {
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/monitors/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, tag, dryRun: true }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "Önizleme yapılamadı.");
        return;
      }
      setPreview(data);
    } catch {
      setLoading(false);
      setError("Sunucu hatası.");
    }
  }

  async function handleImport() {
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/monitors/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, tag, dryRun: false }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "İçe aktarma başarısız.");
        return;
      }
      setSuccessMsg(data.message);
      setTimeout(() => router.push("/dashboard/monitors"), 1500);
    } catch {
      setLoading(false);
      setError("Sunucu hatası.");
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          CSV ile Toplu Site İçe Aktarma
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          300+ WordPress sitenizi <code>ad,url</code> formatında tek seferde yükleyin, SSRF ve plan limiti kontrolüyle önizleyin.
        </p>
      </div>

      <Card className="p-6 sm:p-8 space-y-5">
        {error && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3.5 text-sm text-rose-500">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-sm text-emerald-500">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              CSV Dosyası Seçin (.csv / .txt)
            </label>
            <Input type="file" accept=".csv,.txt" onChange={handleFileUpload} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Toplu Etiket (İsteğe Bağlı)
            </label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="wordpress"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            CSV İçeriği (Her satırda <code>Site Adı,https://siteadresi.com</code>)
          </label>
          <textarea
            rows={8}
            className="w-full rounded-xl border border-input bg-background/80 p-3.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setPreview(null);
            }}
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={runPreview}
            disabled={loading}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Önizle ve Doğrula
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={loading || (preview !== null && !preview.limitAllowed)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {loading ? "İşleniyor..." : "Geçerli Siteleri İçe Aktar"}
          </Button>
        </div>
      </Card>

      {preview && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Önizleme ve Doğrulama Raporu</h2>
            </div>
            <div className="flex gap-2">
              <Badge variant="success">{preview.validCount} Geçerli</Badge>
              <Badge variant="danger">{preview.invalidCount} Hatalı</Badge>
              <Badge variant="outline">
                Kalan Plan Hakkı: {preview.remainingSlots}
              </Badge>
            </div>
          </div>

          {!preview.limitAllowed && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3.5 text-sm text-rose-500">
              {preview.limitReason}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto border border-border/70 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border/70 uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3">Satır</th>
                  <th className="py-2.5 px-3">Site Adı</th>
                  <th className="py-2.5 px-3">URL</th>
                  <th className="py-2.5 px-3">Durum / Hata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {preview.report.map((row) => (
                  <tr key={row.line}>
                    <td className="py-2.5 px-3">{row.line}</td>
                    <td className="py-2.5 px-3 font-medium">{row.name}</td>
                    <td className="py-2.5 px-3 font-mono">{row.url}</td>
                    <td className="py-2.5 px-3">
                      {row.valid ? (
                        <span className="text-emerald-500 inline-flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Hazır
                        </span>
                      ) : (
                        <span className="text-rose-500 inline-flex items-center gap-1 font-medium">
                          <XCircle className="h-3.5 w-3.5" /> {row.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
