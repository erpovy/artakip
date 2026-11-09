"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Activity, Mail } from "lucide-react";
import { Button, Input, Card } from "@/components/ui/primitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devResetToken, setDevResetToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "İşlem başarısız.");
        return;
      }

      setMessage(data.message);
      if (data.resetTokenPreview) {
        setDevResetToken(data.resetTokenPreview);
      }
    } catch {
      setLoading(false);
      setError("Sunucu hatası oluştu.");
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
            <h1 className="text-xl font-bold">Şifremi Unuttum</h1>
            <p className="text-xs text-muted-foreground">
              Şifre sıfırlama bağlantısını e-postanıza gönderelim
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-rose-500/15 border border-rose-500/30 p-3 text-sm text-rose-500">
            {error}
          </div>
        )}

        {message ? (
          <div className="space-y-4">
            <div className="rounded-md bg-emerald-500/15 border border-emerald-500/30 p-4 text-sm text-emerald-500">
              {message}
            </div>
            {devResetToken && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
                <p className="font-semibold mb-1">Geliştirici Modu Sıfırlama Bağlantısı:</p>
                <Link
                  href={`/reset-password?token=${devResetToken}`}
                  className="text-primary underline break-all"
                >
                  Şifreyi Şimdi Sıfırla
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">E-posta Adresiniz</label>
              <Input
                type="email"
                required
                placeholder="ornek@ajans.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <Mail className="h-4 w-4" />
              {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Giriş ekranına dön
          </Link>
        </p>
      </Card>
    </div>
  );
}
