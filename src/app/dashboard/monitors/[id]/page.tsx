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
} from "recharts";
import {
  Pause,
  Play,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Clock,
  Save,
  ExternalLink,
  Activity,
  Gauge,
} from "lucide-react";
import {
  Button,
  Input,
  Card,
  Badge,
  StatusPulse,
} from "@/components/ui/primitives";
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
        fetch(`/api/monitors/${monitorId}/checks?range=${range}`, {
          cache: "no-store",
        }),
      ]);

      if (detailRes.ok) {
        const d = await detailRes.json();
        if (d?.monitor) {
          setMonitor({
            ...d.monitor,
            incidents: Array.isArray(d.monitor.incidents)
              ? d.monitor.incidents
              : [],
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
        setErrorMsg(
          errData.error ||
            `Site bilgileri alınamadı (HTTP ${detailRes.status}).`
        );
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
    if (
      !confirm(
        "Bu siteyi ve tüm geçmiş kayıtlarını silmek istediğinize emin misiniz?"
      )
    )
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
        keyword: monitor?.type === "KEYWORD" ? editKeyword : null,
      }),
    });
    if (res.ok) {
      setSaveMsg("Ayarlar kaydedildi.");
      loadDetail();
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        Site detayları yükleniyor...
      </div>
    );
  }

  if (!monitor) {
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-rose-500 font-semibold">
          {errorMsg || "Site bulunamadı."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard/monitors")}
        >
          Siteler Listesine Dön
        </Button>
      </Card>
    );
  }

  const sslDaysLeft = monitor.sslExpiresAt
    ? Math.ceil(
        (new Date(monitor.sslExpiresAt).getTime() - Date.now()) / 86_400_000
      )
    : null;

  const recentTicks = [...monitor.checks].slice(0, 40).reverse();
  const displayStatus = monitor.paused ? "PAUSED" : monitor.currentStatus;

  return (
    <div className="space-y-8">
      {/* Üst Hero Kartı */}
      <Card className="p-6 border-border/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <StatusPulse status={displayStatus} size="lg" />
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold tracking-tight">
                  {monitor.name}
                </h1>
                {monitor.paused ? (
                  <Badge variant="outline">Duraklatıldı</Badge>
                ) : monitor.currentStatus === "UP" ? (
                  <Badge variant="success">Çalışıyor (UP)</Badge>
                ) : monitor.currentStatus === "DOWN" ? (
                  <Badge variant="danger">Kapalı (DOWN)</Badge>
                ) : (
                  <Badge variant="warning">Kontrol Bekliyor</Badge>
                )}
              </div>
              <a
                href={monitor.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 mt-1 font-mono"
              >
                {monitor.url} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              size="sm"
              onClick={triggerCheckNow}
              disabled={checkingNow}
              className="gap-1.5"
            >
              <RefreshCw
                className={`h-4 w-4 ${checkingNow ? "animate-spin" : ""}`}
              />
              {checkingNow ? "Kontrol Ediliyor..." : "Şimdi Kontrol Et"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={togglePause}
              className="gap-1.5"
            >
              {monitor.paused ? (
                <>
                  <Play className="h-4 w-4" /> Devam Ettir
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" /> Duraklat
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" /> Sil
            </Button>
          </div>
        </div>

        {/* Canlı Kontrol Nabız Çubuğu (Son 40 Kontrol) */}
        <div className="mt-6 pt-5 border-t border-border/60">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-semibold text-foreground">
              Son Kontroller Nabız Çizelgesi
            </span>
            <span>Son kontrol: {formatDateTR(monitor.lastCheckedAt)}</span>
          </div>
          <div className="flex items-center gap-1 h-7">
            {recentTicks.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Henüz kontrol kaydı bulunmuyor.
              </div>
            ) : (
              recentTicks.map((chk) => (
                <div
                  key={chk.id}
                  title={`${formatDateTR(chk.checkedAt)} — ${chk.status} (${
                    chk.responseMs ?? 0
                  } ms)`}
                  className={`flex-1 h-full rounded-sm transition-transform hover:scale-y-110 ${
                    chk.status === "UP"
                      ? "bg-emerald-500/85 hover:bg-emerald-400"
                      : "bg-rose-500 hover:bg-rose-400"
                  }`}
                />
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Uptime ve SSL Özeti */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-bold uppercase">
            <span>Uptime ({range})</span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-500 mt-2">
            %{uptimePct}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-bold uppercase">
            <span>Ortalama Yanıt Süresi</span>
            <Gauge className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-3xl font-extrabold mt-2">
            {avgMs}{" "}
            <span className="text-sm font-normal text-muted-foreground">ms</span>
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-bold uppercase">
            <span>Kontrol Aralığı</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-extrabold mt-2">
            Her {Math.round(monitor.intervalSeconds / 60)} dk
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-bold uppercase">
            <span>SSL Sertifikası</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-extrabold mt-2 flex items-center gap-1.5">
            {sslDaysLeft !== null
              ? `${sslDaysLeft} gün kaldı`
              : "HTTPS Yok / Bekleniyor"}
          </p>
        </Card>
      </div>

      {/* Yanıt Süresi Grafiği */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold">Yanıt Süresi Grafiği (ms)</h2>
            <p className="text-xs text-muted-foreground">
              Sunucu yanıt hızı zaman grafiği
            </p>
          </div>
          <div className="flex gap-1.5 bg-muted/60 p-1 rounded-xl">
            {(["24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  range === r
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Henüz kontrol verisi oluşmadı. &quot;Şimdi Kontrol Et&quot; butonuna
            tıklayın.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" fontSize={11} stroke="#64748b" />
                <YAxis fontSize={11} stroke="#64748b" unit="ms" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="responseMs"
                  stroke="#3b82f6"
                  fill="url(#latencyGrad)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Kesinti Geçmişi ve Site Ayarları */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold">Kesinti Geçmişi (Incidents)</h2>
          {monitor.incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bu sitede henüz hiçbir kesinti kaydı oluşmadı.
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {monitor.incidents.map((inc) => {
                const dur =
                  (inc.resolvedAt
                    ? new Date(inc.resolvedAt).getTime()
                    : Date.now()) - new Date(inc.startedAt).getTime();
                return (
                  <div
                    key={inc.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-background/50 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      {inc.resolvedAt ? (
                        <Badge variant="success">Çözüldü</Badge>
                      ) : (
                        <Badge variant="danger">Devam Ediyor</Badge>
                      )}
                      <span className="font-bold">
                        Süre: {formatDurationTR(dur)}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Başlangıç: {formatDateTR(inc.startedAt)} • Bitiş:{" "}
                      {inc.resolvedAt
                        ? formatDateTR(inc.resolvedAt)
                        : "Hâlâ Kapalı"}
                    </p>
                    {inc.reason && (
                      <p className="text-rose-500 font-mono">
                        Neden: {inc.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">Site İzleme Ayarları</h2>
          {saveMsg && (
            <div className="mb-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs font-medium text-emerald-500">
              {saveMsg}
            </div>
          )}
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Site Adı
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Kontrol Aralığı (sn)
                </label>
                <select
                  className="h-10 w-full rounded-xl border border-input bg-background/80 px-3.5 text-sm"
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
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
