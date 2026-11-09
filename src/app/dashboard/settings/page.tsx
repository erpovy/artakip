"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Save, Plus, Trash2 } from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui/primitives";
import { formatDateTR } from "@/lib/utils";

interface ContactItem {
  id: string;
  email: string;
  verified: boolean;
}

interface LogItem {
  id: string;
  type: string;
  toEmail: string;
  success: boolean;
  error: string | null;
  sentAt: string;
}

export default function NotificationSettingsPage() {
  const [notifyOnDown, setNotifyOnDown] = useState(true);
  const [notifyOnUp, setNotifyOnUp] = useState(true);
  const [notifyOnSslExpiry, setNotifyOnSslExpiry] = useState(true);
  const [sslExpiryDaysBefore, setSslExpiryDaysBefore] = useState(14);
  const [failuresBeforeDown, setFailuresBeforeDown] = useState(2);
  const [digestDaily, setDigestDaily] = useState(false);
  const [digestWeekly, setDigestWeekly] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("");
  const [quietHoursEnd, setQuietHoursEnd] = useState("");
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogItem[]>([]);
  const [newContactEmail, setNewContactEmail] = useState("");
  const [devContactToken, setDevContactToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings/notifications");
    if (!res.ok) return;
    const data = await res.json();
    const s = data.settings;
    if (s) {
      setNotifyOnDown(s.notifyOnDown);
      setNotifyOnUp(s.notifyOnUp);
      setNotifyOnSslExpiry(s.notifyOnSslExpiry);
      setSslExpiryDaysBefore(s.sslExpiryDaysBefore);
      setFailuresBeforeDown(s.failuresBeforeDown);
      setDigestDaily(s.digestDaily);
      setDigestWeekly(s.digestWeekly);
      setQuietHoursStart(s.quietHoursStart || "");
      setQuietHoursEnd(s.quietHoursEnd || "");
      setTimezone(s.timezone || "Europe/Istanbul");
      setWebhookUrl(s.webhookUrl || "");
      setSlackWebhookUrl(s.slackWebhookUrl || "");
      setTelegramChatId(s.telegramChatId || "");
    }
    setContacts(data.contacts || []);
    setRecentLogs(data.recentLogs || []);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    const res = await fetch("/api/settings/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notifyOnDown,
        notifyOnUp,
        notifyOnSslExpiry,
        sslExpiryDaysBefore: Number(sslExpiryDaysBefore),
        failuresBeforeDown: Number(failuresBeforeDown),
        digestDaily,
        digestWeekly,
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
        timezone,
        webhookUrl: webhookUrl || "",
        slackWebhookUrl: slackWebhookUrl || "",
        telegramChatId: telegramChatId || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Ayarlar kaydedilemedi.");
      return;
    }
    setMessage(data.message);
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDevContactToken("");
    const res = await fetch("/api/settings/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newContactEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "E-posta eklenemedi.");
      return;
    }
    setNewContactEmail("");
    if (data.verifyTokenPreview) {
      setDevContactToken(data.verifyTokenPreview);
    }
    loadSettings();
  }

  async function handleDeleteContact(id: string) {
    await fetch(`/api/settings/contacts/${id}`, { method: "DELETE" });
    loadSettings();
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Bildirim Ayarları</h1>
        <p className="text-sm text-muted-foreground">
          Kapanma/açılma e-postalarını, yanlış alarm eşiğini, sessiz saatleri ve ek alıcıları yönetin.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-rose-500/15 border border-rose-500/30 p-3 text-sm text-rose-500">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md bg-emerald-500/15 border border-emerald-500/30 p-3 text-sm text-emerald-500">
          {message}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <h2 className="text-lg font-bold border-b pb-2">
            E-posta Tetikleme ve Yanlış Alarm Koruması
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnDown}
                onChange={(e) => setNotifyOnDown(e.target.checked)}
              />
              <span>Site <strong>kapandığında</strong> e-posta gönder</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnUp}
                onChange={(e) => setNotifyOnUp(e.target.checked)}
              />
              <span>Site <strong>tekrar açıldığında</strong> e-posta gönder</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnSslExpiry}
                onChange={(e) => setNotifyOnSslExpiry(e.target.checked)}
              />
              <span>SSL sertifika süresi yaklaşırken uyar</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={digestDaily}
                onChange={(e) => setDigestDaily(e.target.checked)}
              />
              <span>Günlük uptime özet e-postası gönder</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={digestWeekly}
                onChange={(e) => setDigestWeekly(e.target.checked)}
              />
              <span>Haftalık uptime özet e-postası gönder</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Ardışık Hata Eşiği (Yanlış Alarm Koruması)
              </label>
              <Input
                type="number"
                min={1}
                max={10}
                value={failuresBeforeDown}
                onChange={(e) => setFailuresBeforeDown(Number(e.target.value))}
              />
              <span className="text-[11px] text-muted-foreground">
                Örn: 2 = İlk hatada 5sn sonra tekrar dener, 2. hatada DOWN maili atar.
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                SSL Uyarısı (Kaç Gün Kala)
              </label>
              <Input
                type="number"
                min={1}
                max={90}
                value={sslExpiryDaysBefore}
                onChange={(e) => setSslExpiryDaysBefore(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Saat Dilimi</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="Europe/Istanbul">Europe/Istanbul (GMT+3)</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium mb-1">
                Sessiz Saatler Başlangıç (Örn: 23:00)
              </label>
              <Input
                placeholder="23:00"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Sessiz Saatler Bitiş (Örn: 07:00)
              </label>
              <Input
                placeholder="07:00"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
              />
            </div>
          </div>

          <h2 className="text-lg font-bold border-b pb-2 pt-4">
            Webhook / Slack / Telegram Entegrasyonu (İsteğe Bağlı)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Genel Webhook URL</label>
              <Input
                placeholder="https://ornek.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Slack Webhook URL</label>
              <Input
                placeholder="https://hooks.slack.com/services/..."
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Telegram Chat ID</label>
              <Input
                placeholder="-100123456789"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="gap-2">
            <Save className="h-4 w-4" />
            Bildirim Ayarlarını Kaydet
          </Button>
        </form>
      </Card>

      {/* Ek Bildirim E-postaları (AlertContacts) */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-bold">Ek Bildirim E-posta Alıcıları</h2>
        <p className="text-xs text-muted-foreground">
          Ekip arkadaşlarınızın veya müşterilerinizin e-posta adreslerini ekleyin. Doğrulandıktan sonra alarmlar bu adreslere de iletilir.
        </p>

        <form onSubmit={handleAddContact} className="flex gap-2 max-w-md">
          <Input
            type="email"
            required
            placeholder="ekip@ajans.com"
            value={newContactEmail}
            onChange={(e) => setNewContactEmail(e.target.value)}
          />
          <Button type="submit" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Ekle
          </Button>
        </form>

        {devContactToken && (
          <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
            Geliştirici Modu Hızlı Doğrulama:{" "}
            <Link
              href={`/verify-email?token=${devContactToken}`}
              className="text-primary underline"
            >
              Ek E-postayı Doğrula
            </Link>
          </div>
        )}

        <div className="divide-y border rounded-md">
          {contacts.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              Henüz ek bildirim e-postası eklenmedi.
            </div>
          ) : (
            contacts.map((c) => (
              <div
                key={c.id}
                className="p-3 flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>{c.email}</span>
                  {c.verified ? (
                    <Badge variant="success">Doğrulandı</Badge>
                  ) : (
                    <Badge variant="warning">Doğrulama Bekliyor</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteContact(c.id)}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Son Gönderilen Bildirim Kayıtları */}
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">
          Son Gönderilen E-postalar (NotificationLog)
        </h2>
        {recentLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Henüz gönderilmiş bildirim kaydı yok.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 px-3">Tarih</th>
                  <th className="py-2 px-3">Tip</th>
                  <th className="py-2 px-3">Alıcı</th>
                  <th className="py-2 px-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 px-3">{formatDateTR(l.sentAt, timezone)}</td>
                    <td className="py-2 px-3 font-semibold">{l.type}</td>
                    <td className="py-2 px-3">{l.toEmail}</td>
                    <td className="py-2 px-3">
                      {l.success ? (
                        <Badge variant="success">Gönderildi</Badge>
                      ) : (
                        <Badge variant="danger">Hata: {l.error}</Badge>
                      )}
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
