import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildAccountEmailTemplate, sendEmailWithRetry } from "@/lib/email";

const registerSchema = z.object({
  name: z.string().min(2, "Ad en az 2 karakter olmalıdır.").max(80),
  email: z.string().email("Geçerli bir e-posta adresi giriniz."),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalıdır.")
    .max(128, "Şifre çok uzun."),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = checkRateLimit(`register:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla kayıt denemesi. Lütfen biraz bekleyin." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Bu e-posta adresiyle zaten bir hesap mevcut." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const verificationToken = crypto.randomBytes(24).toString("hex");
    const slugBase = parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const statusPageSlug = `${slugBase || "durum"}-${crypto.randomBytes(3).toString("hex")}`;

    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name.trim(),
        passwordHash,
        verificationToken,
        plan: "FREE",
        planSiteLimit: 5,
        statusPageSlug,
        settings: {
          create: {
            notifyOnDown: true,
            notifyOnUp: true,
            notifyOnSslExpiry: true,
            sslExpiryDaysBefore: 14,
            failuresBeforeDown: 2,
            timezone: "Europe/Istanbul",
          },
        },
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;

    const tpl = buildAccountEmailTemplate("VERIFY", {
      name: user.name,
      actionUrl: verifyUrl,
    });
    await sendEmailWithRetry({
      userId: user.id,
      type: "VERIFY",
      toEmail: user.email,
      template: tpl,
    });

    return NextResponse.json(
      {
        message:
          "Kayıt başarılı! Lütfen e-posta adresinize gönderilen doğrulama bağlantısına tıklayın.",
        verificationTokenPreview:
          process.env.NODE_ENV !== "production" ? verificationToken : undefined,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Sunucu hatası oluştu." }, { status: 500 });
  }
}
