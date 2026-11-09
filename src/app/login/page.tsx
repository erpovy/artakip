"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";
import { Button, Input, Card } from "@/components/ui/primitives";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("E-posta veya şifre hatalı ya da hesabınız askıya alınmış.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md p-8 space-y-6 border-border/80 shadow-2xl">
      <div className="flex flex-col items-center text-center space-y-2">
        <Link href="/" className="flex items-center gap-2.5 mb-2 group">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
            <Activity className="h-6 w-6" />
          </div>
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Tekrar Hoş Geldiniz</h1>
        <p className="text-xs text-muted-foreground">
          Artakip komuta merkezine erişmek için hesabınıza giriş yapın
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
            E-posta Adresi
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
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Şifre
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Şifremi Unuttum
            </Link>
          </div>
          <div className="relative">
            <Lock className="h-4 w-4 absolute left-3.5 top-3 text-muted-foreground" />
            <Input
              type="password"
              required
              placeholder="••••••••"
              className="pl-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
          {loading ? "Giriş Yapılıyor..." : "Panele Giriş Yap"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="pt-2 border-t border-border/60 text-center space-y-3">
        <p className="text-xs text-muted-foreground">
          Henüz hesabınız yok mu?{" "}
          <Link href="/register" className="text-primary font-semibold hover:underline">
            Ücretsiz Kayıt Olun
          </Link>
        </p>
        <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>256-bit TLS şifreli oturum koruması</span>
        </div>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-radial-glow px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-35 pointer-events-none" />
      <div className="relative z-10 w-full flex justify-center">
        <Suspense fallback={<div className="text-sm text-muted-foreground">Yükleniyor...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
