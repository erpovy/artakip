import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildAccountEmailTemplate, sendEmailWithRetry } from "@/lib/email";

const forgotSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz."),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = checkRateLimit(`forgot:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderildi. Lütfen 1 dakika bekleyin." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçerli bir e-posta giriniz." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    let devToken: string | undefined;
    if (user) {
      const resetToken = crypto.randomBytes(24).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
      const tpl = buildAccountEmailTemplate("RESET", {
        name: user.name,
        actionUrl: resetUrl,
      });

      await sendEmailWithRetry({
        userId: user.id,
        type: "RESET",
        toEmail: user.email,
        template: tpl,
      });

      if (process.env.NODE_ENV !== "production") {
        devToken = resetToken;
      }
    }

    return NextResponse.json({
      message:
        "Eğer bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderilmiştir.",
      resetTokenPreview: devToken,
    });
  } catch {
    return NextResponse.json({ error: "İstek işlenirken hata oluştu." }, { status: 500 });
  }
}
