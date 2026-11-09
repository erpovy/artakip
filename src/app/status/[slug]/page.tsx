import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, Badge, StatusPulse, UptimeHeartbeatBar } from "@/components/ui/primitives";
import { formatDateTR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PublicStatusPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await prisma.user.findUnique({
    where: { statusPageSlug: params.slug },
    include: {
      monitors: {
        where: { paused: false },
        orderBy: { name: "asc" },
      },
      settings: true,
    },
  });

  if (!user) {
    notFound();
  }

  const total = user.monitors.length;
  const downCount = user.monitors.filter((m) => m.currentStatus === "DOWN").length;
  const allOperational = downCount === 0;
  const tz = user.settings?.timezone || "Europe/Istanbul";

  return (
    <div className="min-h-screen bg-background bg-radial-glow py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {user.name || "Servis"} Durum Sayfası
              </h1>
              <p className="text-xs text-muted-foreground">
                Canlı Sistem ve Web Sitesi Çalışırlık Durumu ({tz})
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Artakip Uptime Cloud ile güçlendirildi
          </Link>
        </div>

        <Card
          className={`p-6 flex items-center gap-4 ${
            allOperational
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-rose-500/40 bg-rose-500/10"
          }`}
        >
          {allOperational ? (
            <CheckCircle2 className="h-9 w-9 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-9 w-9 text-rose-500 shrink-0" />
          )}
          <div>
            <h2 className="text-lg font-extrabold">
              {allOperational
                ? "Tüm Sistemler Sorunsuz Çalışıyor"
                : `${downCount} Sitede Kesinti Tespit Edildi`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toplam {total} servis izleniyor • Son güncelleme:{" "}
              {formatDateTR(new Date(), tz)}
            </p>
          </div>
        </Card>

        <Card className="divide-y divide-border/60 overflow-hidden">
          {user.monitors.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Henüz herkese açık izlenen bir servis bulunmuyor.
            </div>
          ) : (
            user.monitors.map((m) => (
              <div
                key={m.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <StatusPulse
                    status={m.currentStatus as "UP" | "DOWN" | "PAUSED" | "UNKNOWN"}
                    size="md"
                  />
                  <div>
                    <p className="font-bold text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Son kontrol: {formatDateTR(m.lastCheckedAt, tz)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-6">
                  <div className="hidden md:block">
                    <UptimeHeartbeatBar
                      status={m.currentStatus as "UP" | "DOWN" | "PAUSED" | "UNKNOWN"}
                      bars={20}
                    />
                  </div>
                  <Badge
                    variant={
                      m.currentStatus === "UP"
                        ? "success"
                        : m.currentStatus === "DOWN"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {m.currentStatus === "UP"
                      ? "Çalışıyor (UP)"
                      : m.currentStatus === "DOWN"
                      ? "Kapalı (DOWN)"
                      : "Bekleniyor"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
