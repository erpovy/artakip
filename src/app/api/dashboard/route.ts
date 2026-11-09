import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const since24h = new Date(Date.now() - 24 * 3600 * 1000);
  const since30d = new Date(Date.now() - 30 * 86_400_000);

  const [
    totalMonitors,
    upMonitors,
    downMonitors,
    pausedMonitors,
    recentIncidents,
    totalChecks30d,
    upChecks30d,
  ] = await Promise.all([
    prisma.monitor.count({ where: { userId: user.id } }),
    prisma.monitor.count({
      where: { userId: user.id, currentStatus: "UP", paused: false },
    }),
    prisma.monitor.count({
      where: { userId: user.id, currentStatus: "DOWN", paused: false },
    }),
    prisma.monitor.count({ where: { userId: user.id, paused: true } }),
    prisma.incident.findMany({
      where: {
        monitor: { userId: user.id },
        startedAt: { gte: since24h },
      },
      include: {
        monitor: { select: { id: true, name: true, url: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 15,
    }),
    prisma.check.count({
      where: {
        monitor: { userId: user.id },
        checkedAt: { gte: since30d },
      },
    }),
    prisma.check.count({
      where: {
        monitor: { userId: user.id },
        checkedAt: { gte: since30d },
        status: "UP",
      },
    }),
  ]);

  const overallUptime =
    totalChecks30d > 0
      ? Number(((upChecks30d / totalChecks30d) * 100).toFixed(2))
      : 100;

  return NextResponse.json({
    user,
    summary: {
      totalMonitors,
      upMonitors,
      downMonitors,
      pausedMonitors,
      overallUptime,
      incidents24hCount: recentIncidents.length,
    },
    recentIncidents,
  });
}
