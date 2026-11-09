import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAccountEmailTemplate, sendEmailWithRetry } from "@/lib/email";

const addContactSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz."),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = addContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçerli bir e-posta giriniz." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existingCount = await prisma.alertContact.count({
      where: { userId: user.id },
    });
    if (existingCount >= 10) {
      return NextResponse.json(
        { error: "En fazla 10 ek bildirim e-postası ekleyebilirsiniz." },
        { status: 400 }
      );
    }

    const verifyToken = crypto.randomBytes(20).toString("hex");
    const contact = await prisma.alertContact.create({
      data: {
        userId: user.id,
        email,
        verified: true,
        verifyToken,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}`;
    const tpl = buildAccountEmailTemplate("VERIFY_CONTACT", {
      actionUrl: verifyUrl,
    });

    await sendEmailWithRetry({
      userId: user.id,
      type: "VERIFY_CONTACT",
      toEmail: email,
      template: tpl,
    });

    return NextResponse.json(
      {
        contact,
        message: "Bildirim e-postası eklendi. Doğrulama bağlantısı gönderildi.",
        verifyTokenPreview:
          process.env.NODE_ENV !== "production" ? verifyToken : undefined,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "E-posta eklenemedi." }, { status: 500 });
  }
}
