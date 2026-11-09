"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui/primitives";
import { DEFAULT_PLANS } from "@/lib/plans";

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState("FREE");
  const [planLimit, setPlanLimit] = useState(5);
  const [usedSites, setUsedSites] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  function loadAccount() {
    fetch("/api/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setCurrentPlan(d.user.plan);
          setPlanLimit(d.user.planSiteLimit);
          setUsedSites(d.user._count?.monitors || 0);
        }
      });
  }

  useEffect(() => {
    loadAccount();
  }, []);

  async function selectPlan(planKey: string) {
    setMessage("");
    setError("");
    setLoadingPlan(planKey);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      setLoadingPlan(null);

      if (!res.ok) {
        setError(data.error || "Plan değiştirilemedi.");
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setMessage(data.message);
      loadAccount();
    } catch {
      setLoadingPlan(null);
      setError("Sunucu hatası.");
    }
  }

  const plans = Object.values(DEFAULT_PLANS);
  const usagePercent = Math.min(
    100,
    Math.round((usedSites / Math.max(1, planLimit)) * 100)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Abonelik ve Faturalama
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Mevcut planınızı, site kullanım limitinizi görüntüleyin ve istediğiniz zaman planınızı yükseltin.
        </p>
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

      {/* Mevcut Kullanım Kartı */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold">Mevcut Planınız:</h2>
              <Badge variant="default" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {currentPlan}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Toplam <strong>{planLimit}</strong> site hakkınızdan{" "}
              <strong>{usedSites}</strong> tanesini kullanıyorsunuz (%{usagePercent}).
            </p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </Card>

      {/* Plan Seçenekleri */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p) => {
          const isCurrent = p.plan === currentPlan;
          return (
            <Card
              key={p.plan}
              className={`p-6 flex flex-col justify-between transition-all ${
                isCurrent
                  ? "border-primary ring-2 ring-primary/30 shadow-xl shadow-blue-500/10"
                  : ""
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  {isCurrent && <Badge variant="success">Aktif Plan</Badge>}
                </div>
                <div className="my-4">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {p.priceTry === 0 ? "Ücretsiz" : `₺${p.priceTry}`}
                  </span>
                  {p.priceTry > 0 && (
                    <span className="text-xs text-muted-foreground"> / ay</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-5 pb-4 border-b border-border/60">
                  <strong>{p.siteLimit}</strong> Site • Min.{" "}
                  <strong>{p.minIntervalSeconds / 60} dk</strong> kontrol •{" "}
                  <strong>{p.retentionDays} gün</strong> geçmiş
                </p>
                <ul className="space-y-2.5 text-xs mb-6">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                variant={isCurrent ? "outline" : "default"}
                disabled={isCurrent || loadingPlan === p.plan}
                onClick={() => selectPlan(p.plan)}
                className="w-full"
              >
                {isCurrent
                  ? "Mevcut Planınız"
                  : loadingPlan === p.plan
                  ? "İşleniyor..."
                  : `${p.name} Planına Geç`}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
