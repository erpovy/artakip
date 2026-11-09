"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button, Input, Card } from "@/components/ui/primitives";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Şifre güncellenemedi.");
        return;
      }
      setMessage(data.message);
    } catch {
      setLoading(false);
      setError("Sunucu hatası.");
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-xl font-bold mb-2">Yeni Şifre Belirle</h1>
      <p className="text-xs text-muted-foreground mb-6">
        Hesabınız için en az 8 karakterli yeni bir şifre belirleyin.
      </p>

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
          <Link href="/login">
            <Button className="w-full">Giriş Yap</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Yeni Şifre</label>
            <Input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading || !token}>
            <KeyRound className="h-4 w-4" />
            {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
          </Button>
        </form>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Suspense fallback={<div>Yükleniyor...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
