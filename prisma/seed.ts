import { PrismaClient, Plan, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@artakip.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Varsayılan plan yapılandırmaları
  const defaultPlans = [
    {
      plan: Plan.FREE,
      name: "Ücretsiz",
      siteLimit: 5,
      minIntervalSeconds: 600,
      retentionDays: 7,
      priceTry: 0,
    },
    {
      plan: Plan.STARTER,
      name: "Starter",
      siteLimit: 50,
      minIntervalSeconds: 300,
      retentionDays: 30,
      priceTry: 199,
    },
    {
      plan: Plan.PRO,
      name: "Pro",
      siteLimit: 300,
      minIntervalSeconds: 60,
      retentionDays: 90,
      priceTry: 499,
    },
    {
      plan: Plan.AGENCY,
      name: "Agency",
      siteLimit: 1000,
      minIntervalSeconds: 60,
      retentionDays: 180,
      priceTry: 1299,
    },
  ];

  for (const planCfg of defaultPlans) {
    await prisma.planConfig.upsert({
      where: { plan: planCfg.plan },
      update: planCfg,
      create: planCfg,
    });
  }

  // Admin kullanıcı oluştur / güncelle
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: Role.ADMIN,
      plan: Plan.AGENCY,
      planSiteLimit: 1000,
      emailVerified: new Date(),
    },
    create: {
      email: adminEmail,
      name: "Sistem Yöneticisi",
      passwordHash,
      role: Role.ADMIN,
      plan: Plan.AGENCY,
      planSiteLimit: 1000,
      emailVerified: new Date(),
      statusPageSlug: "sistem",
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

  console.log(`Seed tamamlandı. Admin kullanıcı: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error("Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
