"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Save,
  ExternalLink,
  ShieldCheck,
  Clock,
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

interface CheckRecord {
  id: string;
  status: "UP" | "DOWN";
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
  checkedAt: string;
}

interface IncidentRecord {
  id: string;
  startedAt: string;
  resolvedAt: string | null;
  reason: string | null;
}

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
  currentStatus: "UP" | "DOWN" | "PAUSED" | "UNKNOWN";
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  sslDaysRemaining: number | null;
  sslIssuer: string | null;
  tags: string;
  checks: CheckRecord[];
  incidents: IncidentRecord[];
}

export default function MonitorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [monitor, setMonitor] = useState<MonitorDetail | null>(null);
  const [stats, setStats] = useState<{
    uptime24h: number;
    uptime7d: number;
    uptime30d: number;
    avgLatencyMs: number;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editInterval, setEditInterval] = useState(600);
  const [message, setMessage] = useState("");

  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/monitors/${params.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setMonitor(data.monitor);
    setStats(data.stats);
    setEditName(data.monitor.name);
    setEditUrl(data.monitor.url);
    setEditInterval(data.monitor.intervalSeconds);
  }, [params.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function handleCheckNow() {
    setChecking(true);
    await fetch(`/api/monitors/${params.id}/check-now`, { method: "POST" });
    await loadDetail();
    setChecking(false);
  }

  async function handleTogglePause() {
    if (!monitor) return;
    await fetch(`/api/monitors/${monitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: !monitor.paused }),
    });
    loadDetail();
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!monitor) return;
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/monitors/${monitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        url: editUrl,
        intervalSeconds: Number(editInterval),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("Ayarlar başarıyla güncellendi.");
      loadDetail();
    }
  }

  async function handleDelete() {
    if (!monitor) return;
    if (!confirm("Bu siteyi ve tüm geçmişini silmek istediğinize emin misiniz?"))
      return;
    await fetch(`/api/monitors/${monitor.id}`, { method: "DELETE" });
    router.push("/dashboard/monitors");
  }

  if (!monitor) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        Site detayları yükleniyor...
      </div>
    );
  }

  const chartData = [...monitor.checks]
    .reverse()
    .map((c) => ({
      time: new Date(c.checkedAt).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      latency: c.latencyMs,
    }));

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
                  <Badge variant="warning">Kontrol Bekleniyor</Badge>
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
              onClick={handleCheckNow}
              disabled={checking}
              className="gap-1.5"
            >
              <RefreshCw
                className={`h-4 w-4 ${checking ? "animate-spin" : ""}`}
              />
              {checking ? "Kontrol Ediliyor..." : "Şimdi Kontrol Et"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePause}
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
                  title={`${formatDateTR(chk.checkedAt)} — ${chk.status} (${chk.latencyMs} ms)`}
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
            <span>Son 24 Saat Uptime</span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-500 mt-2">
            %{stats?.uptime24h ?? 100}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-bold uppercase">
            <span>7 / 30 Gün Uptime</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-extrabold mt-2">
            %{stats?.uptime7d ?? 100}{" "}
            <span className="text-muted-foreground font-normal text-base">/</span>{" "}
            %{stats?.uptime30d ?? 100}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-bold uppercase">
            <span>Ortalama Yanıt Süresi</span>
            <Gauge className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-3xl font-extrabold mt-2">
            {stats?.avgLatencyMs ?? 0}{" "}
            <span className="text-sm font-normal text-muted-foreground">ms</span>
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-bold uppercase">
            <span>SSL Sertifikası</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-extrabold mt-2 flex items-center gap-1.5">
            {monitor.sslDaysRemaining !== null
              ? `${monitor.sslDaysRemaining} gün kaldı`
              : "HTTPS Yok / Bekleniyor"}
          </p>
          {monitor.sslIssuer && (
            <p className="text-[11px] text-muted-foreground truncate mt-1">
              Sağlayıcı: {monitor.sslIssuer}
            </p>
          )}
        </Card>
      </div>

      {/* Yanıt Süresi (Latency) Grafiği */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Yanıt Süresi Grafiği (ms)</h2>
            <p className="text-xs text-muted-foreground">
              Son kontrollerdeki sunucu yanıt hızı (milisaniye)
            </p>
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Henüz kontrol verisi oluşmadı. &quot;Şimdi Kontrol Et&quot; butonuna tıklayın.
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
                  dataKey="latency"
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
          {message && (
            <div className="mb-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs font-medium text-emerald-500">
              {message}
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
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Site URL
              </label>
              <Input
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Kontrol Aralığı
              </label>
              <select
                className="h-10 w-full rounded-xl border border-input bg-background/80 px-3.5 text-sm"
                value={editInterval}
                onChange={(e) => setEditInterval(Number(e.target.value))}
              >
                <option value={60}>1 Dakika</option>
                <option value={300}>5 Dakika</option>
                <option value={600}>10 Dakika</option>
                <option value={1800}>30 Dakika</option>
              </select>
            </div>
            <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
