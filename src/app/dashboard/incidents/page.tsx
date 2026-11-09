"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Download, Filter } from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui/primitives";
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
          <h1 className="text-2xl font-bold">Kesinti Olayları (Incidents)</h1>
          <p className="text-sm text-muted-foreground">
            Tüm sitelerinizdeki kapanma ve açılma zaman çizelgesi.
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
      <Card className="p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium mb-1">Başlangıç Tarihi</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Bitiş Tarihi</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={loadIncidents} className="gap-1.5">
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
          <div className="p-12 text-center text-sm text-muted-foreground">
            Seçilen tarih aralığında kesinti kaydı bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/40 border-b">
                <tr>
                  <th className="py-3 px-4">Site</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4">Kapanma Zamanı</th>
                  <th className="py-3 px-4">Tekrar Açılma Zamanı</th>
                  <th className="py-3 px-4">Kesinti Süresi</th>
                  <th className="py-3 px-4">Neden</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-semibold">
                      <Link
                        href={`/dashboard/monitors/${inc.monitor.id}`}
                        className="text-primary hover:underline"
                      >
                        {inc.monitor.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      {inc.ongoing ? (
                        <Badge variant="danger">Devam Ediyor</Badge>
                      ) : (
                        <Badge variant="success">Çözüldü</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">{formatDateTR(inc.startedAt)}</td>
                    <td className="py-3 px-4">
                      {inc.resolvedAt
                        ? formatDateTR(inc.resolvedAt)
                        : "Hâlâ Kapalı"}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {formatDurationTR(inc.durationMs)}
                    </td>
                    <td className="py-3 px-4 text-rose-500 text-xs">
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
