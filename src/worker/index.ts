import { Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import {
  performHttpProbe,
  evaluateMonitorStateTransition,
  checkSslCertificateExpiry,
} from "../lib/monitor-engine";
import {
  evaluateNotificationPolicy,
  shouldBatchAsAlarmStorm,
  buildDownEmailTemplate,
  buildUpEmailTemplate,
  buildSslExpiryEmailTemplate,
  buildAlarmStormEmailTemplate,
  buildDigestEmailTemplate,
  sendEmailWithRetry,
  dispatchExternalWebhooks,
} from "../lib/email";
import {
  MONITOR_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  WORKER_HEARTBEAT_KEY,
  EmailJobPayload,
  getRedisConnection,
  enqueueEmailNotification,
  enqueueImmediateMonitorCheck,
  scheduleMonitorRepeatableJob,
} from "../lib/queue";
import { DEFAULT_PLANS } from "../lib/plans";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 20);

// Alarm fırtınası tespiti için kullanıcı bazlı son 60 saniyedeki kapanmaları tutan pencere
const recentDownEventsByUser = new Map<
  string,
  Array<{ monitorId: string; name: string; url: string; reason: string; time: number }>
>();

// Sessiz saatlerde (Quiet Hours) biriktirilen bildirimler
const quietHoursBufferByUser = new Map<
  string,
  Array<{ monitorId: string; name: string; url: string; eventType: "DOWN" | "UP"; reason: string; time: Date }>
>();

/**
 * Tek bir monitörü kontrol eder, Check kaydı yazar, durum geçişini değerlendirir,
 * Incident açar/kapatır ve bildirimleri kuyruğa atar.
 */
export async function executeMonitorCheck(monitorId: string): Promise<void> {
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    include: {
      user: {
        include: {
          settings: true,
          contacts: true,
        },
      },
    },
  });

  if (!monitor || monitor.paused || monitor.user.suspended) {
    return;
  }

  const probe = await performHttpProbe({
    url: monitor.url,
    wpCheckPath: monitor.wpCheckPath,
    type: monitor.type as "HTTP" | "KEYWORD",
    keyword: monitor.keyword,
    timeoutSeconds: monitor.timeoutSeconds,
    expectedStatus: monitor.expectedStatus,
    followRedirects: monitor.followRedirects,
  });

  const now = new Date();
  const settings = monitor.user.settings;
  const failuresBeforeDown = settings?.failuresBeforeDown ?? 2;

  // 1. Durum geçişini hesapla ve Monitor tablosunu hemen güncelle
  const transition = evaluateMonitorStateTransition({
    previousStatus: monitor.currentStatus as "UP" | "DOWN" | "UNKNOWN",
    previousConsecutiveFails: monitor.consecutiveFails,
    previousLastStatusChangeAt: monitor.lastStatusChangeAt,
    probeSuccess: probe.isUp,
    probeError: probe.error,
    failuresBeforeDown,
    now,
  });

  await prisma.monitor.update({
    where: { id: monitor.id },
    data: {
      currentStatus: transition.nextStatus,
      consecutiveFails: transition.nextConsecutiveFails,
      lastCheckedAt: now,
      lastStatusChangeAt: transition.nextLastStatusChangeAt,
    },
  });

  // 2. Check kaydını yaz
  await prisma.check
    .create({
      data: {
        monitorId: monitor.id,
        checkedAt: now,
        status: probe.isUp ? "UP" : "DOWN",
        httpCode: probe.httpCode,
        responseMs: probe.responseMs,
        error: probe.error,
      },
    })
    .catch((err) => console.error("[Check Create Warning]", err));

  // 3. İlk hatada hemen 1 sn sonra doğrulama (retry) kontrolünü yap
  if (transition.shouldRetryImmediately) {
    await new Promise((r) => setTimeout(r, 1000));
    await executeMonitorCheck(monitor.id).catch(() => null);
    return;
  }

  const recipients = Array.from(
    new Set([
      monitor.user.email,
      ...monitor.user.contacts.map((c) => c.email),
    ])
  );
  const tz = settings?.timezone || "Europe/Istanbul";
  const effectiveEmailVerified = monitor.user.emailVerified ?? new Date();

  // Eğer site zaten DOWN durumundaysa fakat bu kesinti için henüz başarılı bir DOWN e-postası gönderilmemişse tetikle
  let shouldForceDownAlert = false;
  if (transition.nextStatus === "DOWN" && !transition.openIncident) {
    const sinceTime =
      transition.nextLastStatusChangeAt ||
      new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingDownMail = await prisma.notificationLog.findFirst({
      where: {
        monitorId: monitor.id,
        type: "DOWN",
        success: true,
        sentAt: { gte: sinceTime },
      },
    });
    if (!existingDownMail) {
      shouldForceDownAlert = true;
    }
  }

  // 4. UP -> DOWN geçişi (veya henüz maili gitmemiş aktif DOWN durumu): Incident oluştur ve bildirim tetikle
  if ((transition.openIncident && transition.triggerEmail === "DOWN") || shouldForceDownAlert) {
    const reason = probe.error || "Site yanıt vermiyor";
    const existingOpenIncident = await prisma.incident.findFirst({
      where: { monitorId: monitor.id, resolvedAt: null },
    });
    if (!existingOpenIncident) {
      await prisma.incident
        .create({
          data: {
            monitorId: monitor.id,
            startedAt: transition.incidentStartedAt || now,
            reason,
          },
        })
        .catch((err) => console.error("[Incident Create Warning]", err));
    }

    const policy = evaluateNotificationPolicy({
      eventType: "DOWN",
      userEmailVerified: effectiveEmailVerified,
      notifyOnDown: settings?.notifyOnDown ?? true,
      notifyOnUp: settings?.notifyOnUp ?? true,
      notifyOnSslExpiry: settings?.notifyOnSslExpiry ?? true,
      quietHoursStart: settings?.quietHoursStart,
      quietHoursEnd: settings?.quietHoursEnd,
      timezone: tz,
      now,
    });

    if (policy.deferForQuietHours) {
      const list = quietHoursBufferByUser.get(monitor.userId) || [];
      list.push({
        monitorId: monitor.id,
        name: monitor.name,
        url: monitor.url,
        eventType: "DOWN",
        reason,
        time: now,
      });
      quietHoursBufferByUser.set(monitor.userId, list);
    } else if (policy.shouldSendNow) {
      // Alarm fırtınası kontrolü (son 60 sn içinde 20+ site kapandı mı?)
      const windowEvents = (recentDownEventsByUser.get(monitor.userId) || []).filter(
        (e) => Date.now() - e.time < 60_000
      );
      windowEvents.push({
        monitorId: monitor.id,
        name: monitor.name,
        url: monitor.url,
        reason,
        time: Date.now(),
      });
      recentDownEventsByUser.set(monitor.userId, windowEvents);

      if (shouldBatchAsAlarmStorm(windowEvents.length)) {
        // Tam 20. sitede toplu tek mail gönder
        if (windowEvents.length === 20) {
          const stormTpl = buildAlarmStormEmailTemplate({
            downMonitors: windowEvents,
            occurredAt: now,
            timezone: tz,
          });
          for (const email of recipients) {
            await enqueueEmailNotification({
              userId: monitor.userId,
              monitorId: monitor.id,
              type: "DOWN",
              toEmail: email,
              template: stormTpl,
            }).catch(() => null);
          }
        }
      } else {
        const downTpl = buildDownEmailTemplate({
          monitorId: monitor.id,
          monitorName: monitor.name,
          url: monitor.url,
          startedAt: now,
          reason,
          timezone: tz,
        });
        for (const email of recipients) {
          await enqueueEmailNotification({
            userId: monitor.userId,
            monitorId: monitor.id,
            type: "DOWN",
            toEmail: email,
            template: downTpl,
          }).catch(() => null);
        }
      }
    }

    void dispatchExternalWebhooks({
      webhookUrl: settings?.webhookUrl,
      slackWebhookUrl: settings?.slackWebhookUrl,
      telegramChatId: settings?.telegramChatId,
      text: `🔴 [KAPANDI] ${monitor.name} (${monitor.url}) - Neden: ${reason}`,
      payload: {
        event: "monitor.down",
        monitorId: monitor.id,
        name: monitor.name,
        url: monitor.url,
        reason,
        timestamp: now.toISOString(),
      },
    }).catch(() => null);
  }

  // 5. DOWN -> UP geçişi: Açık Incident'ı kapat ve kesinti süresiyle UP maili gönder
  if (transition.resolveIncident && transition.triggerEmail === "UP") {
    const openIncident = await prisma.incident.findFirst({
      where: { monitorId: monitor.id, resolvedAt: null },
      orderBy: { startedAt: "desc" },
    });

    let durationMs = 0;
    if (openIncident) {
      durationMs = Math.max(1000, now.getTime() - openIncident.startedAt.getTime());
      await prisma.incident.update({
        where: { id: openIncident.id },
        data: { resolvedAt: now },
      });
    }

    const policy = evaluateNotificationPolicy({
      eventType: "UP",
      userEmailVerified: effectiveEmailVerified,
      notifyOnDown: settings?.notifyOnDown ?? true,
      notifyOnUp: settings?.notifyOnUp ?? true,
      notifyOnSslExpiry: settings?.notifyOnSslExpiry ?? true,
      quietHoursStart: settings?.quietHoursStart,
      quietHoursEnd: settings?.quietHoursEnd,
      timezone: tz,
      now,
    });

    if (policy.shouldSendNow) {
      const upTpl = buildUpEmailTemplate({
        monitorId: monitor.id,
        monitorName: monitor.name,
        url: monitor.url,
        resolvedAt: now,
        durationMs,
        timezone: tz,
      });

      for (const email of recipients) {
        await enqueueEmailNotification({
          userId: monitor.userId,
          monitorId: monitor.id,
          type: "UP",
          toEmail: email,
          template: upTpl,
        }).catch(() => null);
      }
    }

    void dispatchExternalWebhooks({
      webhookUrl: settings?.webhookUrl,
      slackWebhookUrl: settings?.slackWebhookUrl,
      telegramChatId: settings?.telegramChatId,
      text: `🟢 [AÇILDI] ${monitor.name} (${monitor.url}) tekrar yayında.`,
      payload: {
        event: "monitor.up",
        monitorId: monitor.id,
        name: monitor.name,
        url: monitor.url,
        durationMs,
        timestamp: now.toISOString(),
      },
    }).catch(() => null);
  }
}

/**
 * Günlük SSL sertifika bitiş tarihi kontrolü.
 */
export async function runDailySslCheckJob(): Promise<void> {
  const monitors = await prisma.monitor.findMany({
    where: {
      paused: false,
      checkSsl: true,
      url: { startsWith: "https://" },
    },
    include: {
      user: {
        include: { settings: true, contacts: { where: { verified: true } } },
      },
    },
  });

  for (const m of monitors) {
    const ssl = await checkSslCertificateExpiry(m.url);
    if (!ssl.expiresAt || ssl.daysRemaining === null) continue;

    await prisma.monitor.update({
      where: { id: m.id },
      data: { sslExpiresAt: ssl.expiresAt },
    });

    const daysThreshold = m.user.settings?.sslExpiryDaysBefore ?? 14;
    if (
      ssl.daysRemaining <= daysThreshold &&
      ssl.daysRemaining >= 0 &&
      (m.user.settings?.notifyOnSslExpiry ?? true) &&
      m.user.emailVerified
    ) {
      const alreadyNotifiedRecently =
        m.sslNotifiedAt && Date.now() - m.sslNotifiedAt.getTime() < 7 * 86_400_000;
      if (!alreadyNotifiedRecently) {
        const tpl = buildSslExpiryEmailTemplate({
          monitorId: m.id,
          monitorName: m.name,
          url: m.url,
          daysRemaining: ssl.daysRemaining,
          expiresAt: ssl.expiresAt,
          timezone: m.user.settings?.timezone || "Europe/Istanbul",
        });

        const recipients = [m.user.email, ...m.user.contacts.map((c) => c.email)];
        for (const toEmail of recipients) {
          await enqueueEmailNotification({
            userId: m.userId,
            monitorId: m.id,
            type: "SSL",
            toEmail,
            template: tpl,
          });
        }

        await prisma.monitor.update({
          where: { id: m.id },
          data: { sslNotifiedAt: new Date() },
        });
      }
    }
  }
}

/**
 * Plana göre eski Check kayıtlarını temizleyen günlük bakım işi.
 */
export async function runCheckRetentionCleanupJob(): Promise<void> {
  const users = await prisma.user.findMany({
    select: { id: true, plan: true },
  });

  for (const u of users) {
    const retentionDays = DEFAULT_PLANS[u.plan as keyof typeof DEFAULT_PLANS]?.retentionDays ?? 30;
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    await prisma.check.deleteMany({
      where: {
        monitor: { userId: u.id },
        checkedAt: { lt: cutoff },
      },
    });
  }
}

/**
 * Günlük/Haftalık özet (digest) e-postalarını gönderir.
 */
export async function runDigestEmailJob(period: "DAILY" | "WEEKLY"): Promise<void> {
  const since = new Date(
    Date.now() - (period === "DAILY" ? 86_400_000 : 7 * 86_400_000)
  );
  const users = await prisma.user.findMany({
    where: {
      emailVerified: { not: null },
      suspended: false,
      settings:
        period === "DAILY" ? { digestDaily: true } : { digestWeekly: true },
    },
    include: {
      monitors: true,
    },
  });

  for (const user of users) {
    if (user.monitors.length === 0) continue;
    const monitorIds = user.monitors.map((m) => m.id);
    const [totalChecks, upChecks, incidentsCount] = await Promise.all([
      prisma.check.count({
        where: { monitorId: { in: monitorIds }, checkedAt: { gte: since } },
      }),
      prisma.check.count({
        where: {
          monitorId: { in: monitorIds },
          checkedAt: { gte: since },
          status: "UP",
        },
      }),
      prisma.incident.count({
        where: { monitorId: { in: monitorIds }, startedAt: { gte: since } },
      }),
    ]);

    const uptimePct =
      totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(2) : "100.00";
    const downCount = user.monitors.filter((m) => m.currentStatus === "DOWN").length;

    const tpl = buildDigestEmailTemplate({
      periodLabel: period === "DAILY" ? "Günlük" : "Haftalık",
      totalMonitors: user.monitors.length,
      downMonitorsCount: downCount,
      incidentsCount,
      overallUptimePercent: uptimePct,
    });

    await enqueueEmailNotification({
      userId: user.id,
      type: "DIGEST",
      toEmail: user.email,
      template: tpl,
    });
  }
}

/**
 * Worker ana başlatıcısı:
 * - Sunucu yeniden başladığında tüm aktif monitörleri Redis/BullMQ üzerinde senkronize eder.
 * - Eşzamanlılık (concurrency = varsayılan 20) ile paralel işler.
 * - Redis bağlantısı kesilirse yerel döngü (fallback scheduler) ile kesintisiz devam eder.
 */
async function startWorker() {
  console.log(`[Artakip Worker] Başlatılıyor (Concurrency: ${CONCURRENCY})...`);

  const conn = getRedisConnection();

  if (conn) {
    const monitorWorker = new Worker(
      MONITOR_QUEUE_NAME,
      async (job) => {
        const { monitorId } = job.data as { monitorId: string };
        if (monitorId) {
          await executeMonitorCheck(monitorId);
        }
      },
      {
        connection: conn as never,
        concurrency: CONCURRENCY,
      }
    );

    const emailWorker = new Worker(
      EMAIL_QUEUE_NAME,
      async (job) => {
        const payload = job.data as EmailJobPayload;
        const result = await sendEmailWithRetry({
          userId: payload.userId,
          monitorId: payload.monitorId,
          type: payload.type,
          toEmail: payload.toEmail,
          template: payload.template,
          maxRetries: 1, // BullMQ kendi 3 denemesini yönetir
        });
        if (!result.success) {
          throw new Error(result.error || "SMTP gönderim hatası");
        }
      },
      {
        connection: conn as never,
        concurrency: 5,
      }
    );

    monitorWorker.on("error", (err) => console.error("[MonitorWorker Error]", err.message));
    emailWorker.on("error", (err) => console.error("[EmailWorker Error]", err.message));
  }

  // Başlangıçta tüm aktif monitörleri kuyruğa kaydet
  try {
    const activeMonitors = await prisma.monitor.findMany({
      where: { paused: false },
      select: { id: true, intervalSeconds: true },
    });
    for (const m of activeMonitors) {
      await scheduleMonitorRepeatableJob(m.id, m.intervalSeconds);
    }
    console.log(`[Artakip Worker] ${activeMonitors.length} aktif monitör planlandı.`);
  } catch (err) {
    console.warn("[Artakip Worker] Başlangıç senkronizasyonu uyarısı:", err);
  }

  // Her 15 saniyede bir heartbeat güncelle ve zamanı gelen monitörleri denetle
  setInterval(async () => {
    try {
      if (conn) {
        await conn.set(WORKER_HEARTBEAT_KEY, String(Date.now()), "EX", 90);
      }

      const monitors = await prisma.monitor.findMany({
        where: { paused: false },
        select: { id: true, intervalSeconds: true, lastCheckedAt: true },
      });

      const nowMs = Date.now();
      const dueMonitorIds = monitors
        .filter((m) => {
          if (!m.lastCheckedAt) return true;
          return nowMs - m.lastCheckedAt.getTime() >= m.intervalSeconds * 1000;
        })
        .map((m) => m.id);

      // Concurrency grupları halinde çalıştır
      for (let i = 0; i < dueMonitorIds.length; i += CONCURRENCY) {
        const chunk = dueMonitorIds.slice(i, i + CONCURRENCY);
        await Promise.allSettled(chunk.map((id) => executeMonitorCheck(id)));
      }
    } catch (err) {
      console.error("[Artakip Worker Tick Error]", err);
    }
  }, 15_000);

  // Günlük bakım işleri (SSL kontrolü, eski Check temizliği ve günlük özet)
  setInterval(async () => {
    await runDailySslCheckJob().catch((e) => console.error("SSL job error:", e));
    await runCheckRetentionCleanupJob().catch((e) => console.error("Cleanup error:", e));
    await runDigestEmailJob("DAILY").catch((e) => console.error("Digest error:", e));
  }, 24 * 60 * 60 * 1000);
}

if (require.main === module) {
  startWorker().catch((err) => {
    console.error("Worker kritik hata:", err);
    process.exit(1);
  });
}
