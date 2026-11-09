import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLANS } from "@/lib/plans";

const checkoutSchema = z.object({
  plan: z.enum(["FREE", "STARTER", "PRO", "AGENCY"]),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz plan seçimi." }, { status: 400 });
    }

    const targetPlan = parsed.data.plan;
    const planCfg = await prisma.planConfig.findUnique({ where: { plan: targetPlan } });
    const siteLimit = planCfg?.siteLimit ?? DEFAULT_PLANS[targetPlan].siteLimit;

    // Plan düşürme (downgrade) kontrolü: mevcut site sayısı yeni plan limitinden fazlaysa uyar
    const currentSiteCount = await prisma.monitor.count({ where: { userId: user.id } });
    if (currentSiteCount > siteLimit) {
      return NextResponse.json(
        {
          error: `Mevcut site sayınız (${currentSiteCount}), ${targetPlan} planının limitinden (${siteLimit}) fazla. Plan düşürmeden önce fazla siteleri silmelisiniz.`,
        },
        { status: 400 }
      );
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Gerçek Stripe anahtarı yapılandırılmışsa Stripe Checkout oturumu oluştur
    if (
      stripeSecret &&
      stripeSecret !== "sk_test_placeholder" &&
      targetPlan !== "FREE"
    ) {
      const stripe = new Stripe(stripeSecret);
      const priceId =
        planCfg?.stripePriceId ||
        process.env[`STRIPE_PRICE_${targetPlan}`] ||
        undefined;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: user.email,
        line_items: priceId
          ? [{ price: priceId, quantity: 1 }]
          : [
              {
                price_data: {
                  currency: "try",
                  unit_amount: (planCfg?.priceTry ?? DEFAULT_PLANS[targetPlan].priceTry) * 100,
                  recurring: { interval: "month" },
                  product_data: {
                    name: `Artakip ${DEFAULT_PLANS[targetPlan].name} Planı`,
                  },
                },
                quantity: 1,
              },
            ],
        metadata: {
          userId: user.id,
          plan: targetPlan,
          siteLimit: String(siteLimit),
        },
        success_url: `${appUrl}/dashboard/billing?status=success`,
        cancel_url: `${appUrl}/dashboard/billing?status=cancelled`,
      });

      return NextResponse.json({ checkoutUrl: session.url });
    }

    // Geliştirme / Sandbox modu veya FREE plana geçiş: doğrudan planı güncelle
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: targetPlan,
        planSiteLimit: siteLimit,
        subscriptionStatus: targetPlan === "FREE" ? "free" : "active",
      },
    });

    return NextResponse.json({
      message: `Planınız başarıyla ${DEFAULT_PLANS[targetPlan].name} (${siteLimit} site) olarak güncellendi.`,
      updatedPlan: targetPlan,
      siteLimit,
    });
  } catch (err) {
    console.error("Billing checkout error:", err);
    return NextResponse.json({ error: "Ödeme oturumu başlatılamadı." }, { status: 500 });
  }
}
