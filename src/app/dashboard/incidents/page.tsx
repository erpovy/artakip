"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Download, Filter, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Button, Input, Card, Badge, StatusPulse } from "@/components/ui/primitives";
import { formatDateTR, formatDurationTR } from "@/lib/utils";

interface IncidentItem {
  id: string;
  monitorId: string;
  startedAt: string;
  resolvedAt: string | null;
  reason: string | null;
  durationMs: number;
  ongoing: boolean;
  monitor: { id: string; name: string; url: string };
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/incidents?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setIncidents(data.incidents || []);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const exportUrl = `/api/incidents/export?from=${encodeURIComponent(
    from
  )}&to=${encodeURIComponent(to)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Kesinti Olayları (Incidents)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Tüm sitelerinizdeki kapanma, tekrar açılma ve hata nedenlerinin tam zaman çizelgesi.
          </p>
        </div>
        <a href={exportUrl}>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            CSV Olarak Dışa Aktar
          </Button>
        </a>
      </div>

      {/* Tarih Filtresi */}
      <Card className="p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Başlangıç Tarihi
          </label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Bitiş Tarihi
          </label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={loadIncidents} className="gap-1.5 h-10">
          <Filter className="h-4 w-4" />
          Filtrele
        </Button>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Olaylar yükleniyor...
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-14 text-center space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="font-bold text-sm">Kesinti kaydı bulunamadı</p>
            <p className="text-xs text-muted-foreground">
              Seçilen tarih aralığında sitelerinizde herhangi bir kapanma yaşanmadı.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/70">
                <tr>
                  <th className="py-3.5 px-4">Site</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Kapanma Zamanı</th>
                  <th className="py-3.5 px-4">Tekrar Açılma Zamanı</th>
                  <th className="py-3.5 px-4">Kesinti Süresi</th>
                  <th className="py-3.5 px-4">Neden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-muted/25 transition-colors">
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
                      <div className="flex items-center gap-2">
                        <StatusPulse status={inc.ongoing ? "DOWN" : "UP"} size="sm" />
                        {inc.ongoing ? (
                          <Badge variant="danger">Devam Ediyor</Badge>
                        ) : (
                          <Badge variant="success">Çözüldü</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">{formatDateTR(inc.startedAt)}</td>
                    <td className="py-3.5 px-4 text-xs">
                      {inc.resolvedAt
                        ? formatDateTR(inc.resolvedAt)
                        : "Hâlâ Kapalı"}
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
