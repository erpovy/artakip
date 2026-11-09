import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTR, formatDurationTR } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const monitorId = searchParams.get("monitorId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.IncidentWhereInput = {
    monitor: { userId: user.id },
  };

  if (monitorId) where.monitorId = monitorId;
  if (from || to) {
    where.startedAt = {};
    if (from) where.startedAt.gte = new Date(from);
    if (to) where.startedAt.lte = new Date(to);
  }

  const settings = await prisma.notificationSettings.findUnique({
    where: { userId: user.id },
  });
  const tz = settings?.timezone || "Europe/Istanbul";

  const incidents = await prisma.incident.findMany({
    where,
    include: {
      monitor: { select: { name: true, url: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 1000,
  });

  const header = "Site Adı,URL,Kapanma Zamanı,Açılma Zamanı,Kesinti Süresi,Hata Nedeni";
  const rows = incidents.map((inc) => {
    const startStr = formatDateTR(inc.startedAt, tz);
    const endStr = inc.resolvedAt ? formatDateTR(inc.resolvedAt, tz) : "Devam Ediyor";
    const durMs =
      (inc.resolvedAt ? inc.resolvedAt.getTime() : Date.now()) - inc.startedAt.getTime();
    const durStr = formatDurationTR(durMs);
    const escapeCsv = (val: string) => `"${(val || "").replace(/"/g, '""')}"`;
    return [
      escapeCsv(inc.monitor.name),
      escapeCsv(inc.monitor.url),
      escapeCsv(startStr),
      escapeCsv(endStr),
      escapeCsv(durStr),
      escapeCsv(inc.reason || "-"),
    ].join(",");
  });

  const csvContent = "\uFEFF" + [header, ...rows].join("\n");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="artakip-olaylar-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
