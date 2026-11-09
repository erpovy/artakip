import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma, Status } from "@/lib/prisma";
import { validateSafeUrl } from "@/lib/ssrf";
import { checkPlanSiteLimit, validateIntervalForPlan } from "@/lib/plans";
import {
  scheduleMonitorRepeatableJob,
  enqueueImmediateMonitorCheck,
} from "@/lib/queue";
import { executeMonitorCheck } from "@/worker/index";

export const dynamic = "force-dynamic";

const createMonitorSchema = z.object({
  name: z.string().min(1, "Site adı zorunludur.").max(120),
  url: z.string().url("Geçerli bir URL giriniz."),
  type: z.enum(["HTTP", "KEYWORD"]).default("HTTP"),
  keyword: z.string().max(200).optional().nullable(),
  intervalSeconds: z.number().int().min(30).max(86400).default(300),
  timeoutSeconds: z.number().int().min(2).max(60).default(15),
  expectedStatus: z.string().default("200-399"),
  followRedirects: z.boolean().default(true),
  checkSsl: z.boolean().default(true),
  wpCheckPath: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(40)).max(15).default([]),
});

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const statusParam = searchParams.get("status")?.toUpperCase();
  const tag = searchParams.get("tag")?.trim() || "";
  const sort = searchParams.get("sort") || "createdAt_desc";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || 25)));

  const where: Prisma.MonitorWhereInput = {
    userId: user.id,
  };

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { url: { contains: q } },
    ];
  }

  if (statusParam === "UP" || statusParam === "DOWN" || statusParam === "UNKNOWN") {
    where.currentStatus = statusParam as Status;
  }

  if (tag) {
    where.tags = { contains: tag };
  }

  let orderBy: Prisma.MonitorOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "name_asc") orderBy = { name: "asc" };
  else if (sort === "status") orderBy = { currentStatus: "asc" };
  else if (sort === "lastChecked") orderBy = { lastCheckedAt: "desc" };

  const since30d = new Date(Date.now() - 30 * 86_400_000);
  const forceCheck = searchParams.get("check") === "1";

  // Henüz hiç kontrol edilmemiş (UNKNOWN) veya süresi gelmiş siteleri anında kontrol et
  const pendingMonitors = await prisma.monitor.findMany({
    where: {
      userId: user.id,
      paused: false,
      ...(forceCheck ? {} : { currentStatus: "UNKNOWN" }),
    },
    select: { id: true },
    take: 20,
  });

  if (pendingMonitors.length > 0) {
    await Promise.allSettled(
      pendingMonitors.map((pm) => executeMonitorCheck(pm.id))
    );
  }

  const [total, monitors] = await Promise.all([
    prisma.monitor.count({ where }),
    prisma.monitor.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        checks: {
          orderBy: { checkedAt: "desc" },
          take: 1,
          select: { responseMs: true, httpCode: true, checkedAt: true },
        },
      },
    }),
  ]);

  // 30 günlük uptime yüzdesi ve son yanıt süresi hesaplaması
  const monitorIds = monitors.map((m) => m.id);
  const checkStats =
    monitorIds.length > 0
      ? await prisma.check.groupBy({
          by: ["monitorId", "status"],
          where: {
            monitorId: { in: monitorIds },
            checkedAt: { gte: since30d },
          },
          _count: { _all: true },
        })
      : [];

  const statsMap = new Map<string, { up: number; total: number }>();
  for (const row of checkStats) {
    const entry = statsMap.get(row.monitorId) || { up: 0, total: 0 };
    entry.total += row._count._all;
    if (row.status === "UP") entry.up += row._count._all;
    statsMap.set(row.monitorId, entry);
  }

  const items = monitors.map((m) => {
    const st = statsMap.get(m.id);
    const uptime30d =
      st && st.total > 0 ? Number(((st.up / st.total) * 100).toFixed(2)) : 100;
    const latestCheck = m.checks[0] || null;
    return {
      ...m,
      tags: m.tags ? m.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      lastResponseMs: latestCheck?.responseMs ?? null,
      lastHttpCode: latestCheck?.httpCode ?? null,
      uptime30d,
      checks: undefined,
    };
  });

  return NextResponse.json({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createMonitorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri." },
        { status: 400 }
      );
    }

    // 1. Sunucu taraflı zorunlu plan site limiti denetimi
    const currentCount = await prisma.monitor.count({ where: { userId: user.id } });
    const limitCheck = checkPlanSiteLimit(currentCount, user.planSiteLimit, 1);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 403 });
    }

    // 2. Plan bazlı minimum kontrol aralığı denetimi
    const planCfg = await prisma.planConfig.findUnique({ where: { plan: user.plan } });
    const intervalValidation = validateIntervalForPlan(
      user.plan,
      parsed.data.intervalSeconds,
      planCfg?.minIntervalSeconds
    );
    if (!intervalValidation.valid) {
      return NextResponse.json({ error: intervalValidation.reason }, { status: 400 });
    }

    // 3. SSRF Koruması (URL + DNS sonrası özel IP kontrolü)
    const ssrf = await validateSafeUrl(parsed.data.url);
    if (!ssrf.valid) {
      return NextResponse.json({ error: ssrf.reason }, { status: 400 });
    }

    if (parsed.data.type === "KEYWORD" && (!parsed.data.keyword || !parsed.data.keyword.trim())) {
      return NextResponse.json(
        { error: "KEYWORD tipinde aranacak metin (anahtar kelime) zorunludur." },
        { status: 400 }
      );
    }

    const monitor = await prisma.monitor.create({
      data: {
        userId: user.id,
        name: parsed.data.name.trim(),
        url: ssrf.normalizedUrl!,
        type: parsed.data.type,
        keyword: parsed.data.type === "KEYWORD" ? parsed.data.keyword?.trim() : null,
        intervalSeconds: parsed.data.intervalSeconds,
        timeoutSeconds: parsed.data.timeoutSeconds,
        expectedStatus: parsed.data.expectedStatus.trim(),
        followRedirects: parsed.data.followRedirects,
        checkSsl: parsed.data.checkSsl,
        wpCheckPath: parsed.data.wpCheckPath || null,
        tags: parsed.data.tags.map((t) => t.trim()).filter(Boolean).join(","),
      },
    });

    await scheduleMonitorRepeatableJob(monitor.id, monitor.intervalSeconds);
    await enqueueImmediateMonitorCheck(monitor.id, 0);
    await executeMonitorCheck(monitor.id).catch(() => null);

    const updatedMonitor = await prisma.monitor.findUnique({
      where: { id: monitor.id },
    });

    return NextResponse.json({ monitor: updatedMonitor || monitor }, { status: 201 });
  } catch (err) {
    console.error("Create monitor error:", err);
    return NextResponse.json({ error: "Monitör eklenirken hata oluştu." }, { status: 500 });
  }
}
