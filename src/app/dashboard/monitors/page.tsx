"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Pause,
  Play,
  PlusCircle,
  ExternalLink,
  Upload,
} from "lucide-react";
import {
  Button,
  Input,
  Card,
  Badge,
  StatusPulse,
  UptimeHeartbeatBar,
} from "@/components/ui/primitives";
import { formatDateTR } from "@/lib/utils";

interface MonitorRow {
  id: string;
  name: string;
  url: string;
  type: string;
  intervalSeconds: number;
  paused: boolean;
  currentStatus: "UP" | "DOWN" | "UNKNOWN";
  lastCheckedAt: string | null;
  lastResponseMs: number | null;
  uptime30d: number;
  tags: string[];
}

export default function MonitorsListPage() {
  const [items, setItems] = useState<MonitorRow[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sort, setSort] = useState("createdAt_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const loadMonitors = useCallback(
    async (forceCheck = false) => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
        sort,
      });
      if (q) params.set("q", q);
      if (statusFilter) params.set("status", statusFilter);
      if (tagFilter) params.set("tag", tagFilter);
      if (forceCheck) params.set("check", "1");

      const res = await fetch(`/api/monitors?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || data.monitors || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
      setLoading(false);
    },
    [page, q, statusFilter, tagFilter, sort]
  );

  useEffect(() => {
    loadMonitors();
  }, [loadMonitors]);

  async function handleCheckNow(id: string) {
    setCheckingId(id);
    await fetch(`/api/monitors/${id}/check-now`, { method: "POST" });
    await loadMonitors();
    setCheckingId(null);
  }

  async function togglePause(m: MonitorRow) {
    const endpoint = m.paused
      ? `/api/monitors/${m.id}/resume`
      : `/api/monitors/${m.id}/pause`;
    await fetch(endpoint, { method: "POST" });
    loadMonitors();
  }

  const filterTabs = [
    { value: "", label: "Tümü" },
    { value: "UP", label: "Açık (UP)" },
    { value: "DOWN", label: "Kapalı (DOWN)" },
    { value: "UNKNOWN", label: "Bekleniyor" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            İzlenen Siteler ({total})
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Tüm WordPress ve kurumsal web sitelerinizin canlı çalışma durumu, yanıt süresi ve 30 günlük uptime oranı.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMonitors(true)}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Şimdi Kontrol Et & Yenile
          </Button>
          <Link href="/dashboard/monitors/import">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" />
              CSV Yükle
            </Button>
          </Link>
          <Link href="/dashboard/monitors/new">
            <Button size="sm" className="gap-1.5">
              <PlusCircle className="h-4 w-4" />
              Yeni Site Ekle
            </Button>
          </Link>
        </div>
      </div>

      {/* Durum Sekmeleri & Arama/Filtre Çubuğu */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setPage(1);
                  setStatusFilter(tab.value);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            className="h-9 rounded-xl border border-input bg-background/80 px-3 text-xs font-medium"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="createdAt_desc">En Yeni Eklenen</option>
            <option value="name_asc">Ada Göre (A-Z)</option>
            <option value="status">Duruma Göre</option>
            <option value="lastChecked">Son Kontrol Zamanı</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="h-4 w-4 absolute left-3.5 top-3 text-muted-foreground" />
            <Input
              placeholder="Site adı veya URL ile ara..."
              className="pl-10"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </div>
          <Input
            placeholder="Etikete göre filtrele (örn: wordpress)"
            value={tagFilter}
            onChange={(e) => {
              setPage(1);
              setTagFilter(e.target.value);
            }}
          />
        </div>
      </Card>

      {/* Siteler Tablosu */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Siteler yükleniyor...
          </div>
        ) : items.length === 0 ? (
          <div className="p-14 text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Henüz izlenen bir web sitesi bulunamadı.
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/dashboard/monitors/new">
                <Button size="sm">İlk Sitenizi Ekleyin</Button>
              </Link>
              <Link href="/dashboard/monitors/import">
                <Button variant="outline" size="sm">
                  CSV İle Toplu Yükleyin
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/70">
                <tr>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Site & URL</th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Uptime Nabzı</th>
                  <th className="py-3.5 px-4">Yanıt Süresi</th>
                  <th className="py-3.5 px-4">30G Uptime</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Son Kontrol</th>
                  <th className="py-3.5 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((m) => {
                  const displayStatus = m.paused ? "PAUSED" : m.currentStatus;
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-muted/25 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <StatusPulse status={displayStatus} size="sm" />
                          {m.paused ? (
                            <Badge variant="outline">Duraklatıldı</Badge>
                          ) : m.currentStatus === "UP" ? (
                            <Badge variant="success">Açık (UP)</Badge>
                          ) : m.currentStatus === "DOWN" ? (
                            <Badge variant="danger">Kapalı (DOWN)</Badge>
                          ) : (
                            <Badge variant="warning">Bekleniyor</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/dashboard/monitors/${m.id}`}
                          className="font-bold text-foreground hover:text-primary transition-colors block"
                        >
                          {m.name}
                        </Link>
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono mt-0.5"
                        >
                          {m.url} <ExternalLink className="h-3 w-3" />
                        </a>
                        {Array.isArray(m.tags) && m.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.tags.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        <UptimeHeartbeatBar status={displayStatus} bars={18} />
                      </td>
                      <td className="py-3.5 px-4">
                        {m.lastResponseMs !== null && m.lastResponseMs !== undefined ? (
                          <span
                            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold ${
                              m.lastResponseMs < 400
                                ? "bg-emerald-500/10 text-emerald-500"
                                : m.lastResponseMs < 1000
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-rose-500/10 text-rose-500"
                            }`}
                          >
                            {m.lastResponseMs} ms
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-xs">
                        %{m.uptime30d ?? 100}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground hidden sm:table-cell">
                        {formatDateTR(m.lastCheckedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePause(m)}
                          title={m.paused ? "İzlemeyi Başlat" : "İzlemeyi Duraklat"}
                        >
                          {m.paused ? (
                            <Play className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Pause className="h-4 w-4 text-amber-500" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={checkingId === m.id}
                          onClick={() => handleCheckNow(m.id)}
                          className="gap-1.5"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${
                              checkingId === m.id ? "animate-spin text-primary" : ""
                            }`}
                          />
                          <span className="text-xs">Kontrol Et</span>
                        </Button>
                        <Link href={`/dashboard/monitors/${m.id}`}>
                          <Button variant="secondary" size="sm">
                            Detay
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs">
            <span>
              Sayfa {page} / {totalPages} (Toplam {total} site)
            </span>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
