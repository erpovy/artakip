"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Pause,
  Play,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Clock,
  Save,
} from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui/primitives";
import { formatDateTR, formatDurationTR } from "@/lib/utils";

interface MonitorDetail {
  id: string;
  name: string;
  url: string;
  type: "HTTP" | "KEYWORD";
  keyword: string | null;
  intervalSeconds: number;
  timeoutSeconds: number;
  expectedStatus: string;
  wpCheckPath: string | null;
  paused: boolean;
  checkSsl: boolean;
  currentStatus: "UP" | "DOWN" | "UNKNOWN";
  lastCheckedAt: string | null;
  lastStatusChangeAt: string | null;
  sslExpiresAt: string | null;
  tags: string[];
  incidents: Array<{
    id: string;
    startedAt: string;
    resolvedAt: string | null;
    reason: string | null;
  }>;
  checks: Array<{
    id: string;
    checkedAt: string;
    status: "UP" | "DOWN" | "UNKNOWN";
    httpCode: number | null;
    responseMs: number | null;
    error: string | null;
  }>;
}

export default function MonitorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const monitorId = params.id;

  const [monitor, setMonitor] = useState<MonitorDetail | null>(null);
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  const [chartData, setChartData] = useState<
    Array<{ time: string; responseMs: number }>
  >([]);
  const [uptimePct, setUptimePct] = useState(100);
  const [avgMs, setAvgMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkingNow, setCheckingNow] = useState(false);

  // Düzenleme state
  const [editName, setEditName] = useState("");
  const [editInterval, setEditInterval] = useState(300);
  const [editTimeout, setEditTimeout] = useState(15);
  const [editKeyword, setEditKeyword] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const loadDetail = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [detailRes, checksRes] = await Promise.all([
        fetch(`/api/monitors/${monitorId}`, { cache: "no-store" }),
        fetch(`/api/monitors/${monitorId}/checks?range=${range}`, { cache: "no-store" }),
      ]);

      if (detailRes.ok) {
        const d = await detailRes.json();
        if (d?.monitor) {
          setMonitor({
            ...d.monitor,
            incidents: Array.isArray(d.monitor.incidents) ? d.monitor.incidents : [],
            checks: Array.isArray(d.monitor.checks) ? d.monitor.checks : [],
            tags: Array.isArray(d.monitor.tags) ? d.monitor.tags : [],
          });
          setEditName(d.monitor.name || "");
          setEditInterval(d.monitor.intervalSeconds || 300);
          setEditTimeout(d.monitor.timeoutSeconds || 15);
          setEditKeyword(d.monitor.keyword || "");
        }
      } else {
        const errData = await detailRes.json().catch(() => ({}));
        setErrorMsg(errData.error || `Site bilgileri alınamadı (HTTP ${detailRes.status}).`);
      }

      if (checksRes.ok) {
        const c = await checksRes.json();
        setUptimePct(c.uptimePercent ?? 100);
        setAvgMs(c.avgResponseMs ?? 0);
        setChartData(
          (Array.isArray(c.checks) ? c.checks : []).map(
            (item: { checkedAt: string; responseMs: number | null }) => ({
              time: new Date(item.checkedAt).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              responseMs: item.responseMs ?? 0,
            })
          )
        );
      }
    } catch {
      setErrorMsg("Sunucu ile bağlantı kurulurken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [monitorId, range]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function triggerCheckNow() {
    setCheckingNow(true);
    await fetch(`/api/monitors/${monitorId}/check-now`, { method: "POST" });
    await loadDetail();
    setCheckingNow(false);
  }

  async function togglePause() {
    if (!monitor) return;
    const ep = monitor.paused
      ? `/api/monitors/${monitor.id}/resume`
      : `/api/monitors/${monitor.id}/pause`;
    await fetch(ep, { method: "POST" });
    await loadDetail();
  }

  async function handleDelete() {
    if (!confirm("Bu siteyi ve tüm geçmiş kayıtlarını silmek istediğinize emin misiniz?"))
      return;
    await fetch(`/api/monitors/${monitorId}`, { method: "DELETE" });
    router.push("/dashboard/monitors");
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg("");
    const res = await fetch(`/api/monitors/${monitorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        intervalSeconds: Number(editInterval),
        timeoutSeconds: Number(editTimeout),
        keyword: editKeyword || null,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      setSaveMsg("Ayarlar güncellendi.");
      loadDetail();
    } else {
      setSaveMsg(d.error || "Hata oluştu.");
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Yükleniyor...</div>;
  }

  if (errorMsg || !monitor) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-sm text-rose-500 font-medium">
          {errorMsg || "Site detayı bulunamadı."}
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/monitors")}>
            Sitelere Dön
          </Button>
          <Button size="sm" onClick={() => { setLoading(true); loadDetail(); }}>
            Tekrar Dene
          </Button>
        </div>
      </Card>
    );
  }

  const sslDaysRemaining = monitor.sslExpiresAt
    ? Math.floor(
        (new Date(monitor.sslExpiresAt).getTime() - Date.now()) / 86_400_000
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Üst Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{monitor.name}</h1>
            {monitor.paused ? (
              <Badge variant="outline">Duraklatıldı</Badge>
            ) : monitor.currentStatus === "UP" ? (
              <Badge variant="success">● AÇIK (UP)</Badge>
            ) : monitor.currentStatus === "DOWN" ? (
              <Badge variant="danger">● KAPALI (DOWN)</Badge>
            ) : (
              <Badge variant="warning">Kontrol Bekleniyor</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {monitor.url}{" "}
            {monitor.wpCheckPath ? `(WP Kontrol Yolu: ${monitor.wpCheckPath})` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={triggerCheckNow}
            disabled={checkingNow}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${checkingNow ? "animate-spin" : ""}`}
            />
            {checkingNow ? "Kontrol Ediliyor..." : "Şimdi Kontrol Et"}
          </Button>
          <Button variant="outline" size="sm" onClick={togglePause}>
            {monitor.paused ? (
              <>
                <Play className="h-4 w-4 mr-1.5 text-emerald-500" /> Devam Ettir
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-1.5 text-amber-500" /> Duraklat
              </>
            )}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Sil
          </Button>
        </div>
      </div>

      {/* Özet Metrik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="text-xs text-muted-foreground uppercase">
            Uptime ({range})
          </span>
          <p className="text-2xl font-bold text-emerald-500 mt-1">%{uptimePct}</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-muted-foreground uppercase">
            Ort. Yanıt Süresi
          </span>
          <p className="text-2xl font-bold mt-1">{avgMs} ms</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-muted-foreground uppercase">
            Kontrol Aralığı
          </span>
          <p className="text-2xl font-bold mt-1 flex items-center gap-1.5">
            <Clock className="h-5 w-5 text-primary" />
            {monitor.intervalSeconds / 60} dk
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-muted-foreground uppercase">
            SSL Sertifikası
          </span>
          <p className="text-lg font-bold mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            {sslDaysRemaining !== null
              ? `${sslDaysRemaining} gün kaldı`
              : monitor.url.startsWith("https://")
              ? "Aktif (HTTPS)"
              : "HTTP"}
          </p>
        </Card>
      </div>

      {/* Yanıt Süresi Grafiği (Recharts) */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Yanıt Süresi Grafiği (ms)</h2>
          <div className="flex gap-1">
            {(["24h", "7d", "30d"] as const).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "outline"}
                onClick={() => setRange(r)}
              >
                {r === "24h" ? "24 Saat" : r === "7d" ? "7 Gün" : "30 Gün"}
              </Button>
            ))}
          </div>
        </div>
        <div className="h-64 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Henüz grafik için yeterli kontrol verisi yok. &quot;Şimdi Kontrol Et&quot; butonuna tıklayabilirsiniz.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="ms" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="responseMs"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  name="Yanıt Süresi (ms)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Olay Geçmişi Tablosu (Ne zaman kapandı -> Ne zaman açıldı -> Süre) */}
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">
          Kapanma / Açılma Olay Geçmişi (Incidents)
        </h2>
        {monitor.incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Bu sitede kayıtlı hiçbir kapanma olayı bulunmuyor.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="py-2.5 px-3">Durum</th>
                  <th className="py-2.5 px-3">Ne Zaman Kapandı</th>
                  <th className="py-2.5 px-3">Ne Zaman Açıldı</th>
                  <th className="py-2.5 px-3">Kesinti Süresi</th>
                  <th className="py-2.5 px-3">Hata Nedeni</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monitor.incidents.map((inc) => {
                  const durMs =
                    (inc.resolvedAt
                      ? new Date(inc.resolvedAt).getTime()
                      : Date.now()) - new Date(inc.startedAt).getTime();
                  return (
                    <tr key={inc.id}>
                      <td className="py-2.5 px-3">
                        {inc.resolvedAt ? (
                          <Badge variant="success">Açıldı</Badge>
                        ) : (
                          <Badge variant="danger">Hâlâ Kapalı</Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3">{formatDateTR(inc.startedAt)}</td>
                      <td className="py-2.5 px-3">
                        {inc.resolvedAt
                          ? formatDateTR(inc.resolvedAt)
                          : "Devam Ediyor"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {formatDurationTR(durMs)}
                      </td>
                      <td className="py-2.5 px-3 text-rose-500 text-xs">
                        {inc.reason || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Son Kontroller ve Hızlı Düzenleme */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">Son Kontroller (Checks)</h2>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 px-2">Tarih / Saat</th>
                  <th className="py-2 px-2">Durum</th>
                  <th className="py-2 px-2">HTTP</th>
                  <th className="py-2 px-2">Süre</th>
                  <th className="py-2 px-2">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monitor.checks.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-2">{formatDateTR(c.checkedAt)}</td>
                    <td className="py-2 px-2">
                      <Badge variant={c.status === "UP" ? "success" : "danger"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">{c.httpCode ?? "-"}</td>
                    <td className="py-2 px-2">
                      {c.responseMs !== null ? `${c.responseMs} ms` : "-"}
                    </td>
                    <td className="py-2 px-2 text-rose-500">{c.error || "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">Site Ayarlarını Düzenle</h2>
          {saveMsg && (
            <div className="mb-3 text-xs text-emerald-500 font-medium">
              {saveMsg}
            </div>
          )}
          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Site Adı</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Kontrol Aralığı (sn)
                </label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editInterval}
                  onChange={(e) => setEditInterval(Number(e.target.value))}
                >
                  <option value={60}>60 sn (1 dk)</option>
                  <option value={300}>300 sn (5 dk)</option>
                  <option value={600}>600 sn (10 dk)</option>
                  <option value={1800}>1800 sn (30 dk)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Timeout (sn)
                </label>
                <Input
                  type="number"
                  min={2}
                  max={60}
                  value={editTimeout}
                  onChange={(e) => setEditTimeout(Number(e.target.value))}
                />
              </div>
            </div>
            {monitor.type === "KEYWORD" && (
              <div>
                <label className="block text-xs font-medium mb-1">
                  Aranacak Anahtar Kelime
                </label>
                <Input
                  value={editKeyword}
                  onChange={(e) => setEditKeyword(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" size="sm" className="gap-1.5">
              <Save className="h-4 w-4" />
              Değişiklikleri Kaydet
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
