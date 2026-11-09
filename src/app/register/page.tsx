"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Activity, UserPlus } from "lucide-react";
import { Button, Input, Card } from "@/components/ui/primitives";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [devVerifyToken, setDevVerifyToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Kayıt başarısız oldu.");
        return;
      }

      setSuccessMsg(data.message);
      if (data.verificationTokenPreview) {
        setDevVerifyToken(data.verificationTokenPreview);
      }
    } catch {
      setLoading(false);
      setError("Sunucu bağlantı hatası.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Artakip Hesabı Oluştur</h1>
            <p className="text-xs text-muted-foreground">
              Sitelerinizi 7/24 izlemeye hemen başlayın
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-rose-500/15 border border-rose-500/30 p-3 text-sm text-rose-500">
            {error}
          </div>
        )}

        {successMsg ? (
          <div className="space-y-4">
            <div className="rounded-md bg-emerald-500/15 border border-emerald-500/30 p-4 text-sm text-emerald-500">
              {successMsg}
            </div>
            {devVerifyToken && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
                <p className="font-semibold mb-1">Geliştirici Modu Hızlı Doğrulama:</p>
                <Link
                  href={`/verify-email?token=${devVerifyToken}`}
                  className="text-primary underline break-all"
                >
                  E-postayı Şimdi Doğrula (/verify-email?token={devVerifyToken})
                </Link>
              </div>
            )}
            <Link href="/login">
              <Button className="w-full mt-2">Giriş Sayfasına Git</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ad Soyad / Ajans Adı</label>
              <Input
                type="text"
                required
                placeholder="Örn: Ahmet Yılmaz"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-posta Adresi</label>
              <Input
                type="email"
                required
                placeholder="ornek@ajans.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Şifre (En az 8 karakter)
              </label>
              <Input
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <UserPlus className="h-4 w-4" />
              {loading ? "Kaydediliyor..." : "Ücretsiz Kayıt Ol"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Giriş Yapın
          </Link>
        </p>
      </Card>
    </div>
  );
}
