"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  Activity,
  Gauge,
  PlusCircle,
  Upload,
  ArrowUpRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Card, Badge, Button, StatusPulse } from "@/components/ui/primitives";
import { formatDateTR, formatDurationTR } from "@/lib/utils";

interface DashboardSummary {
  total: number;
  up: number;
  down: number;
  paused: number;
  unknown: number;
  uptime24h: number;
  avgLatencyMs: number;
  recentIncidents: Array<{
    id: string;
    monitorId: string;
    monitorName: string;
    monitorUrl: string;
    startedAt: string;
    resolvedAt: string | null;
    reason: string | null;
    durationMs: number;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 rounded-2xl bg-muted/50" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted/50" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-muted/50" />
      </div>
    );
  }

  const downCount = data?.down ?? 0;
  const allHealthy = downCount === 0 && (data?.total ?? 0) > 0;

  return (
    <div className="space-y-8">
      {/* Üst Başlık ve Sistem Sağlık Bannerı */}
      <div
        className={`rounded-2xl border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
          downCount > 0
            ? "border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent"
            : allHealthy
            ? "border-emerald-500/35 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent"
            : "border-border bg-card/80"
        }`}
      >
        <div className="flex items-start sm:items-center gap-4">
          <div className="mt-1 sm:mt-0">
            <StatusPulse
              status={downCount > 0 ? "DOWN" : allHealthy ? "UP" : "UNKNOWN"}
              size="lg"
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {downCount > 0
                  ? `Dikkat: ${downCount} Sitenizde Kesinti Tespit Edildi!`
                  : allHealthy
                  ? "Tüm Sistemler Sorunsuz Çalışıyor"
                  : "İzleme Komuta Merkezine Hoş Geldiniz"}
              </h1>
              <Badge variant={downCount > 0 ? "danger" : allHealthy ? "success" : "outline"}>
                {downCount > 0 ? "Alarm Aktif" : allHealthy ? "100% Operasyonel" : "Hazır"}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Toplam <strong>{data?.total ?? 0}</strong> web sitesi gerçek zamanlı olarak
              denetleniyor • Son 24 saatlik çalışma oranı{" "}
              <strong>%{data?.uptime24h ?? 100}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <Link href="/dashboard/monitors">
            <Button variant="outline" size="sm" className="gap-1.5">
              Tüm Siteleri Gör <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 4'lü Bento KPI Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Açık Siteler (UP)
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold mt-3 text-emerald-500">
            {data?.up ?? 0}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Toplam {data?.total ?? 0} site</span>
            <span>{data?.paused ?? 0} duraklatıldı</span>
          </div>
        </Card>

        <Card className="p-5 relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Kapalı Siteler (DOWN)
            </span>
            <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold mt-3 text-rose-500">
            {data?.down ?? 0}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Anlık kesinti</span>
            <span>{data?.unknown ?? 0} kontrol bekliyor</span>
          </div>
        </Card>

        <Card className="p-5 relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Son 24 Saat Uptime
            </span>
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold mt-3">
            %{data?.uptime24h ?? 100}
          </p>
          <div className="mt-3 w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, data?.uptime24h ?? 100)}%` }}
            />
          </div>
        </Card>

        <Card className="p-5 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ort. Yanıt Süresi
            </span>
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Gauge className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold mt-3">
            {data?.avgLatencyMs ?? 0}{" "}
            <span className="text-base font-semibold text-muted-foreground">ms</span>
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Son 24 saatlik HTTP yanıt ortalaması
          </p>
        </Card>
      </div>

      {/* Son 24 Saat Kesinti Zaman Çizelgesi */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-bold">Son 24 Saat Kesinti Zaman Çizelgesi</h2>
              <p className="text-xs text-muted-foreground">
                Kapanan ve tekrar açılan sitelerinizin anlık olay kayıtları
              </p>
            </div>
          </div>
          <Link href="/dashboard/incidents">
            <Button variant="ghost" size="sm" className="gap-1 text-primary">
              Tüm Olay Geçmişi <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {!data?.recentIncidents || data.recentIncidents.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-border/80 rounded-2xl bg-background/40 space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="font-bold text-sm">Son 24 saat içinde hiçbir kesinti yaşanmadı!</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              İzlenen tüm web siteleriniz belirlenen kontrol aralıklarında kesintisiz yanıt verdi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/70">
                <tr>
                  <th className="py-3.5 px-4">Site</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Başlangıç</th>
                  <th className="py-3.5 px-4">Bitiş</th>
                  <th className="py-3.5 px-4">Süre</th>
                  <th className="py-3.5 px-4">Hata Nedeni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.recentIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-muted/25 transition-colors">
                    <td className="py-3.5 px-4 font-semibold">
                      <Link
                        href={`/dashboard/monitors/${inc.monitorId}`}
                        className="hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        {inc.monitorName}
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      {inc.resolvedAt ? (
                        <Badge variant="success">Çözüldü</Badge>
                      ) : (
                        <Badge variant="danger">Devam Ediyor</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs">{formatDateTR(inc.startedAt)}</td>
                    <td className="py-3.5 px-4 text-xs">
                      {inc.resolvedAt ? formatDateTR(inc.resolvedAt) : "Hâlâ Kapalı"}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-xs">
                      {formatDurationTR(inc.durationMs)}
                    </td>
                    <td className="py-3.5 px-4 text-rose-500 text-xs font-mono">
                      {inc.reason || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
