export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.EMBEDDED_WORKER !== "false"
  ) {
    const { executeMonitorCheck, runDailySslCheckJob, runCheckRetentionCleanupJob, runDigestEmailJob } =
      await import("./worker/index");
    const { prisma } = await import("./lib/prisma");

    const concurrency = Number(process.env.WORKER_CONCURRENCY || 20);
    let isRunningTick = false;

    // Plesk / cPanel / aaPanel gibi tek süreçli (single-process) ortamlarda
    // ayrı bir worker konteyneri gerekmeden kontrollerin otomatik çalışmasını sağlar.
    setInterval(async () => {
      if (isRunningTick) return;
      isRunningTick = true;
      try {
        const monitors = await prisma.monitor.findMany({
          where: { paused: false },
          select: { id: true, intervalSeconds: true, lastCheckedAt: true },
        });

        const nowMs = Date.now();
        const dueIds = monitors
          .filter((m) => {
            if (!m.lastCheckedAt) return true;
            return nowMs - m.lastCheckedAt.getTime() >= m.intervalSeconds * 1000;
          })
          .map((m) => m.id);

        for (let i = 0; i < dueIds.length; i += concurrency) {
          const chunk = dueIds.slice(i, i + concurrency);
          await Promise.allSettled(chunk.map((id) => executeMonitorCheck(id)));
        }
      } catch {
        // Veritabanı henüz hazır değilse sessizce geç
      } finally {
        isRunningTick = false;
      }
    }, 15_000);

    setInterval(async () => {
      await runDailySslCheckJob().catch(() => null);
      await runCheckRetentionCleanupJob().catch(() => null);
      await runDigestEmailJob("DAILY").catch(() => null);
    }, 24 * 60 * 60 * 1000);
  }
}
