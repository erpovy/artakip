import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateSafeUrl } from "@/lib/ssrf";
import { validateIntervalForPlan } from "@/lib/plans";
import {
  scheduleMonitorRepeatableJob,
  removeMonitorRepeatableJob,
} from "@/lib/queue";

const updateMonitorSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  url: z.string().url().optional(),
  type: z.enum(["HTTP", "KEYWORD"]).optional(),
  keyword: z.string().max(200).nullable().optional(),
  intervalSeconds: z.number().int().min(30).max(86400).optional(),
  timeoutSeconds: z.number().int().min(2).max(60).optional(),
  expectedStatus: z.string().optional(),
  followRedirects: z.boolean().optional(),
  paused: z.boolean().optional(),
  checkSsl: z.boolean().optional(),
  wpCheckPath: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(40)).max(15).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      incidents: {
        orderBy: { startedAt: "desc" },
        take: 30,
      },
      checks: {
        orderBy: { checkedAt: "desc" },
        take: 50,
      },
    },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Site bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  }

  const serializedChecks = monitor.checks.map((c) => ({
    ...c,
    id: c.id.toString(),
  }));

  return NextResponse.json({
    monitor: {
      ...monitor,
      checks: serializedChecks,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const existing = await prisma.monitor.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Site bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateMonitorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri." },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = { ...parsed.data };

    if (parsed.data.url) {
      const ssrf = await validateSafeUrl(parsed.data.url);
      if (!ssrf.valid) {
        return NextResponse.json({ error: ssrf.reason }, { status: 400 });
      }
      data.url = ssrf.normalizedUrl;
    }

    if (parsed.data.intervalSeconds !== undefined) {
      const planCfg = await prisma.planConfig.findUnique({ where: { plan: user.plan } });
      const ivCheck = validateIntervalForPlan(
        user.plan,
        parsed.data.intervalSeconds,
        planCfg?.minIntervalSeconds
      );
      if (!ivCheck.valid) {
        return NextResponse.json({ error: ivCheck.reason }, { status: 400 });
      }
    }

    const updated = await prisma.monitor.update({
      where: { id: existing.id },
      data,
    });

    if (updated.paused) {
      await removeMonitorRepeatableJob(updated.id);
    } else {
      await scheduleMonitorRepeatableJob(updated.id, updated.intervalSeconds);
    }

    return NextResponse.json({ monitor: updated });
  } catch {
    return NextResponse.json({ error: "Güncelleme hatası." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const existing = await prisma.monitor.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Site bulunamadı veya erişim yetkiniz yok." }, { status: 404 });
  }

  await removeMonitorRepeatableJob(existing.id);
  await prisma.monitor.delete({ where: { id: existing.id } });

  return NextResponse.json({ message: "Site silindi." });
}
