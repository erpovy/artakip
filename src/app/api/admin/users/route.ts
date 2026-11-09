import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLANS } from "@/lib/plans";

async function requireTrueAdmin(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as unknown as SessionUser;
  const dbUser = await prisma.user.findUnique({ where: { id: u.id } });
  if (!dbUser || dbUser.role !== "ADMIN") return null;
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as "USER" | "ADMIN",
    plan: dbUser.plan as "FREE" | "STARTER" | "PRO" | "AGENCY",
    planSiteLimit: dbUser.planSiteLimit,
    emailVerified: Boolean(dbUser.emailVerified),
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireTrueAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Yönetici yetkisi gereklidir." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { name: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      planSiteLimit: true,
      suspended: true,
      emailVerified: true,
      createdAt: true,
      _count: {
        select: { monitors: true },
      },
    },
  });

  return NextResponse.json({ users });
}

const adminUpdateUserSchema = z.object({
  userId: z.string(),
  plan: z.enum(["FREE", "STARTER", "PRO", "AGENCY"]).optional(),
  planSiteLimit: z.number().int().min(1).max(10000).optional(),
  suspended: z.boolean().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const admin = await requireTrueAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Yönetici yetkisi gereklidir." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = adminUpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.plan) {
      updateData.plan = parsed.data.plan;
      updateData.planSiteLimit =
        parsed.data.planSiteLimit ?? DEFAULT_PLANS[parsed.data.plan].siteLimit;
    } else if (parsed.data.planSiteLimit !== undefined) {
      updateData.planSiteLimit = parsed.data.planSiteLimit;
    }

    if (parsed.data.suspended !== undefined) {
      updateData.suspended = parsed.data.suspended;
    }
    if (parsed.data.role !== undefined) {
      updateData.role = parsed.data.role;
    }

    const updated = await prisma.user.update({
      where: { id: parsed.data.userId },
      data: updateData,
    });

    return NextResponse.json({
      user: updated,
      message: "Kullanıcı bilgileri güncellendi.",
    });
  } catch {
    return NextResponse.json({ error: "Kullanıcı güncellenemedi." }, { status: 500 });
  }
}

/**
 * Admin Impersonate (Kullanıcı adına giriş yapma / çıkma)
 */
export async function POST(req: NextRequest) {
  const admin = await requireTrueAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Yönetici yetkisi gereklidir." }, { status: 403 });
  }

  const body = await req.json();
  const targetUserId = body.userId ? String(body.userId) : null;

  const res = NextResponse.json({
    message: targetUserId
      ? "Kullanıcı görünümüne geçildi."
      : "Yönetici oturumuna geri dönüldü.",
  });

  if (targetUserId) {
    res.cookies.set("artakip_impersonate_uid", targetUserId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 3600,
    });
  } else {
    res.cookies.delete("artakip_impersonate_uid");
  }

  return res;
}
