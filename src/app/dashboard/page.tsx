"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  Activity,
  PlusCircle,
  Upload,
  ArrowUpRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Card, Badge, Button, StatusPulse } from "@/components/ui/primitives";
import { formatDateTR, formatDurationTR } from "@/lib/utils";

interface DashboardData {
  user: {
    name?: string;
    email: string;
    plan: string;
    planSiteLimit: number;
    emailVerified: boolean;
  };
  summary: {
    totalMonitors: number;
    upMonitors: number;
    downMonitors: number;
    pausedMonitors: number;
    overallUptime: number;
    incidents24hCount: number;
  };
  recentIncidents: Array<{
    id: string;
    monitorId: string;
    startedAt: string;
    resolvedAt: string | null;
    reason: string | null;
    monitor: { id: string; name: string; url: string };
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
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

  const s = data?.summary || {
    totalMonitors: 0,
    upMonitors: 0,
    downMonitors: 0,
    pausedMonitors: 0,
    overallUptime: 100,
    incidents24hCount: 0,
  };

  const downCount = s.downMonitors;
  const allHealthy = downCount === 0 && s.totalMonitors > 0;

  return (
    <div className="space-y-8">
      {/* Üst Sistem Sağlık Bannerı */}
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
              <Badge
                variant={
                  downCount > 0 ? "danger" : allHealthy ? "success" : "outline"
                }
              >
                {downCount > 0
                  ? "Alarm Aktif"
                  : allHealthy
                  ? "100% Operasyonel"
                  : "Hazır"}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Toplam <strong>{s.totalMonitors}</strong> web sitesi gerçek zamanlı
              olarak denetleniyor • Genel çalışma oranı{" "}
              <strong>%{s.overallUptime}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <Link href="/dashboard/monitors">
            <Button variant="outline" size="sm" className="gap-1.5">
              Tüm Siteleri Gör ({s.totalMonitors}){" "}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 4'lü Bento KPI Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Toplam İzlenen Site
            </span>
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Globe className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold mt-3">
            {s.totalMonitors}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / {data?.user?.planSiteLimit ?? 5}
            </span>
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Aktif plan limiti</span>
            <span>{s.pausedMonitors} duraklatıldı</span>
          </div>
        </Card>

        <Card className="p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Şu An Açık (UP)
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold mt-3 text-emerald-500">
            {s.upMonitors}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Sorunsuz yanıt veriyor</span>
          </div>
        </Card>

        <Card className="p-5 relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Şu An Kapalı (DOWN)
            </span>
            <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold mt-3 text-rose-500">
            {s.downMonitors}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Son 24 saatte {s.incidents24hCount} olay</span>
          </div>
        </Card>

        <Card className="p-5 relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Genel Uptime (30 Gün)
            </span>
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold mt-3">%{s.overallUptime}</p>
          <div className="mt-3 w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, s.overallUptime)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Son 24 Saatteki Kesinti Zaman Çizelgesi */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-bold">
                Son 24 Saat Kesinti Zaman Çizelgesi
              </h2>
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
            <p className="font-bold text-sm">
              Son 24 saat içinde hiçbir kesinti yaşanmadı!
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              İzlenen tüm web siteleriniz belirlenen kontrol aralıklarında
              kesintisiz yanıt verdi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/70">
                <tr>
                  <th className="py-3.5 px-4">Site</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Kapanma Zamanı</th>
                  <th className="py-3.5 px-4">Açılma Zamanı</th>
                  <th className="py-3.5 px-4">Kesinti Süresi</th>
                  <th className="py-3.5 px-4">Hata Nedeni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.recentIncidents.map((inc) => {
                  const durationMs =
                    (inc.resolvedAt
                      ? new Date(inc.resolvedAt).getTime()
                      : Date.now()) - new Date(inc.startedAt).getTime();
                  return (
                    <tr
                      key={inc.id}
                      className="hover:bg-muted/25 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold">
                        <Link
                          href={`/dashboard/monitors/${inc.monitor.id}`}
                          className="hover:text-primary transition-colors inline-flex items-center gap-1.5"
                        >
                          {inc.monitor.name}
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        {inc.resolvedAt ? (
                          <Badge variant="success">Çözüldü (Açıldı)</Badge>
                        ) : (
                          <Badge variant="danger">Devam Ediyor (Kapalı)</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {formatDateTR(inc.startedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {inc.resolvedAt
                          ? formatDateTR(inc.resolvedAt)
                          : "Hâlâ Kapalı"}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-xs">
                        {formatDurationTR(durationMs)}
                      </td>
                      <td className="py-3.5 px-4 text-rose-500 text-xs font-mono">
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
    </div>
  );
}
