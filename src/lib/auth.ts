import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma, Plan, Role } from "./prisma";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  plan: Plan;
  planSiteLimit: number;
  emailVerified: boolean;
  impersonatedBy?: string;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 gün
  },
  pages: {
    signIn: "/login",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("E-posta ve şifre zorunludur.");
        }

        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          throw new Error("Geçersiz e-posta veya şifre.");
        }

        if (user.suspended) {
          throw new Error("Hesabınız yönetici tarafından askıya alınmıştır.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Geçersiz e-posta veya şifre.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          plan: user.plan as Plan,
          planSiteLimit: user.planSiteLimit,
          emailVerified: Boolean(user.emailVerified),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as SessionUser;
        token.id = u.id;
        token.role = u.role;
        token.plan = u.plan;
        token.planSiteLimit = u.planSiteLimit;
        token.emailVerified = u.emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        const u = session.user as unknown as SessionUser;
        u.id = String(token.id);
        u.role = (token.role as Role) || "USER";
        u.plan = (token.plan as Plan) || "FREE";
        u.planSiteLimit = Number(token.planSiteLimit ?? 5);
        u.emailVerified = Boolean(token.emailVerified);
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production-32chars",
};

/**
 * Mevcut oturumdaki kullanıcıyı döndürür.
 * Admin bir kullanıcının hesabına "impersonate" etmişse hedef kullanıcıyı döndürür.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const baseUser = session.user as unknown as SessionUser;
  if (!baseUser.id) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: baseUser.id },
  });
  if (!dbUser || dbUser.suspended) return null;

  // Admin Impersonation kontrolü
  if (dbUser.role === "ADMIN") {
    try {
      const cookieStore = cookies();
      const impersonateId = cookieStore.get("artakip_impersonate_uid")?.value;
      if (impersonateId && impersonateId !== dbUser.id) {
        const target = await prisma.user.findUnique({ where: { id: impersonateId } });
        if (target) {
          return {
            id: target.id,
            email: target.email,
            name: target.name,
            role: target.role as Role,
            plan: target.plan as Plan,
            planSiteLimit: target.planSiteLimit,
            emailVerified: Boolean(target.emailVerified),
            impersonatedBy: dbUser.email,
          };
        }
      }
    } catch {
      // Route handler dışındaki bağlamlarda cookie okunamazsa yoksay
    }
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as Role,
    plan: dbUser.plan as Plan,
    planSiteLimit: dbUser.planSiteLimit,
    emailVerified: Boolean(dbUser.emailVerified),
  };
}
