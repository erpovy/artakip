import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

  if (monitorId) {
    where.monitorId = monitorId;
  }

  if (from || to) {
    where.startedAt = {};
    if (from) where.startedAt.gte = new Date(from);
    if (to) where.startedAt.lte = new Date(to);
  }

  const incidents = await prisma.incident.findMany({
    where,
    include: {
      monitor: {
        select: { id: true, name: true, url: true },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  const enriched = incidents.map((inc) => {
    const endMs = inc.resolvedAt ? inc.resolvedAt.getTime() : Date.now();
    const durationMs = Math.max(0, endMs - inc.startedAt.getTime());
    return {
      ...inc,
      durationMs,
      ongoing: inc.resolvedAt === null,
    };
  });

  return NextResponse.json({ incidents: enriched });
}
