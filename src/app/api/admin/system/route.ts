import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, SessionUser } from "@/lib/auth";
import { prisma, Plan } from "@/lib/prisma";
import { getQueueHealth } from "@/lib/queue";
import { sendEmailWithRetry } from "@/lib/email";
import { DEFAULT_PLANS } from "@/lib/plans";

async function requireTrueAdmin(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as unknown as SessionUser;
  const dbUser = await prisma.user.findUnique({ where: { id: u.id } });
  if (!dbUser || dbUser.role !== "ADMIN") return null;
  return u;
}

export async function GET() {
  const admin = await requireTrueAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Yönetici yetkisi gereklidir." }, { status: 403 });
  }

  const [
    queueHealth,
    totalUsers,
    totalMonitors,
    downMonitors,
    sentEmailsCount,
    failedEmailsCount,
    recentErrors,
    planConfigs,
  ] = await Promise.all([
    getQueueHealth(),
    prisma.user.count(),
    prisma.monitor.count(),
    prisma.monitor.count({ where: { currentStatus: "DOWN", paused: false } }),
    prisma.notificationLog.count({ where: { success: true } }),
    prisma.notificationLog.count({ where: { success: false } }),
    prisma.check.findMany({
      where: { status: "DOWN", error: { not: null } },
      orderBy: { checkedAt: "desc" },
      take: 15,
      include: { monitor: { select: { name: true, url: true } } },
    }),
    prisma.planConfig.findMany({ orderBy: { siteLimit: "asc" } }),
  ]);

  const plans =
    planConfigs.length > 0
      ? planConfigs
      : Object.values(DEFAULT_PLANS).map((p) => ({
          plan: p.plan,
          name: p.name,
          siteLimit: p.siteLimit,
          minIntervalSeconds: p.minIntervalSeconds,
          retentionDays: p.retentionDays,
          priceTry: p.priceTry,
          stripePriceId: null,
        }));

  return NextResponse.json({
    queueHealth,
    stats: {
      totalUsers,
      totalMonitors,
      downMonitors,
      sentEmailsCount,
      failedEmailsCount,
    },
    recentErrors: recentErrors.map((e) => ({
      id: e.id.toString(),
      monitorName: e.monitor.name,
      url: e.monitor.url,
      checkedAt: e.checkedAt,
      httpCode: e.httpCode,
      error: e.error,
    })),
    plans,
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireTrueAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Yönetici yetkisi gereklidir." }, { status: 403 });
  }

  try {
    const body = await req.json();

    // 1. SMTP Test Maili Gönderme
    if (body.action === "smtp-test") {
      const toEmail = String(body.toEmail || admin.email).trim();
      const result = await sendEmailWithRetry({
        userId: admin.id,
        type: "SMTP_TEST",
        toEmail,
        template: {
          subject: "✅ Artakip SMTP Test E-postası",
          html: `<div style="font-family:sans-serif;padding:20px;"><h2>Artakip SMTP Testi Başarılı!</h2><p>Bu e-posta yönetici panelinden SMTP yapılandırmasını doğrulamak amacıyla gönderilmiştir.</p><p>Tarih: ${new Date().toLocaleString("tr-TR")}</p></div>`,
          text: "Artakip SMTP Testi Başarılı!",
        },
        maxRetries: 1,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: `SMTP gönderim hatası: ${result.error}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `Test e-postası ${toEmail} adresine başarıyla gönderildi.`,
      });
    }

    // 2. Plan Limitleri ve Fiyatlarını Düzenleme
    if (body.action === "update-plan") {
      const plan = body.plan as Plan;
      const siteLimit = Number(body.siteLimit);
      const minIntervalSeconds = Number(body.minIntervalSeconds);
      const retentionDays = Number(body.retentionDays);
      const priceTry = Number(body.priceTry);

      const updated = await prisma.planConfig.upsert({
        where: { plan },
        update: {
          siteLimit,
          minIntervalSeconds,
          retentionDays,
          priceTry,
        },
        create: {
          plan,
          name: DEFAULT_PLANS[plan]?.name || plan,
          siteLimit,
          minIntervalSeconds,
          retentionDays,
          priceTry,
        },
      });

      return NextResponse.json({
        plan: updated,
        message: `${plan} plan limitleri ve fiyatı güncellendi.`,
      });
    }

    return NextResponse.json({ error: "Bilinmeyen işlem." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "İşlem sırasında hata oluştu." }, { status: 500 });
  }
}
