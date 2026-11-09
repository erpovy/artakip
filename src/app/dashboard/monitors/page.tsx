"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  PlusCircle,
  ExternalLink,
  Upload,
  Lock,
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

interface MonitorItem {
  id: string;
  name: string;
  url: string;
  type: string;
  intervalSeconds: number;
  paused: boolean;
  currentStatus: "UP" | "DOWN" | "PAUSED" | "UNKNOWN";
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  sslDaysRemaining: number | null;
  tags: string;
}

export default function MonitorsListPage() {
  const [monitors, setMonitors] = useState<MonitorItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const fetchMonitors = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("q", search);
    if (tag) params.set("tag", tag);

    const res = await fetch(`/api/monitors?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setMonitors(data.monitors || []);
    }
    setLoading(false);
  }, [statusFilter, search, tag]);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  async function handleCheckNow(id: string) {
    setCheckingId(id);
    await fetch(`/api/monitors/${id}/check-now`, { method: "POST" });
    await fetchMonitors();
    setCheckingId(null);
  }

  async function handleBulkAction(action: "pause" | "resume" | "delete") {
    if (selectedIds.length === 0) return;
    if (
      action === "delete" &&
      !confirm("Seçili siteleri silmek istediğinize emin misiniz?")
    ) {
      return;
    }

    await fetch("/api/monitors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action }),
    });
    setSelectedIds([]);
    fetchMonitors();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === monitors.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(monitors.map((m) => m.id));
    }
  }

  const filterTabs = [
    { value: "", label: "Tümü" },
    { value: "UP", label: "Açık (UP)" },
    { value: "DOWN", label: "Kapalı (DOWN)" },
    { value: "PAUSED", label: "Duraklatılmış" },
    { value: "UNKNOWN", label: "Bekleniyor" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">İzlenen Siteler</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Tüm WordPress ve kurumsal web sitelerinizin canlı çalışma durumu, yanıt süresi ve SSL sağlığı.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/monitors/import">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" />
              CSV İçe Aktar
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

      {/* Durum Sekmeleri & Arama Çubuğu */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
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

          <Button
            variant="outline"
            size="sm"
            onClick={fetchMonitors}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Listeyi Yenile
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="h-4 w-4 absolute left-3.5 top-3 text-muted-foreground" />
            <Input
              placeholder="Site adı veya URL ile ara..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Input
            placeholder="Etikete göre filtrele (örn: wordpress)"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </div>
      </Card>

      {/* Toplu İşlem Çubuğu */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between bg-primary/10 border border-primary/30 rounded-2xl px-5 py-3 text-sm">
          <span className="font-bold text-primary">
            {selectedIds.length} site seçildi
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("pause")}
              className="gap-1.5"
            >
              <Pause className="h-3.5 w-3.5" /> Duraklat
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("resume")}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" /> Devam Ettir
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction("delete")}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Sil
            </Button>
          </div>
        </div>
      )}

      {/* Siteler Tablosu */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Siteler yükleniyor...
          </div>
        ) : monitors.length === 0 ? (
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
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        monitors.length > 0 &&
                        selectedIds.length === monitors.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Site & URL</th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Uptime Nabzı</th>
                  <th className="py-3.5 px-4">Yanıt Süresi</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">SSL Ömrü</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Son Kontrol</th>
                  <th className="py-3.5 px-4 text-right">Hızlı Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {monitors.map((m) => {
                  const displayStatus = m.paused ? "PAUSED" : m.currentStatus;
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-muted/25 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(m.id)}
                          onChange={() => toggleSelect(m.id)}
                          className="rounded"
                        />
                      </td>
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
                      </td>
                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        <UptimeHeartbeatBar status={displayStatus} bars={18} />
                      </td>
                      <td className="py-3.5 px-4">
                        {m.lastLatencyMs !== null ? (
                          <span
                            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold ${
                              m.lastLatencyMs < 400
                                ? "bg-emerald-500/10 text-emerald-500"
                                : m.lastLatencyMs < 1000
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-rose-500/10 text-rose-500"
                            }`}
                          >
                            {m.lastLatencyMs} ms
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        {m.sslDaysRemaining !== null ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              m.sslDaysRemaining <= 14
                                ? "text-rose-500 font-bold"
                                : "text-muted-foreground"
                            }`}
                          >
                            <Lock className="h-3 w-3" />
                            {m.sslDaysRemaining} gün
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground hidden sm:table-cell">
                        {formatDateTR(m.lastCheckedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
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
                          <span className="text-xs">Şimdi Kontrol Et</span>
                        </Button>
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
