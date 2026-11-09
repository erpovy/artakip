import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLANS } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const rawBody = await req.text();

    if (
      stripeSecret &&
      stripeSecret !== "sk_test_placeholder" &&
      webhookSecret &&
      webhookSecret !== "whsec_placeholder"
    ) {
      const stripe = new Stripe(stripeSecret);
      const sig = req.headers.get("stripe-signature") || "";
      const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = (session.metadata?.plan as Plan) || "STARTER";
        const siteLimit = Number(
          session.metadata?.siteLimit || DEFAULT_PLANS[plan].siteLimit
        );

        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan,
              planSiteLimit: siteLimit,
              stripeCustomerId: String(session.customer || ""),
              stripeSubscriptionId: String(session.subscription || ""),
              subscriptionStatus: "active",
            },
          });
        }
      } else if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            plan: "FREE",
            planSiteLimit: DEFAULT_PLANS.FREE.siteLimit,
            subscriptionStatus: "canceled",
          },
        });
      }

      return NextResponse.json({ received: true });
    }

    // Test/Simülasyon Webhook desteği
    const payload = JSON.parse(rawBody);
    if (payload.userId && payload.plan) {
      const plan = payload.plan as Plan;
      await prisma.user.update({
        where: { id: payload.userId },
        data: {
          plan,
          planSiteLimit: DEFAULT_PLANS[plan]?.siteLimit ?? 5,
          subscriptionStatus: "active",
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook doğrulama hatası." }, { status: 400 });
  }
}
