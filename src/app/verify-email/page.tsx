"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("E-posta adresiniz doğrulanıyor...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Doğrulama anahtarı bulunamadı.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message);
        } else {
          setStatus("error");
          setMessage(data.error || "Doğrulama başarısız oldu.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Sunucu bağlantı hatası.");
      });
  }, [token]);

  return (
    <Card className="w-full max-w-md p-8 text-center">
      {status === "loading" && <p className="text-sm">{message}</p>}
      {status === "success" && (
        <div className="space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold">Doğrulama Başarılı!</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Link href="/login">
            <Button className="w-full mt-2">Giriş Yap</Button>
          </Link>
        </div>
      )}
      {status === "error" && (
        <div className="space-y-4">
          <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold">Doğrulama Hatası</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Link href="/login">
            <Button variant="outline" className="w-full mt-2">
              Giriş Sayfasına Dön
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Suspense fallback={<div>Yükleniyor...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
