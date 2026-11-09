process.env.UV_THREADPOOL_SIZE = "1";

import http from "http";
import https from "https";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function sendAlertEmail(toEmail, subject, html, text) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const rawFrom = process.env.SMTP_FROM;
  const from =
    rawFrom && !rawFrom.includes("example.com")
      ? rawFrom
      : "Artakip Uptime <noreply@artakip.artovy.com>";

  const hasCustomSmtp = Boolean(host && host !== "smtp.example.com");

  if (hasCustomSmtp) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && user !== "apikey" ? { user, pass } : undefined,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 6000,
    });
    await transporter.sendMail({ from, to: toEmail, subject, text, html });
    return "SMTP";
  }

  try {
    const localSmtp = nodemailer.createTransport({
      host: "127.0.0.1",
      port: 25,
      secure: false,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 5000,
    });
    await localSmtp.sendMail({ from, to: toEmail, subject, text, html });
    return "Exim (127.0.0.1:25)";
  } catch {
    const sendmailTransport = nodemailer.createTransport({
      sendmail: true,
      newline: "unix",
      path: "/usr/sbin/sendmail",
    });
    await sendmailTransport.sendMail({ from, to: toEmail, subject, text, html });
    return "sendmail (/usr/sbin/sendmail)";
  }
}

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
          if (/suspendedpage\.cgi|\/cgi-sys\/suspended/i.test(location)) {
            finish({
              isUp: false,
              httpCode: 503,
              responseMs: Date.now() - start,
              error: "WHM/cPanel Hesabı Askıya Alınmış (Account Suspended)",
            });
            return;
          }
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

        const chunks = [];
        let totalBytes = 0;
        const maxBytes = 128 * 1024;

        res.on("data", (chunk) => {
          if (totalBytes < maxBytes) {
            chunks.push(chunk);
            totalBytes += chunk.length;
          } else {
            res.destroy();
          }
        });

        const complete = () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          if (
            /cgi-sys\/suspendedpage\.cgi|<title>\s*Account Suspended\s*<\/title>|This Account has been suspended/i.test(
              body
            )
          ) {
            finish({
              isUp: false,
              httpCode: 503,
              responseMs: Date.now() - start,
              error: "WHM/cPanel Hesabı Askıya Alınmış (Account Suspended)",
            });
            return;
          }

          const isUp = statusCode >= 200 && statusCode < 400;
          finish({
            isUp,
            httpCode: statusCode,
            responseMs: Date.now() - start,
            error: isUp ? null : `HTTP ${statusCode}`,
          });
        };

        res.on("end", complete);
        res.on("close", complete);
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
  // Tüm mevcut kullanıcıların e-posta doğrulamasını aktif et (bildirimlerin engellenmemesi için)
  await prisma.user.updateMany({
    where: { emailVerified: null },
    data: { emailVerified: new Date() },
  });

  const monitors = await prisma.monitor.findMany({
    where: { paused: false },
    include: {
      user: {
        include: {
          settings: true,
          contacts: { where: { verified: true } },
        },
      },
    },
  });

  console.log(`Toplam ${monitors.length} aktif site kontrol ediliyor...`);

  for (const m of monitors) {
    const targetUrl = m.wpCheckPath
      ? m.url.replace(/\/$/, "") + (m.wpCheckPath.startsWith("/") ? m.wpCheckPath : `/${m.wpCheckPath}`)
      : m.url;

    const res = await probeUrl(targetUrl, Math.min((m.timeoutSeconds || 10) * 1000, 8000));
    const now = new Date();
    const prevStatus = m.currentStatus;
    const nextStatus = res.isUp ? "UP" : "DOWN";

    await prisma.monitor.update({
      where: { id: m.id },
      data: {
        currentStatus: nextStatus,
        consecutiveFails: res.isUp ? 0 : m.consecutiveFails + 1,
        lastCheckedAt: now,
        lastStatusChangeAt: prevStatus !== nextStatus ? now : m.lastStatusChangeAt || now,
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
      `-> [${nextStatus}] ${m.name} (${targetUrl}) | HTTP: ${res.httpCode ?? "-"} | Süre: ${res.responseMs}ms ${res.error ? "| Neden: " + res.error : ""}`
    );

    const recipients = [m.user.email, ...m.user.contacts.map((c) => c.email)];

    // Eğer site DOWN ise ve açık Incident yoksa Incident oluştur ve DOWN e-postası gönder
    if (nextStatus === "DOWN") {
      const openInc = await prisma.incident.findFirst({
        where: { monitorId: m.id, resolvedAt: null },
      });
      if (!openInc) {
        const reason = res.error || "Site yanıt vermiyor";
        await prisma.incident.create({
          data: {
            monitorId: m.id,
            startedAt: now,
            reason,
          },
        });

        const subject = `🔴 [KAPANDI] ${m.name} erişilemiyor`;
        const text = `[KAPANDI] ${m.name}\nURL: ${m.url}\nNeden: ${reason}\nZaman: ${now.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}\nPanel: https://artakip.artovy.com/dashboard/monitors/${m.id}`;
        const html = `<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#dc2626;margin-top:0;">🔴 Site Kapandı Uyarısı</h2>
          <p><strong>${m.name}</strong> (${m.url}) yapılan kontrolde erişilemedi.</p>
          <p><strong>Hata Nedeni:</strong> <span style="color:#dc2626;">${reason}</span></p>
          <p><strong>Zaman:</strong> ${now.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>
          <p><a href="https://artakip.artovy.com/dashboard/monitors/${m.id}" style="background:#2563eb;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;">Panelde Görüntüle</a></p>
        </div>`;

        for (const toEmail of recipients) {
          try {
            const via = await sendAlertEmail(toEmail, subject, html, text);
            console.log(`   [E-POSTA GÖNDERİLDİ] -> ${toEmail} (${via})`);
          } catch (mailErr) {
            console.error(`   [E-POSTA HATASI] -> ${toEmail}:`, mailErr.message);
          }
        }
      }
    } else if (nextStatus === "UP" && prevStatus === "DOWN") {
      const openInc = await prisma.incident.findFirst({
        where: { monitorId: m.id, resolvedAt: null },
        orderBy: { startedAt: "desc" },
      });
      if (openInc) {
        await prisma.incident.update({
          where: { id: openInc.id },
          data: { resolvedAt: now },
        });
      }
    }
  }
}

main()
  .catch((e) => console.error("Hata:", e))
  .finally(() => prisma.$disconnect());
