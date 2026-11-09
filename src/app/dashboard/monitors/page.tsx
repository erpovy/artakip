"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Upload,
  Pause,
  Play,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui/primitives";
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

  const loadMonitors = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      sort,
    });
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    if (tagFilter) params.set("tag", tagFilter);

    const res = await fetch(`/api/monitors?${params.toString()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    }
    setLoading(false);
  }, [page, q, statusFilter, tagFilter, sort]);

  useEffect(() => {
    loadMonitors();
  }, [loadMonitors]);

  async function togglePause(m: MonitorRow) {
    const endpoint = m.paused
      ? `/api/monitors/${m.id}/resume`
      : `/api/monitors/${m.id}/pause`;
    await fetch(endpoint, { method: "POST" });
    loadMonitors();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sitelerim ({total})</h1>
          <p className="text-sm text-muted-foreground">
            300+ web sitenizi arayın, duruma veya etikete göre filtreleyin ve yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadMonitors}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Yenile
          </Button>
          <Link href="/dashboard/monitors/import">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1.5" />
              CSV Yükle
            </Button>
          </Link>
          <Link href="/dashboard/monitors/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Site Ekle
            </Button>
          </Link>
        </div>
      </div>

      {/* Arama ve Filtre Çubuğu */}
      <Card className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Site adı veya URL ara..."
            className="pl-9"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          <option value="">Tüm Durumlar</option>
          <option value="UP">Açık (UP)</option>
          <option value="DOWN">Kapalı (DOWN)</option>
          <option value="UNKNOWN">Bekleniyor (UNKNOWN)</option>
        </select>
        <Input
          placeholder="Etiket filtrele (örn: wordpress)"
          value={tagFilter}
          onChange={(e) => {
            setPage(1);
            setTagFilter(e.target.value);
          }}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="createdAt_desc">En Yeni Eklenen</option>
          <option value="name_asc">Ada Göre (A-Z)</option>
          <option value="status">Duruma Göre</option>
          <option value="lastChecked">Son Kontrol Zamanı</option>
        </select>
      </Card>

      {/* Siteler Tablosu */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Siteler yükleniyor...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Kriterlere uygun site bulunamadı.
            </p>
            <Link href="/dashboard/monitors/new">
              <Button size="sm">İlk Sitenizi Ekleyin</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/40 border-b">
                <tr>
                  <th className="py-3.5 px-4">Site Adı & Etiketler</th>
                  <th className="py-3.5 px-4">URL</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Son Kontrol</th>
                  <th className="py-3.5 px-4">Yanıt Süresi</th>
                  <th className="py-3.5 px-4">30G Uptime</th>
                  <th className="py-3.5 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4">
                      <Link
                        href={`/dashboard/monitors/${m.id}`}
                        className="font-semibold text-primary hover:underline block"
                      >
                        {m.name}
                      </Link>
                      {m.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] bg-muted px-1.5 py-0.5 rounded"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        {m.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      {m.paused ? (
                        <Badge variant="outline">Duraklatıldı</Badge>
                      ) : m.currentStatus === "UP" ? (
                        <Badge variant="success">● AÇIK (UP)</Badge>
                      ) : m.currentStatus === "DOWN" ? (
                        <Badge variant="danger">● KAPALI (DOWN)</Badge>
                      ) : (
                        <Badge variant="warning">Kontrol Bekliyor</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {formatDateTR(m.lastCheckedAt)}
                    </td>
                    <td className="py-3 px-4">
                      {m.lastResponseMs !== null ? `${m.lastResponseMs} ms` : "-"}
                    </td>
                    <td className="py-3 px-4 font-semibold">%{m.uptime30d}</td>
                    <td className="py-3 px-4 text-right space-x-2">
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
                      <Link href={`/dashboard/monitors/${m.id}`}>
                        <Button variant="outline" size="sm">
                          Detay
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between text-xs">
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
