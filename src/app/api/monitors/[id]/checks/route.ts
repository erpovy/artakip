import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Site bulunamadı." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "24h";
  let hours = 24;
  if (range === "7d") hours = 24 * 7;
  else if (range === "30d") hours = 24 * 30;

  const since = new Date(Date.now() - hours * 3600 * 1000);

  const checks = await prisma.check.findMany({
    where: {
      monitorId: monitor.id,
      checkedAt: { gte: since },
    },
    orderBy: { checkedAt: "asc" },
    take: 500,
  });

  const totalCount = checks.length;
  const upCount = checks.filter((c) => c.status === "UP").length;
  const uptimePercent =
    totalCount > 0 ? Number(((upCount / totalCount) * 100).toFixed(2)) : 100;

  const avgResponseMs =
    totalCount > 0
      ? Math.round(
          checks.reduce((acc, c) => acc + (c.responseMs || 0), 0) / totalCount
        )
      : 0;

  return NextResponse.json({
    range,
    uptimePercent,
    avgResponseMs,
    checks: checks.map((c) => ({
      id: c.id.toString(),
      checkedAt: c.checkedAt,
      status: c.status,
      httpCode: c.httpCode,
      responseMs: c.responseMs,
      error: c.error,
    })),
  });
}
