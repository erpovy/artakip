"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe,
  CheckCircle2,
  XCircle,
  Activity,
  Plus,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui/primitives";
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
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Veriler yükleniyor...</div>;
  }

  const s = data?.summary || {
    totalMonitors: 0,
    upMonitors: 0,
    downMonitors: 0,
    pausedMonitors: 0,
    overallUptime: 100,
    incidents24hCount: 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Genel Bakış (Dashboard)</h1>
          <p className="text-sm text-muted-foreground">
            Web sitelerinizin canlı durumu, son 24 saatteki olaylar ve genel uptime oranı.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/monitors/import">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" />
              CSV İçe Aktar
            </Button>
          </Link>
          <Link href="/dashboard/monitors/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Yeni Site Ekle
            </Button>
          </Link>
        </div>
      </div>

      {data?.user && !data.user.emailVerified && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-3 text-sm text-amber-500">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            E-posta adresiniz henüz doğrulanmamış. Güvenlik kuralları gereği e-posta doğrulaması tamamlanmadan kesinti bildirim e-postaları gönderilmez.
          </span>
        </div>
      )}

      {/* Özet Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase">Toplam İzlenen Site</span>
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <div className="text-3xl font-bold">
            {s.totalMonitors}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / {data?.user?.planSiteLimit ?? 5}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {s.pausedMonitors} duraklatılmış
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase">Şu An Açık (UP)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-500">{s.upMonitors}</div>
          <p className="text-xs text-muted-foreground mt-1">Sorunsuz yanıt veriyor</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase">Şu An Kapalı (DOWN)</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-3xl font-bold text-rose-500">{s.downMonitors}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Son 24 saatte {s.incidents24hCount} olay
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase">Genel Uptime (30 Gün)</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="text-3xl font-bold">%{s.overallUptime}</div>
          <p className="text-xs text-muted-foreground mt-1">Tüm aktif siteler ortalaması</p>
        </Card>
      </div>

      {/* Son 24 Saatteki Olaylar */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Son 24 Saatteki Kesinti Olayları</h2>
          <Link
            href="/dashboard/incidents"
            className="text-xs text-primary hover:underline"
          >
            Tüm Olay Geçmişini Gör →
          </Link>
        </div>

        {!data?.recentIncidents || data.recentIncidents.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Harika! Son 24 saat içinde hiçbir sitenizde kesinti yaşanmadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="py-3 px-3">Site</th>
                  <th className="py-3 px-3">Durum</th>
                  <th className="py-3 px-3">Kapanma Zamanı</th>
                  <th className="py-3 px-3">Açılma Zamanı</th>
                  <th className="py-3 px-3">Kesinti Süresi</th>
                  <th className="py-3 px-3">Hata Nedeni</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.recentIncidents.map((inc) => {
                  const durationMs =
                    (inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : Date.now()) -
                    new Date(inc.startedAt).getTime();
                  return (
                    <tr key={inc.id} className="hover:bg-muted/30">
                      <td className="py-3 px-3 font-medium">
                        <Link
                          href={`/dashboard/monitors/${inc.monitor.id}`}
                          className="text-primary hover:underline"
                        >
                          {inc.monitor.name}
                        </Link>
                      </td>
                      <td className="py-3 px-3">
                        {inc.resolvedAt ? (
                          <Badge variant="success">Çözüldü (Açıldı)</Badge>
                        ) : (
                          <Badge variant="danger">Devam Ediyor (Kapalı)</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3">{formatDateTR(inc.startedAt)}</td>
                      <td className="py-3 px-3">
                        {inc.resolvedAt ? formatDateTR(inc.resolvedAt) : "Hâlâ Kapalı"}
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        {formatDurationTR(durationMs)}
                      </td>
                      <td className="py-3 px-3 text-rose-500 text-xs">
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
