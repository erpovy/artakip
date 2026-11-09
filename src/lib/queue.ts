import { Queue } from "bullmq";
import IORedis from "ioredis";
import { EmailTemplateOutput, sendEmailWithRetry } from "./email";

export const MONITOR_QUEUE_NAME = "monitor-checks";
export const EMAIL_QUEUE_NAME = "email-notifications";
export const WORKER_HEARTBEAT_KEY = "artakip:worker:heartbeat";

export interface EmailJobPayload {
  userId: string;
  monitorId?: string | null;
  type: string;
  toEmail: string;
  template: EmailTemplateOutput;
}

let redisConnection: IORedis | null = null;
let monitorQueue: Queue | null = null;
let emailQueue: Queue | null = null;
let redisAvailable = false;

export function getRedisConnection(): IORedis | null {
  const redisUrl = process.env.REDIS_URL;
  // cPanel / tek sunucu kurulumlarında varsayılan localhost Redis kapalıysa kuyrukta takılmayı önle
  if (!redisUrl || process.env.ENABLE_REDIS !== "true") return null;
  if (redisConnection) return redisConnection;

  try {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      connectTimeout: 1500,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 2) return null;
        return 200;
      },
    });
    redisConnection.on("ready", () => {
      redisAvailable = true;
    });
    redisConnection.on("error", () => {
      redisAvailable = false;
    });
    return redisConnection;
  } catch {
    return null;
  }
}

export function getMonitorQueue(): Queue | null {
  if (monitorQueue) return monitorQueue;
  const conn = getRedisConnection();
  if (!conn) return null;
  try {
    monitorQueue = new Queue(MONITOR_QUEUE_NAME, { connection: conn as never });
    return monitorQueue;
  } catch {
    return null;
  }
}

export function getEmailQueue(): Queue | null {
  if (emailQueue) return emailQueue;
  const conn = getRedisConnection();
  if (!conn) return null;
  try {
    emailQueue = new Queue(EMAIL_QUEUE_NAME, { connection: conn as never });
    return emailQueue;
  } catch {
    return null;
  }
}

/**
 * Bir monitör için BullMQ üzerinde periyodik kontrol işi planlar.
 */
export async function scheduleMonitorRepeatableJob(
  monitorId: string,
  intervalSeconds: number
): Promise<void> {
  const q = getMonitorQueue();
  if (!q) return;
  try {
    await removeMonitorRepeatableJob(monitorId);
    await q.add(
      "check-monitor",
      { monitorId },
      {
        jobId: `monitor:${monitorId}`,
        repeat: { every: Math.max(15, intervalSeconds) * 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      }
    );
  } catch {
    // Redis erişilemezse worker kendi zamanlayıcı döngüsüyle devam eder
  }
}

/**
 * Monitör duraklatıldığında veya silindiğinde tekrarlayan işi kaldırır.
 */
export async function removeMonitorRepeatableJob(monitorId: string): Promise<void> {
  const q = getMonitorQueue();
  if (!q) return;
  try {
    const repeatableJobs = await q.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === `monitor:${monitorId}` || job.key.includes(monitorId)) {
        await q.removeRepeatableByKey(job.key);
      }
    }
  } catch {
    // Yoksay
  }
}

/**
 * İlk hatada 5 sn sonra yeniden deneme (retry) veya anında kontrol için tek seferlik iş ekler.
 */
export async function enqueueImmediateMonitorCheck(
  monitorId: string,
  delayMs = 0
): Promise<void> {
  const q = getMonitorQueue();
  if (!q) return;
  try {
    await q.add(
      "check-monitor-immediate",
      { monitorId, isRetry: delayMs > 0 },
      {
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: 100,
      }
    );
  } catch {
    // Yoksay
  }
}

/**
 * E-posta gönderimini kuyruğa ekler (3 yeniden deneme ile).
 * Redis bağlantısı yoksa doğrudan sendEmailWithRetry ile gönderir.
 */
export async function enqueueEmailNotification(payload: EmailJobPayload): Promise<void> {
  const q = getEmailQueue();
  if (q && redisAvailable) {
    try {
      await q.add("send-email", payload, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 200,
        removeOnFail: 500,
      });
      return;
    } catch {
      // Kuyruk hatasında doğrudan gönderime düş
    }
  }
  await sendEmailWithRetry({
    userId: payload.userId,
    monitorId: payload.monitorId,
    type: payload.type,
    toEmail: payload.toEmail,
    template: payload.template,
    maxRetries: 3,
  });
}

export async function getQueueHealth(): Promise<{
  redisConnected: boolean;
  workerAlive: boolean;
  workerLastSeenAt: string | null;
  monitorQueueWaiting: number;
  monitorQueueActive: number;
  emailQueueWaiting: number;
  emailQueueFailed: number;
}> {
  const conn = getRedisConnection();
  if (!conn) {
    return {
      redisConnected: false,
      workerAlive: false,
      workerLastSeenAt: null,
      monitorQueueWaiting: 0,
      monitorQueueActive: 0,
      emailQueueWaiting: 0,
      emailQueueFailed: 0,
    };
  }

  try {
    const heartbeat = await conn.get(WORKER_HEARTBEAT_KEY);
    const mq = getMonitorQueue();
    const eq = getEmailQueue();

    const [mWaiting, mActive, eWaiting, eFailed] = await Promise.all([
      mq ? mq.getWaitingCount() : 0,
      mq ? mq.getActiveCount() : 0,
      eq ? eq.getWaitingCount() : 0,
      eq ? eq.getFailedCount() : 0,
    ]);

    const lastSeenMs = heartbeat ? Number(heartbeat) : 0;
    const workerAlive = lastSeenMs > 0 && Date.now() - lastSeenMs < 60_000;

    return {
      redisConnected: true,
      workerAlive,
      workerLastSeenAt: lastSeenMs ? new Date(lastSeenMs).toISOString() : null,
      monitorQueueWaiting: mWaiting,
      monitorQueueActive: mActive,
      emailQueueWaiting: eWaiting,
      emailQueueFailed: eFailed,
    };
  } catch {
    return {
      redisConnected: false,
      workerAlive: false,
      workerLastSeenAt: null,
      monitorQueueWaiting: 0,
      monitorQueueActive: 0,
      emailQueueWaiting: 0,
      emailQueueFailed: 0,
    };
  }
}
