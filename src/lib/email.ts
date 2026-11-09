import fs from "fs";
import os from "os";
import path from "path";
import nodemailer from "nodemailer";
import { formatDateTR, formatDurationTR } from "./utils";
import { prisma } from "./prisma";

export const ALARM_STORM_THRESHOLD = 20;

export interface EmailTemplateOutput {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationTriggerPolicyInput {
  eventType: "DOWN" | "UP" | "SSL" | "DIGEST";
  userEmailVerified: Date | null;
  notifyOnDown: boolean;
  notifyOnUp: boolean;
  notifyOnSslExpiry: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string;
  now?: Date;
}

export interface NotificationTriggerDecision {
  shouldSendNow: boolean;
  deferForQuietHours: boolean;
  reason?: string;
}

/**
 * Belirli bir zamanın kullanıcının sessiz saatleri (örn. "23:00" - "07:00") içinde olup olmadığını hesaplar.
 */
export function isWithinQuietHours(
  now: Date,
  quietHoursStart?: string | null,
  quietHoursEnd?: string | null,
  timezone = "Europe/Istanbul"
): boolean {
  if (!quietHoursStart || !quietHoursEnd) return false;
  const parseHm = (str: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  };

  const startMin = parseHm(quietHoursStart);
  const endMin = parseHm(quietHoursEnd);
  if (startMin === null || endMin === null || startMin === endMin) return false;

  let currentMinutes: number;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    currentMinutes = (hour % 24) * 60 + minute;
  } catch {
    currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  }

  if (startMin < endMin) {
    return currentMinutes >= startMin && currentMinutes < endMin;
  }
  // Gece yarısını aşan aralık (örn. 23:00 -> 07:00)
  return currentMinutes >= startMin || currentMinutes < endMin;
}

/**
 * Bildirim tetikleme kararını verir (e-posta doğrulaması, kullanıcı tercihleri ve sessiz saatler).
 */
export function evaluateNotificationPolicy(
  input: NotificationTriggerPolicyInput
): NotificationTriggerDecision {
  if (!input.userEmailVerified) {
    return {
      shouldSendNow: false,
      deferForQuietHours: false,
      reason: "Kullanıcı e-posta adresi doğrulanmamış.",
    };
  }

  if (input.eventType === "DOWN" && !input.notifyOnDown) {
    return {
      shouldSendNow: false,
      deferForQuietHours: false,
      reason: "Kullanıcı kapanma bildirimlerini kapattı.",
    };
  }

  if (input.eventType === "UP" && !input.notifyOnUp) {
    return {
      shouldSendNow: false,
      deferForQuietHours: false,
      reason: "Kullanıcı açılma bildirimlerini kapattı.",
    };
  }

  if (input.eventType === "SSL" && !input.notifyOnSslExpiry) {
    return {
      shouldSendNow: false,
      deferForQuietHours: false,
      reason: "Kullanıcı SSL bildirimlerini kapattı.",
    };
  }

  const now = input.now ?? new Date();
  if (
    isWithinQuietHours(now, input.quietHoursStart, input.quietHoursEnd, input.timezone)
  ) {
    return {
      shouldSendNow: false,
      deferForQuietHours: true,
      reason: "Sessiz saatler aktif; bildirim sessiz saat bitişinde toplu gönderilecek.",
    };
  }

  return {
    shouldSendNow: true,
    deferForQuietHours: false,
  };
}

/**
 * Alarm fırtınası koruması: Aynı anda 20+ site kapandığında tek toplu mail gönderilip gönderilmeyeceğini belirler.
 */
export function shouldBatchAsAlarmStorm(
  simultaneousDownCount: number,
  threshold = ALARM_STORM_THRESHOLD
): boolean {
  return simultaneousDownCount >= threshold;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
}

function wrapHtmlLayout(title: string, badgeColor: string, contentHtml: string): string {
  const settingsUrl = `${getAppUrl()}/dashboard/settings`;
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
  <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
    <div style="background:${badgeColor}; color:#ffffff; padding:16px 24px; font-weight:700; font-size:18px;">
      Artakip Uptime — ${title}
    </div>
    <div style="padding:24px; line-height:1.6; font-size:15px;">
      ${contentHtml}
    </div>
    <div style="background:#f1f5f9; padding:16px 24px; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0;">
      Bu e-posta Artakip Uptime izleme servisiniz tarafından otomatik gönderilmiştir.<br/>
      <a href="${settingsUrl}" style="color:#2563eb; text-decoration:underline;">Bildirim ayarlarını değiştir veya abonelikten çık</a>
    </div>
  </div>
</body>
</html>`;
}

export function buildDownEmailTemplate(params: {
  monitorId: string;
  monitorName: string;
  url: string;
  startedAt: Date;
  reason: string;
  timezone?: string;
}): EmailTemplateOutput {
  const tz = params.timezone || "Europe/Istanbul";
  const timeStr = formatDateTR(params.startedAt, tz);
  const detailUrl = `${getAppUrl()}/dashboard/monitors/${params.monitorId}`;
  const settingsUrl = `${getAppUrl()}/dashboard/settings`;

  const subject = `🔴 [KAPANDI] ${params.monitorName} erişilemiyor`;
  const html = wrapHtmlLayout(
    "Site Kapandı Uyarısı",
    "#dc2626",
    `<p><strong>${params.monitorName}</strong> isimli web siteniz yapılan kontrolde yanıt vermedi.</p>
     <table style="width:100%; border-collapse:collapse; margin:16px 0;">
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">Site Adı</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>${params.monitorName}</strong></td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">URL</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><a href="${params.url}">${params.url}</a></td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">Kapanma Zamanı (${tz})</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;">${timeStr}</td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">Hata Nedeni</td><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#dc2626;">${params.reason}</td></tr>
     </table>
     <p style="margin-top:20px;">
       <a href="${detailUrl}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">Panelde Görüntüle</a>
     </p>`
  );

  const text = `[KAPANDI] ${params.monitorName}\nURL: ${params.url}\nKapanma Zamanı (${tz}): ${timeStr}\nHata Nedeni: ${params.reason}\nPanel: ${detailUrl}\nBildirim Ayarları / Abonelikten Çık: ${settingsUrl}`;

  return { subject, html, text };
}

export function buildUpEmailTemplate(params: {
  monitorId: string;
  monitorName: string;
  url: string;
  resolvedAt: Date;
  durationMs: number;
  timezone?: string;
}): EmailTemplateOutput {
  const tz = params.timezone || "Europe/Istanbul";
  const timeStr = formatDateTR(params.resolvedAt, tz);
  const durationStr = formatDurationTR(params.durationMs);
  const detailUrl = `${getAppUrl()}/dashboard/monitors/${params.monitorId}`;
  const settingsUrl = `${getAppUrl()}/dashboard/settings`;

  const subject = `🟢 [AÇILDI] ${params.monitorName} tekrar yayında (${durationStr} kesinti)`;
  const html = wrapHtmlLayout(
    "Site Tekrar Açıldı",
    "#16a34a",
    `<p><strong>${params.monitorName}</strong> isimli web siteniz tekrar erişilebilir duruma geldi.</p>
     <table style="width:100%; border-collapse:collapse; margin:16px 0;">
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">Site Adı</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>${params.monitorName}</strong></td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">URL</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><a href="${params.url}">${params.url}</a></td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">Açılma Zamanı (${tz})</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;">${timeStr}</td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">Toplam Kesinti Süresi</td><td style="padding:8px; border-bottom:1px solid #e2e8f0; font-weight:700;">${durationStr}</td></tr>
     </table>
     <p style="margin-top:20px;">
       <a href="${detailUrl}" style="display:inline-block; background:#16a34a; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">Olay Geçmişini İncele</a>
     </p>`
  );

  const text = `[AÇILDI] ${params.monitorName}\nURL: ${params.url}\nAçılma Zamanı (${tz}): ${timeStr}\nToplam Kesinti Süresi: ${durationStr}\nPanel: ${detailUrl}\nBildirim Ayarları / Abonelikten Çık: ${settingsUrl}`;

  return { subject, html, text };
}

export function buildSslExpiryEmailTemplate(params: {
  monitorId: string;
  monitorName: string;
  url: string;
  daysRemaining: number;
  expiresAt: Date;
  timezone?: string;
}): EmailTemplateOutput {
  const tz = params.timezone || "Europe/Istanbul";
  const expiryStr = formatDateTR(params.expiresAt, tz);
  const detailUrl = `${getAppUrl()}/dashboard/monitors/${params.monitorId}`;
  const settingsUrl = `${getAppUrl()}/dashboard/settings`;

  const subject = `⚠️ [SSL UYARISI] ${params.monitorName} SSL sertifikasının bitmesine ${params.daysRemaining} gün kaldı`;
  const html = wrapHtmlLayout(
    "SSL Sertifika Süresi Doluyor",
    "#d97706",
    `<p><strong>${params.monitorName}</strong> sitenizin SSL sertifikasının süresi yakında dolacaktır.</p>
     <table style="width:100%; border-collapse:collapse; margin:16px 0;">
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">Site Adı</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>${params.monitorName}</strong></td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">Kalan Gün</td><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#d97706; font-weight:700;">${params.daysRemaining} gün</td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#64748b;">Bitiş Tarihi</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;">${expiryStr}</td></tr>
     </table>
     <p><a href="${detailUrl}" style="display:inline-block; background:#d97706; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">Site Detayına Git</a></p>`
  );

  const text = `[SSL UYARISI] ${params.monitorName} (${params.url})\nKalan Gün: ${params.daysRemaining}\nBitiş Tarihi: ${expiryStr}\nPanel: ${detailUrl}\nAyarlar: ${settingsUrl}`;

  return { subject, html, text };
}

export function buildAlarmStormEmailTemplate(params: {
  downMonitors: Array<{ name: string; url: string; reason: string }>;
  occurredAt: Date;
  timezone?: string;
}): EmailTemplateOutput {
  const tz = params.timezone || "Europe/Istanbul";
  const timeStr = formatDateTR(params.occurredAt, tz);
  const count = params.downMonitors.length;
  const dashboardUrl = `${getAppUrl()}/dashboard/incidents`;
  const settingsUrl = `${getAppUrl()}/dashboard/settings`;

  const listItems = params.downMonitors
    .slice(0, 50)
    .map(
      (m) =>
        `<li><strong>${m.name}</strong> (${m.url}) — <span style="color:#dc2626;">${m.reason}</span></li>`
    )
    .join("");

  const subject = `🚨 [TOPLU ALARM] ${count} web sitesi aynı anda kapandı!`;
  const html = wrapHtmlLayout(
    `Toplu Kesinti Uyarısı (${count} Site)`,
    "#991b1b",
    `<p><strong>Alarm Fırtınası Koruması:</strong> Kısa süre içinde <strong>${count}</strong> sitenizde eşzamanlı kesinti tespit edildi. Gelen kutunuzu korumak adına bu bildirim tek e-postada birleştirilmiştir.</p>
     <p>Tespit Zamanı (${tz}): <strong>${timeStr}</strong></p>
     <ul style="padding-left:20px; line-height:1.7;">${listItems}</ul>
     <p><a href="${dashboardUrl}" style="display:inline-block; background:#991b1b; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">Tüm Kesintileri Görüntüle</a></p>`
  );

  const text = `[TOPLU ALARM] ${count} site aynı anda kapandı (${timeStr})\n` +
    params.downMonitors.map((m) => `- ${m.name} (${m.url}): ${m.reason}`).join("\n") +
    `\nPanel: ${dashboardUrl}\nAyarlar: ${settingsUrl}`;

  return { subject, html, text };
}

export function buildDigestEmailTemplate(params: {
  periodLabel: "Günlük" | "Haftalık";
  totalMonitors: number;
  downMonitorsCount: number;
  incidentsCount: number;
  overallUptimePercent: string;
}): EmailTemplateOutput {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const settingsUrl = `${getAppUrl()}/dashboard/settings`;
  const subject = `📊 Artakip ${params.periodLabel} Uptime Özeti — %${params.overallUptimePercent} Uptime`;

  const html = wrapHtmlLayout(
    `${params.periodLabel} Uptime Raporu`,
    "#1d4ed8",
    `<p>${params.periodLabel} web sitesi izleme özetiniz aşağıdadır:</p>
     <table style="width:100%; border-collapse:collapse; margin:16px 0;">
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0;">Toplam İzlenen Site</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>${params.totalMonitors}</strong></td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0;">Şu An Kapalı Site Sayısı</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>${params.downMonitorsCount}</strong></td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0;">Dönem İçi Toplam Kesinti Olayı</td><td style="padding:8px; border-bottom:1px solid #e2e8f0;"><strong>${params.incidentsCount}</strong></td></tr>
       <tr><td style="padding:8px; border-bottom:1px solid #e2e8f0;">Ortalama Uptime Oranı</td><td style="padding:8px; border-bottom:1px solid #e2e8f0; color:#16a34a;"><strong>%${params.overallUptimePercent}</strong></td></tr>
     </table>
     <p><a href="${dashboardUrl}" style="display:inline-block; background:#1d4ed8; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">Panele Git</a></p>`
  );

  const text = `Artakip ${params.periodLabel} Özet\nToplam Site: ${params.totalMonitors}\nŞu An Kapalı: ${params.downMonitorsCount}\nKesinti Sayısı: ${params.incidentsCount}\nUptime: %${params.overallUptimePercent}\nPanel: ${dashboardUrl}\nAyarlar: ${settingsUrl}`;

  return { subject, html, text };
}

export function buildAccountEmailTemplate(
  kind: "VERIFY" | "RESET" | "WELCOME" | "VERIFY_CONTACT",
  params: { name?: string | null; actionUrl: string }
): EmailTemplateOutput {
  const userName = params.name || "Kullanıcı";
  if (kind === "VERIFY") {
    return {
      subject: "Artakip — E-posta Adresinizi Doğrulayın",
      html: wrapHtmlLayout(
        "E-posta Doğrulama",
        "#2563eb",
        `<p>Merhaba <strong>${userName}</strong>,</p>
         <p>Artakip hesabınızı etkinleştirmek ve kesinti bildirimlerini alabilmek için lütfen e-posta adresinizi doğrulayın:</p>
         <p><a href="${params.actionUrl}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">E-postamı Doğrula</a></p>`
      ),
      text: `Merhaba ${userName}, e-posta adresinizi doğrulamak için tıklayın: ${params.actionUrl}`,
    };
  }
  if (kind === "RESET") {
    return {
      subject: "Artakip — Şifre Sıfırlama Talebi",
      html: wrapHtmlLayout(
        "Şifre Sıfırlama",
        "#2563eb",
        `<p>Merhaba <strong>${userName}</strong>,</p>
         <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın (1 saat geçerlidir):</p>
         <p><a href="${params.actionUrl}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">Şifremi Sıfırla</a></p>`
      ),
      text: `Merhaba ${userName}, şifrenizi sıfırlamak için tıklayın: ${params.actionUrl}`,
    };
  }
  if (kind === "VERIFY_CONTACT") {
    return {
      subject: "Artakip — Ek Bildirim E-posta Doğrulaması",
      html: wrapHtmlLayout(
        "Bildirim E-postası Doğrulama",
        "#2563eb",
        `<p>Bu e-posta adresi Artakip uptime bildirim alıcısı olarak eklendi. Onaylamak için tıklayın:</p>
         <p><a href="${params.actionUrl}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">Adresi Onayla</a></p>`
      ),
      text: `Bildirim e-posta adresini onaylamak için tıklayın: ${params.actionUrl}`,
    };
  }
  return {
    subject: "Artakip'e Hoş Geldiniz!",
    html: wrapHtmlLayout(
      "Hoş Geldiniz",
      "#16a34a",
      `<p>Merhaba <strong>${userName}</strong>,</p>
       <p>Artakip Uptime İzleme platformuna hoş geldiniz! Hemen ilk web sitenizi ekleyerek 7/24 izlemeye başlayabilirsiniz.</p>
       <p><a href="${params.actionUrl}" style="display:inline-block; background:#16a34a; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">Panele Git</a></p>`
    ),
    text: `Artakip'e hoş geldiniz ${userName}! Panel: ${params.actionUrl}`,
  };
}

/**
 * cPanel / Linux sunucularda Exim "Sender verify failed (550 No Such User Here)" hatasını
 * önlemek için ~/etc/<domain>/passwd içindeki gerçek bir e-posta hesabını veya sistem kullanıcısını bulur.
 */
function resolveLocalSenderCandidates(): string[] {
  const candidates: string[] = [];
  const rawFrom = process.env.SMTP_FROM;
  if (rawFrom && !rawFrom.includes("example.com")) {
    candidates.push(rawFrom);
  }
  if (process.env.SMTP_USER && process.env.SMTP_USER.includes("@")) {
    candidates.push(`Artakip Uptime <${process.env.SMTP_USER}>`);
  }

  try {
    const homeDir = os.homedir();
    const etcDir = path.join(homeDir, "etc");
    if (fs.existsSync(etcDir)) {
      const entries = fs.readdirSync(etcDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const domain = entry.name;
        const passwdFile = path.join(etcDir, domain, "passwd");
        if (fs.existsSync(passwdFile)) {
          const lines = fs
            .readFileSync(passwdFile, "utf8")
            .split(/\r?\n/)
            .filter(Boolean);
          for (const line of lines) {
            const localPart = line.split(":")[0]?.trim();
            if (localPart) {
              candidates.push(`Artakip Uptime <${localPart}@${domain}>`);
            }
          }
        }
      }
    }
  } catch {
    // Yoksay
  }

  try {
    const username = os.userInfo().username;
    const hostname = os.hostname();
    if (username && hostname) {
      candidates.push(`Artakip Uptime <${username}@${hostname}>`);
    }
  } catch {
    // Yoksay
  }

  candidates.push("Artakip Uptime <noreply@artovy.com>");
  return Array.from(new Set(candidates));
}

function extractAddress(fromHeader: string): string {
  const m = /<([^>]+)>/.exec(fromHeader);
  return m ? m[1] : fromHeader.trim();
}

/**
 * Nodemailer ile e-posta gönderir ve NotificationLog tablosuna kaydeder.
 * Başarısız olursa maksimum maxRetries (varsayılan 3) kez dener.
 */
export async function sendEmailWithRetry(params: {
  userId: string;
  monitorId?: string | null;
  type: string;
  toEmail: string;
  template: EmailTemplateOutput;
  maxRetries?: number;
}): Promise<{ success: boolean; error?: string }> {
  const maxRetries = params.maxRetries ?? 3;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const senderCandidates = resolveLocalSenderCandidates();
  const primaryFrom = senderCandidates[0] || "Artakip Uptime <noreply@artovy.com>";

  let lastError = "";
  const hasCustomSmtp = Boolean(host && host !== "smtp.example.com");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (hasCustomSmtp) {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: user && user !== "apikey" ? { user, pass } : undefined,
          tls: { rejectUnauthorized: false },
          connectionTimeout: 6000,
        });

        await transporter.sendMail({
          from: primaryFrom,
          to: params.toEmail,
          subject: params.template.subject,
          text: params.template.text,
          html: params.template.html,
        });
      } else if (process.platform === "linux") {
        let sentOnLinux = false;
        let linuxErr = "";

        // 1. Önce /usr/sbin/sendmail ile dene (cPanel/CloudLinux üzerinde en güvenilir yöntem)
        for (const candidateFrom of senderCandidates) {
          try {
            const envelopeFrom = extractAddress(candidateFrom);
            const sendmailTransport = nodemailer.createTransport({
              sendmail: true,
              newline: "unix",
              path: "/usr/sbin/sendmail",
              args: ["-f", envelopeFrom],
            });
            await sendmailTransport.sendMail({
              from: candidateFrom,
              to: params.toEmail,
              subject: params.template.subject,
              text: params.template.text,
              html: params.template.html,
            });
            sentOnLinux = true;
            break;
          } catch (e: unknown) {
            linuxErr = e instanceof Error ? e.message : String(e);
          }
        }

        // 2. sendmail başarısız olduysa 127.0.0.1:25 (Exim) üzerinden tüm geçerli gönderici adaylarıyla dene
        if (!sentOnLinux) {
          for (const candidateFrom of senderCandidates) {
            try {
              const localSmtp = nodemailer.createTransport({
                host: "127.0.0.1",
                port: 25,
                secure: false,
                tls: { rejectUnauthorized: false },
                connectionTimeout: 5000,
              });
              await localSmtp.sendMail({
                from: candidateFrom,
                to: params.toEmail,
                subject: params.template.subject,
                text: params.template.text,
                html: params.template.html,
              });
              sentOnLinux = true;
              break;
            } catch (e: unknown) {
              linuxErr = e instanceof Error ? e.message : String(e);
            }
          }
        }

        if (!sentOnLinux) {
          throw new Error(linuxErr || "Yerel Exim/sendmail gönderimi başarısız oldu.");
        }
      } else {
        // Yerel Windows/Mac geliştirme ortamında SMTP yoksa konsola simüle et
        console.log(
          `[EMAIL-SIMULATED] To: ${params.toEmail} | Subject: ${params.template.subject}`
        );
      }

      await prisma.notificationLog.create({
        data: {
          userId: params.userId,
          monitorId: params.monitorId ?? null,
          type: params.type,
          toEmail: params.toEmail,
          success: true,
        },
      });
      return { success: true };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 500));
      }
    }
  }

  try {
    await prisma.notificationLog.create({
      data: {
        userId: params.userId,
        monitorId: params.monitorId ?? null,
        type: params.type,
        toEmail: params.toEmail,
        success: false,
        error: lastError,
      },
    });
  } catch {
    // Log kaydı hatası ana akışı kırmamalı
  }

  return { success: false, error: lastError };
}

/**
 * Opsiyonel Webhook / Slack / Telegram bildirimlerini tetikler (Aşama 9).
 */
export async function dispatchExternalWebhooks(params: {
  webhookUrl?: string | null;
  slackWebhookUrl?: string | null;
  telegramChatId?: string | null;
  text: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (params.webhookUrl) {
    tasks.push(
      fetch(params.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "TakipBot/1.0" },
        body: JSON.stringify(params.payload),
      }).catch(() => null)
    );
  }

  if (params.slackWebhookUrl) {
    tasks.push(
      fetch(params.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: params.text }),
      }).catch(() => null)
    );
  }

  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  if (tgToken && params.telegramChatId) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: params.telegramChatId,
          text: params.text,
        }),
      }).catch(() => null)
    );
  }

  await Promise.allSettled(tasks);
}
