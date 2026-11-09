"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Save, Plus, Trash2, BellRing, Send, Users, History } from "lucide-react";
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
  const [testingMail, setTestingMail] = useState(false);

  async function handleSendTestEmail() {
    setTestingMail(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/settings/notifications", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Test e-postası gönderilemedi.");
      } else {
        setMessage(data.message || "Test e-postası gönderildi.");
      }
      loadSettings();
    } catch {
      setError("Test e-postası gönderilirken bağlantı hatası oluştu.");
    } finally {
      setTestingMail(false);
    }
  }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Bildirim Ayarları</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Kapanma/açılma e-postalarını, yanlış alarm eşiğini, sessiz saatleri ve ek alıcıları yönetin.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={testingMail}
          onClick={handleSendTestEmail}
          className="gap-2 shrink-0"
        >
          <Send className="h-4 w-4 text-primary" />
          {testingMail ? "Test E-postası Gönderiliyor..." : "Test E-postası Gönder"}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3.5 text-sm text-rose-500">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-sm text-emerald-500">
          {message}
        </div>
      )}

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex items-center gap-2 text-base font-bold border-b border-border/60 pb-3">
            <BellRing className="h-5 w-5 text-primary" />
            <h2>E-posta Tetikleme ve Yanlış Alarm Koruması</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background/40 cursor-pointer hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={notifyOnDown}
                onChange={(e) => setNotifyOnDown(e.target.checked)}
                className="rounded"
              />
              <span>Site <strong>kapandığında (DOWN)</strong> e-posta gönder</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background/40 cursor-pointer hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={notifyOnUp}
                onChange={(e) => setNotifyOnUp(e.target.checked)}
                className="rounded"
              />
              <span>Site <strong>tekrar açıldığında (UP)</strong> e-posta gönder</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background/40 cursor-pointer hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={notifyOnSslExpiry}
                onChange={(e) => setNotifyOnSslExpiry(e.target.checked)}
                className="rounded"
              />
              <span>SSL sertifika süresi yaklaşırken uyar</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background/40 cursor-pointer hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={digestDaily}
                onChange={(e) => setDigestDaily(e.target.checked)}
                className="rounded"
              />
              <span>Günlük uptime özet e-postası gönder</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background/40 cursor-pointer hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={digestWeekly}
                onChange={(e) => setDigestWeekly(e.target.checked)}
                className="rounded"
              />
              <span>Haftalık uptime özet e-postası gönder</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Ardışık Hata Eşiği
              </label>
              <Input
                type="number"
                min={1}
                max={10}
                value={failuresBeforeDown}
                onChange={(e) => setFailuresBeforeDown(Number(e.target.value))}
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Örn: 2 = İlk hatada 5sn sonra doğrular, 2. hatada DOWN maili atar.
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Saat Dilimi
              </label>
              <select
                className="h-10 w-full rounded-xl border border-input bg-background/80 px-3.5 text-sm"
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Sessiz Saatler Başlangıç (Örn: 23:00)
              </label>
              <Input
                placeholder="23:00"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Sessiz Saatler Bitiş (Örn: 07:00)
              </label>
              <Input
                placeholder="07:00"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
              />
            </div>
          </div>

          <h2 className="text-base font-bold border-b border-border/60 pb-2 pt-4">
            Webhook / Slack / Telegram Entegrasyonu (İsteğe Bağlı)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Genel Webhook URL
              </label>
              <Input
                placeholder="https://ornek.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Slack Webhook URL
              </label>
              <Input
                placeholder="https://hooks.slack.com/services/..."
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Telegram Chat ID
              </label>
              <Input
                placeholder="-100123456789"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              Bildirim Ayarlarını Kaydet
            </Button>
          </div>
        </form>
      </Card>

      {/* Ek Bildirim E-postaları (AlertContacts) */}
      <Card className="p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Ek Bildirim E-posta Alıcıları</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Ekip arkadaşlarınızın veya müşterilerinizin e-posta adreslerini ekleyin. Alarmlar bu adreslere de anında iletilir.
        </p>

        <form onSubmit={handleAddContact} className="flex gap-2.5 max-w-md">
          <Input
            type="email"
            required
            placeholder="ekip@ajans.com"
            value={newContactEmail}
            onChange={(e) => setNewContactEmail(e.target.value)}
          />
          <Button type="submit" size="sm" className="gap-1.5 h-10 px-4">
            <Plus className="h-4 w-4" /> Ekle
          </Button>
        </form>

        {devContactToken && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
            Geliştirici Modu Hızlı Doğrulama:{" "}
            <Link
              href={`/verify-email?token=${devContactToken}`}
              className="text-primary underline"
            >
              Ek E-postayı Doğrula
            </Link>
          </div>
        )}

        <div className="divide-y divide-border/60 border border-border/70 rounded-xl overflow-hidden">
          {contacts.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              Henüz ek bildirim e-postası eklenmedi.
            </div>
          ) : (
            contacts.map((c) => (
              <div
                key={c.id}
                className="p-3.5 flex items-center justify-between text-sm bg-background/40"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-medium">{c.email}</span>
                  {c.verified ? (
                    <Badge variant="success">Aktif Alıcı</Badge>
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
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">
            Son Gönderilen E-postalar (NotificationLog)
          </h2>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Henüz gönderilmiş bildirim kaydı yok.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border/70 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border/70 bg-muted/40 uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Tarih</th>
                  <th className="py-3 px-4">Tip</th>
                  <th className="py-3 px-4">Alıcı</th>
                  <th className="py-3 px-4">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3 px-4">{formatDateTR(l.sentAt, timezone)}</td>
                    <td className="py-3 px-4 font-bold">{l.type}</td>
                    <td className="py-3 px-4">{l.toEmail}</td>
                    <td className="py-3 px-4">
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
