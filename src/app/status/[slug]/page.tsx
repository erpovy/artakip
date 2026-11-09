import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/primitives";
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
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {user.name || "Servis"} Durum Sayfası
              </h1>
              <p className="text-xs text-muted-foreground">
                Canlı Sistem ve Web Sitesi Çalışırlık Durumu ({tz})
              </p>
            </div>
          </div>
          <Link href="/" className="text-xs text-primary hover:underline">
            Artakip ile güçlendirildi
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
            <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-rose-500 shrink-0" />
          )}
          <div>
            <h2 className="text-lg font-bold">
              {allOperational
                ? "Tüm Sistemler Sorunsuz Çalışıyor"
                : `${downCount} Sitede Kesinti Tespit Edildi`}
            </h2>
            <p className="text-xs text-muted-foreground">
              Toplam {total} servis izleniyor • Son güncelleme:{" "}
              {formatDateTR(new Date(), tz)}
            </p>
          </div>
        </Card>

        <Card className="divide-y">
          {user.monitors.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Henüz herkese açık izlenen bir servis bulunmuyor.
            </div>
          ) : (
            user.monitors.map((m) => (
              <div
                key={m.id}
                className="p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Son kontrol: {formatDateTR(m.lastCheckedAt, tz)}
                  </p>
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
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
