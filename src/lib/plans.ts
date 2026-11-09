import { Plan } from "@prisma/client";

export interface PlanDefinition {
  plan: Plan;
  name: string;
  siteLimit: number;
  minIntervalSeconds: number;
  retentionDays: number;
  priceTry: number;
  features: string[];
}

export const DEFAULT_PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    plan: "FREE",
    name: "Ücretsiz",
    siteLimit: 5,
    minIntervalSeconds: 600, // 10 dk
    retentionDays: 7,
    priceTry: 0,
    features: [
      "5 siteye kadar izleme",
      "10 dakika kontrol aralığı",
      "7 günlük kontrol geçmişi",
      "E-posta bildirimleri",
      "Temel SSL kontrolü",
    ],
  },
  STARTER: {
    plan: "STARTER",
    name: "Starter",
    siteLimit: 50,
    minIntervalSeconds: 300, // 5 dk
    retentionDays: 30,
    priceTry: 199,
    features: [
      "50 siteye kadar izleme",
      "5 dakika kontrol aralığı",
      "30 günlük kontrol geçmişi",
      "HTML & Keyword kontrolü",
      "CSV toplu içe/dışa aktarma",
    ],
  },
  PRO: {
    plan: "PRO",
    name: "Pro",
    siteLimit: 300,
    minIntervalSeconds: 60, // 1 dk
    retentionDays: 90,
    priceTry: 499,
    features: [
      "300 siteye kadar izleme (WordPress ajans dostu)",
      "1 dakika kontrol aralığı",
      "90 günlük kontrol geçmişi",
      "Alarm fırtınası koruması & Sessiz saatler",
      "Çoklu bildirim e-postası & Webhook",
    ],
  },
  AGENCY: {
    plan: "AGENCY",
    name: "Agency",
    siteLimit: 1000,
    minIntervalSeconds: 60, // 1 dk
    retentionDays: 180,
    priceTry: 1299,
    features: [
      "1000 siteye kadar izleme",
      "1 dakika kontrol aralığı",
      "180 günlük kontrol geçmişi",
      "Özel herkese açık durum sayfası (/status/slug)",
      "Öncelikli kuyruk & Slack/Telegram entegrasyonu",
    ],
  },
};

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  remainingSlots: number;
  maxLimit: number;
}

/**
 * Kullanıcının mevcut site sayısına ve plan limitine göre yeni site ekleyip ekleyemeyeceğini denetler.
 */
export function checkPlanSiteLimit(
  currentMonitorCount: number,
  userPlanSiteLimit: number,
  requestedToAdd = 1
): LimitCheckResult {
  const remainingSlots = Math.max(0, userPlanSiteLimit - currentMonitorCount);
  if (requestedToAdd <= 0) {
    return {
      allowed: false,
      reason: "Eklenecek site sayısı en az 1 olmalıdır.",
      remainingSlots,
      maxLimit: userPlanSiteLimit,
    };
  }
  if (currentMonitorCount + requestedToAdd > userPlanSiteLimit) {
    return {
      allowed: false,
      reason: `Plan limitiniz (${userPlanSiteLimit} site) aşıldı. Mevcut: ${currentMonitorCount}, Eklenmek istenen: ${requestedToAdd}, Kalan hak: ${remainingSlots}. Lütfen planınızı yükseltin.`,
      remainingSlots,
      maxLimit: userPlanSiteLimit,
    };
  }
  return {
    allowed: true,
    remainingSlots: remainingSlots - requestedToAdd,
    maxLimit: userPlanSiteLimit,
  };
}

/**
 * Seçilen kontrol aralığının kullanıcının planına uygun olup olmadığını denetler.
 */
export function validateIntervalForPlan(
  plan: Plan,
  intervalSeconds: number,
  customMinInterval?: number
): { valid: boolean; reason?: string; minAllowed: number } {
  const planDef = DEFAULT_PLANS[plan] ?? DEFAULT_PLANS.FREE;
  const minAllowed = customMinInterval ?? planDef.minIntervalSeconds;
  if (intervalSeconds < minAllowed) {
    return {
      valid: false,
      minAllowed,
      reason: `${planDef.name} planında minimum kontrol aralığı ${minAllowed / 60} dakikadır (${minAllowed} sn).`,
    };
  }
  return { valid: true, minAllowed };
}
