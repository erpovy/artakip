process.env.UV_THREADPOOL_SIZE = "1";

import http from "http";
import https from "https";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function probeUrl(urlStr, timeoutMs = 8000, redirectsLeft = 5) {
  return new Promise((resolve) => {
    const start = Date.now();
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      resolve({ isUp: false, httpCode: null, responseMs: 0, error: "Geçersiz URL" });
      return;
    }

    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const req = transport.request(
      parsed,
      {
        method: "GET",
        family: 4,
        servername: parsed.hostname,
        timeout: timeoutMs,
        rejectUnauthorized: false,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 TakipBot/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Connection: "close",
        },
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        const location = res.headers.location;

        if (
          redirectsLeft > 0 &&
          [301, 302, 303, 307, 308].includes(statusCode) &&
          location
        ) {
          res.resume();
          try {
            const nextUrl = new URL(location, parsed).toString();
            probeUrl(nextUrl, timeoutMs, redirectsLeft - 1).then(finish);
          } catch (e) {
            finish({
              isUp: false,
              httpCode: statusCode,
              responseMs: Date.now() - start,
              error: e.message,
            });
          }
          return;
        }

        res.resume();
        const isUp = statusCode >= 200 && statusCode < 400;
        finish({
          isUp,
          httpCode: statusCode,
          responseMs: Date.now() - start,
          error: isUp ? null : `HTTP ${statusCode}`,
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      finish({
        isUp: false,
        httpCode: null,
        responseMs: Date.now() - start,
        error: "Zaman aşımı",
      });
    }, timeoutMs);

    req.on("error", (err) => {
      finish({
        isUp: false,
        httpCode: null,
        responseMs: Date.now() - start,
        error: err.message,
      });
    });

    req.end();
  });
}

async function main() {
  const monitors = await prisma.monitor.findMany({
    where: { paused: false },
  });

  console.log(`Toplam ${monitors.length} aktif site kontrol ediliyor...`);

  for (const m of monitors) {
    const targetUrl = m.wpCheckPath
      ? m.url.replace(/\/$/, "") + (m.wpCheckPath.startsWith("/") ? m.wpCheckPath : `/${m.wpCheckPath}`)
      : m.url;

    const res = await probeUrl(targetUrl, Math.min((m.timeoutSeconds || 10) * 1000, 8000));
    const now = new Date();
    const nextStatus = res.isUp ? "UP" : "DOWN";

    await prisma.monitor.update({
      where: { id: m.id },
      data: {
        currentStatus: nextStatus,
        consecutiveFails: res.isUp ? 0 : m.consecutiveFails + 1,
        lastCheckedAt: now,
        lastStatusChangeAt: m.currentStatus !== nextStatus ? now : m.lastStatusChangeAt || now,
      },
    });

    await prisma.check.create({
      data: {
        monitorId: m.id,
        checkedAt: now,
        status: nextStatus,
        httpCode: res.httpCode,
        responseMs: res.responseMs,
        error: res.error,
      },
    });

    console.log(
      `-> [${nextStatus}] ${m.name} (${targetUrl}) | HTTP: ${res.httpCode ?? "-"} | Süre: ${res.responseMs}ms ${res.error ? "| Hata: " + res.error : ""}`
    );
  }
}

main()
  .catch((e) => console.error("Hata:", e))
  .finally(() => prisma.$disconnect());
