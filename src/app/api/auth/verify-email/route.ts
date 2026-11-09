import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildAccountEmailTemplate, sendEmailWithRetry } from "@/lib/email";

const verifySchema = z.object({
  token: z.string().min(10, "Geçersiz doğrulama anahtarı."),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz doğrulama kodu." }, { status: 400 });
    }

    // 1. Kullanıcı e-posta doğrulaması
    const user = await prisma.user.findUnique({
      where: { verificationToken: parsed.data.token },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          verificationToken: null,
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const welcomeTpl = buildAccountEmailTemplate("WELCOME", {
        name: user.name,
        actionUrl: `${appUrl}/dashboard`,
      });
      await sendEmailWithRetry({
        userId: user.id,
        type: "WELCOME",
        toEmail: user.email,
        template: welcomeTpl,
      });

      return NextResponse.json({
        message: "E-posta adresiniz başarıyla doğrulandı. Giriş yapabilirsiniz.",
      });
    }

    // 2. Ek bildirim e-postası (AlertContact) doğrulaması
    const contact = await prisma.alertContact.findUnique({
      where: { verifyToken: parsed.data.token },
    });

    if (contact) {
      await prisma.alertContact.update({
        where: { id: contact.id },
        data: {
          verified: true,
          verifyToken: null,
        },
      });
      return NextResponse.json({
        message: "Ek bildirim e-posta adresi başarıyla doğrulandı.",
      });
    }

    return NextResponse.json(
      { error: "Doğrulama bağlantısı geçersiz veya daha önce kullanılmış." },
      { status: 400 }
    );
  } catch {
    return NextResponse.json({ error: "Doğrulama sırasında hata oluştu." }, { status: 500 });
  }
}
