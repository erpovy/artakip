import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDownEmailTemplate, sendEmailWithRetry } from "@/lib/email";

const notificationSettingsSchema = z.object({
  notifyOnDown: z.boolean(),
  notifyOnUp: z.boolean(),
  notifyOnSslExpiry: z.boolean(),
  sslExpiryDaysBefore: z.number().int().min(1).max(90),
  failuresBeforeDown: z.number().int().min(1).max(10),
  digestDaily: z.boolean(),
  digestWeekly: z.boolean(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
  timezone: z.string().min(2).max(60),
  webhookUrl: z.string().url().nullable().optional().or(z.literal("")),
  slackWebhookUrl: z.string().url().nullable().optional().or(z.literal("")),
  telegramChatId: z.string().max(60).nullable().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  let settings = await prisma.notificationSettings.findUnique({
    where: { userId: user.id },
  });

  if (!settings) {
    settings = await prisma.notificationSettings.create({
      data: { userId: user.id },
    });
  }

  const contacts = await prisma.alertContact.findMany({
    where: { userId: user.id },
    orderBy: { email: "asc" },
  });

  const recentLogs = await prisma.notificationLog.findMany({
    where: { userId: user.id },
    orderBy: { sentAt: "desc" },
    take: 25,
  });

  return NextResponse.json({
    settings,
    contacts,
    recentLogs,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = notificationSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz ayar verisi." },
        { status: 400 }
      );
    }

    const clean = {
      ...parsed.data,
      quietHoursStart: parsed.data.quietHoursStart || null,
      quietHoursEnd: parsed.data.quietHoursEnd || null,
      webhookUrl: parsed.data.webhookUrl || null,
      slackWebhookUrl: parsed.data.slackWebhookUrl || null,
      telegramChatId: parsed.data.telegramChatId || null,
    };

    const settings = await prisma.notificationSettings.upsert({
      where: { userId: user.id },
      update: clean,
      create: {
        userId: user.id,
        ...clean,
      },
    });

    return NextResponse.json({
      settings,
      message: "Bildirim ayarlarınız kaydedildi. Bir sonraki kontrolde geçerli olacaktır.",
    });
  } catch {
    return NextResponse.json({ error: "Ayarlar güncellenemedi." }, { status: 500 });
  }
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const contacts = await prisma.alertContact.findMany({
    where: { userId: user.id },
  });

  const recipients = Array.from(
    new Set([user.email, ...contacts.map((c) => c.email)])
  );

  const tpl = buildDownEmailTemplate({
    monitorId: "test",
    monitorName: "Test Web Sitesi (Deneme)",
    url: "https://artakip.artovy.com",
    startedAt: new Date(),
    reason: "Bu bir test bildirim e-postasıdır.",
    timezone: "Europe/Istanbul",
  });

  const results: Array<{ email: string; success: boolean; error?: string }> = [];
  for (const toEmail of recipients) {
    const res = await sendEmailWithRetry({
      userId: user.id,
      type: "TEST",
      toEmail,
      template: tpl,
      maxRetries: 1,
    });
    results.push({ email: toEmail, ...res });
  }

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0 && failed.length === results.length) {
    return NextResponse.json(
      {
        error: `Test e-postası gönderilemedi: ${failed[0].error || "Bilinmeyen hata"}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: `Test e-postası başarıyla gönderildi (${recipients.join(", ")}).`,
    results,
  });
}
