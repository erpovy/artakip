"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Activity, User, Mail, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button, Input, Card } from "@/components/ui/primitives";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kayıt işlemi başarısız oldu.");
        setLoading(false);
        return;
      }

      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Sunucu bağlantı hatası oluştu.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-radial-glow px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-35 pointer-events-none" />
      <Card className="relative z-10 w-full max-w-md p-8 space-y-6 border-border/80 shadow-2xl">
        <div className="flex flex-col items-center text-center space-y-2">
          <Link href="/" className="flex items-center gap-2.5 mb-2 group">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Activity className="h-6 w-6" />
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Ücretsiz Hesap Oluşturun</h1>
          <p className="text-xs text-muted-foreground">
            5 web sitesine kadar ücretsiz izleme ile kesintileri anında yakalayın
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3.5 text-xs font-medium text-rose-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ad Soyad veya Ajans Adı
            </label>
            <div className="relative">
              <User className="h-4 w-4 absolute left-3.5 top-3 text-muted-foreground" />
              <Input
                type="text"
                required
                placeholder="Örn: Ahmet Yılmaz"
                className="pl-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              E-posta Adresi (Alarmlar Buraya Gönderilir)
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 absolute left-3.5 top-3 text-muted-foreground" />
              <Input
                type="email"
                required
                placeholder="ornek@ajans.com"
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Şifre (En az 8 karakter)
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3.5 top-3 text-muted-foreground" />
              <Input
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                className="pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
            {loading ? "Hesap Oluşturuluyor..." : "Ücretsiz Kayıt Ol ve Başla"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="pt-2 border-t border-border/60 space-y-3 text-center">
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Anında kurulum
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> E-posta alarmları aktif
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Zaten hesabınız var mı?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Giriş Yapın
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
