"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Users,
  Activity,
  MailCheck,
  Search,
  UserCheck,
  ArrowLeft,
} from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui/primitives";
import { formatDateTR } from "@/lib/utils";

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  plan: "FREE" | "STARTER" | "PRO" | "AGENCY";
  planSiteLimit: number;
  suspended: boolean;
  emailVerified: string | null;
  createdAt: string;
  _count: { monitors: number };
}

interface PlanConfigRow {
  plan: "FREE" | "STARTER" | "PRO" | "AGENCY";
  name: string;
  siteLimit: number;
  minIntervalSeconds: number;
  retentionDays: number;
  priceTry: number;
}

export default function AdminPanelPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [system, setSystem] = useState<{
    queueHealth: {
      redisConnected: boolean;
      workerAlive: boolean;
      workerLastSeenAt: string | null;
      monitorQueueWaiting: number;
      monitorQueueActive: number;
      emailQueueWaiting: number;
      emailQueueFailed: number;
    };
    stats: {
      totalUsers: number;
      totalMonitors: number;
      downMonitors: number;
      sentEmailsCount: number;
      failedEmailsCount: number;
    };
    recentErrors: Array<{
      id: string;
      monitorName: string;
      url: string;
      checkedAt: string;
      error: string | null;
    }>;
    plans: PlanConfigRow[];
  } | null>(null);

  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadData = useCallback(async () => {
    const [uRes, sRes] = await Promise.all([
      fetch(`/api/admin/users?q=${encodeURIComponent(userSearch)}`),
      fetch("/api/admin/system"),
    ]);
    if (uRes.ok) {
      const ud = await uRes.json();
      setUsers(ud.users || []);
    }
    if (sRes.ok) {
      const sd = await sRes.json();
      setSystem(sd);
    }
  }, [userSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function updateUserPlan(userId: string, plan: string) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, plan }),
    });
    loadData();
  }

  async function toggleSuspendUser(u: AdminUserRow) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, suspended: !u.suspended }),
    });
    loadData();
  }

  async function impersonateUser(userId: string) {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.push("/dashboard");
  }

  async function handleSmtpTest(e: React.FormEvent) {
    e.preventDefault();
    setFeedback("SMTP test e-postası gönderiliyor...");
    const res = await fetch("/api/admin/system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "smtp-test", toEmail: smtpTestEmail }),
    });
    const d = await res.json();
    setFeedback(d.message || d.error);
    loadData();
  }

  async function handleSavePlan(p: PlanConfigRow) {
    const res = await fetch("/api/admin/system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-plan",
        ...p,
      }),
    });
    const d = await res.json();
    setFeedback(d.message || d.error);
    loadData();
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Artakip Sistem Yönetici Paneli (ADMIN)</h1>
            <p className="text-xs text-muted-foreground">
              Kullanıcı yönetimi, Worker/kuyruk durumu, plan fiyatlandırması ve SMTP test aracı.
            </p>
          </div>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Kullanıcı Paneline Dön
          </Button>
        </Link>
      </div>

      {feedback && (
        <div className="rounded-md bg-primary/15 border border-primary/30 p-3 text-sm">
          {feedback}
        </div>
      )}

      {/* Sistem Sağlık Kartları */}
      {system && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <span className="text-xs text-muted-foreground uppercase">
              Worker & Kuyruk Durumu
            </span>
            <div className="mt-2 flex items-center gap-2">
              {system.queueHealth.workerAlive ? (
                <Badge variant="success">Worker Canlı</Badge>
              ) : (
                <Badge variant="warning">Standby / Yerel Mod</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Kuyruk: {system.queueHealth.monitorQueueWaiting} bekleyen
              </span>
            </div>
          </Card>

          <Card className="p-4">
            <span className="text-xs text-muted-foreground uppercase">
              Toplam Kullanıcı / Site
            </span>
            <p className="text-2xl font-bold mt-1 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {system.stats.totalUsers} kullanıcı / {system.stats.totalMonitors} site
            </p>
          </Card>

          <Card className="p-4">
            <span className="text-xs text-muted-foreground uppercase">
              Şu An Kapalı Siteler
            </span>
            <p className="text-2xl font-bold text-rose-500 mt-1 flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {system.stats.downMonitors} DOWN
            </p>
          </Card>

          <Card className="p-4">
            <span className="text-xs text-muted-foreground uppercase">
              Gönderilen E-postalar
            </span>
            <p className="text-2xl font-bold text-emerald-500 mt-1 flex items-center gap-2">
              <MailCheck className="h-5 w-5" />
              {system.stats.sentEmailsCount} başarılı ({system.stats.failedEmailsCount} hata)
            </p>
          </Card>
        </div>
      )}

      {/* Kullanıcı Listesi */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Kullanıcı Yönetimi</h2>
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="E-posta veya ad ara..."
              className="pl-9"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="py-2.5 px-3">Kullanıcı</th>
                <th className="py-2.5 px-3">Site Sayısı</th>
                <th className="py-2.5 px-3">Plan Değiştir</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold">{u.name || "-"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    {u._count.monitors} / {u.planSiteLimit}
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-xs"
                      value={u.plan}
                      onChange={(e) => updateUserPlan(u.id, e.target.value)}
                    >
                      <option value="FREE">FREE (5)</option>
                      <option value="STARTER">STARTER (50)</option>
                      <option value="PRO">PRO (300)</option>
                      <option value="AGENCY">AGENCY (1000)</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    {u.suspended ? (
                      <Badge variant="danger">Askıda</Badge>
                    ) : (
                      <Badge variant="success">Aktif</Badge>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => impersonateUser(u.id)}
                      title="Bu kullanıcının adına panele gir"
                    >
                      <UserCheck className="h-3.5 w-3.5 mr-1" /> Hesaba Gir
                    </Button>
                    <Button
                      variant={u.suspended ? "secondary" : "destructive"}
                      size="sm"
                      onClick={() => toggleSuspendUser(u)}
                    >
                      {u.suspended ? "Aktifleştir" : "Askıya Al"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Plan Limitleri & Fiyatları ve SMTP Testi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold">Plan Limitleri ve Fiyatlarını Düzenle</h2>
          <div className="space-y-3">
            {system?.plans.map((p, idx) => (
              <div
                key={p.plan}
                className="grid grid-cols-5 gap-2 items-center border-b pb-2 text-xs"
              >
                <span className="font-bold">{p.plan}</span>
                <Input
                  type="number"
                  value={p.siteLimit}
                  title="Site Limiti"
                  onChange={(e) => {
                    const next = [...system.plans];
                    next[idx] = { ...p, siteLimit: Number(e.target.value) };
                    setSystem({ ...system, plans: next });
                  }}
                />
                <Input
                  type="number"
                  value={p.minIntervalSeconds}
                  title="Min Kontrol (sn)"
                  onChange={(e) => {
                    const next = [...system.plans];
                    next[idx] = {
                      ...p,
                      minIntervalSeconds: Number(e.target.value),
                    };
                    setSystem({ ...system, plans: next });
                  }}
                />
                <Input
                  type="number"
                  value={p.priceTry}
                  title="Fiyat (TL)"
                  onChange={(e) => {
                    const next = [...system.plans];
                    next[idx] = { ...p, priceTry: Number(e.target.value) };
                    setSystem({ ...system, plans: next });
                  }}
                />
                <Button size="sm" onClick={() => handleSavePlan(system.plans[idx])}>
                  Kaydet
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold">Genel SMTP Test E-postası Gönder</h2>
          <p className="text-xs text-muted-foreground">
            <code>.env</code> içindeki SMTP ayarlarınızı doğrulamak için test maili gönderin.
          </p>
          <form onSubmit={handleSmtpTest} className="flex gap-2">
            <Input
              type="email"
              placeholder="test@ornek.com"
              value={smtpTestEmail}
              onChange={(e) => setSmtpTestEmail(e.target.value)}
            />
            <Button type="submit">Test Gönder</Button>
          </form>

          <h3 className="text-sm font-bold pt-4">Son Kontrol Hataları</h3>
          <div className="max-h-48 overflow-y-auto divide-y text-xs">
            {system?.recentErrors.map((err) => (
              <div key={err.id} className="py-2 flex justify-between">
                <span>
                  <strong>{err.monitorName}</strong>: {err.error}
                </span>
                <span className="text-muted-foreground">
                  {formatDateTR(err.checkedAt)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
