import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  statusPageSlug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Durum sayfası kısa adı sadece küçük harf, rakam ve tire içerebilir.")
    .min(3)
    .max(50)
    .optional(),
  locale: z.enum(["tr", "en"]).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Yeni şifre en az 8 karakter olmalıdır.").optional(),
});

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      planSiteLimit: true,
      emailVerified: true,
      statusPageSlug: true,
      locale: true,
      createdAt: true,
      _count: { select: { monitors: true } },
    },
  });

  return NextResponse.json({ user, impersonatedBy: sessionUser.impersonatedBy });
}

export async function PATCH(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri." },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!dbUser) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.locale !== undefined) updateData.locale = parsed.data.locale;
    if (parsed.data.statusPageSlug !== undefined) {
      const existingSlug = await prisma.user.findUnique({
        where: { statusPageSlug: parsed.data.statusPageSlug },
      });
      if (existingSlug && existingSlug.id !== dbUser.id) {
        return NextResponse.json(
          { error: "Bu durum sayfası kısa adı başka bir kullanıcı tarafından kullanılıyor." },
          { status: 409 }
        );
      }
      updateData.statusPageSlug = parsed.data.statusPageSlug;
    }

    if (parsed.data.newPassword) {
      if (!parsed.data.currentPassword) {
        return NextResponse.json({ error: "Mevcut şifrenizi girmelisiniz." }, { status: 400 });
      }
      const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Mevcut şifreniz hatalı." }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: updateData,
    });

    return NextResponse.json({ message: "Hesap bilgileriniz güncellendi." });
  } catch {
    return NextResponse.json({ error: "Güncelleme başarısız oldu." }, { status: 500 });
  }
}

/**
 * KVKK / GDPR uyumlu hesap ve tüm ilişkili verileri (monitörler, kontroller, olaylar, ayarlar) silme.
 */
export async function DELETE() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    await prisma.notificationLog.deleteMany({ where: { userId: sessionUser.id } });
    await prisma.user.delete({ where: { id: sessionUser.id } });
    return NextResponse.json({
      message: "Hesabınız ve tüm izleme verileriniz kalıcı olarak silindi (KVKK/GDPR).",
    });
  } catch {
    return NextResponse.json({ error: "Hesap silinirken hata oluştu." }, { status: 500 });
  }
}
