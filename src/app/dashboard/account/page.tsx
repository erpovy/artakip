"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Save, Trash2, ExternalLink } from "lucide-react";
import { Button, Input, Card } from "@/components/ui/primitives";

export default function AccountPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [statusPageSlug, setStatusPageSlug] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setName(d.user.name || "");
          setEmail(d.user.email || "");
          setStatusPageSlug(d.user.statusPageSlug || "");
        }
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        statusPageSlug: statusPageSlug || undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Güncelleme başarısız.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setMessage(data.message);
  }

  async function handleDeleteAccount() {
    if (
      !confirm(
        "Hesabınızı ve izlenen tüm sitelerinizi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz (KVKK/GDPR)."
      )
    )
      return;

    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      signOut({ callbackUrl: "/" });
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hesap Ayarları</h1>
        <p className="text-sm text-muted-foreground">
          Profil bilgilerinizi, herkese açık durum sayfanızı ve şifrenizi yönetin.
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
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">E-posta Adresi</label>
            <Input value={email} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ad Soyad / Ajans Adı</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">
                Herkese Açık Durum Sayfası Kısa Adı (Slug)
              </label>
              {statusPageSlug && (
                <Link
                  href={`/status/${statusPageSlug}`}
                  target="_blank"
                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                >
                  /status/{statusPageSlug} <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
            <Input
              value={statusPageSlug}
              onChange={(e) => setStatusPageSlug(e.target.value)}
              placeholder="ajans-durum"
            />
          </div>

          <hr className="my-4" />
          <h3 className="text-sm font-bold">Şifre Değiştir (İsteğe Bağlı)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Mevcut Şifre</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Yeni Şifre (En az 8 karakter)
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="gap-2">
            <Save className="h-4 w-4" />
            Değişiklikleri Kaydet
          </Button>
        </form>
      </Card>

      <Card className="p-6 border-rose-500/30">
        <h2 className="text-lg font-bold text-rose-500 mb-2">
          Tehlikeli Bölge — Hesabı Sil (KVKK / GDPR)
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Hesabınızı sildiğinizde tüm siteleriniz, kontrol geçmişiniz, olay kayıtlarınız ve bildirim ayarlarınız veritabanından kalıcı olarak silinir.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteAccount}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Hesabımı ve Tüm Verilerimi Kalıcı Olarak Sil
        </Button>
      </Card>
    </div>
  );
}
