import tls from "tls";
import { MonitorType, Status } from "@prisma/client";
import { validateSafeUrl } from "./ssrf";

export interface ExpectedStatusRange {
  min: number;
  max: number;
}

/**
 * "200-399" veya "200,201,301-302" biçimindeki beklenen HTTP durum dizgesini ayrıştırır.
 */
export function parseExpectedStatus(spec: string): ExpectedStatusRange[] {
  const ranges: ExpectedStatusRange[] = [];
  const parts = (spec || "200-399")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const min = Number(startStr);
      const max = Number(endStr);
      if (!isNaN(min) && !isNaN(max) && min <= max) {
        ranges.push({ min, max });
      }
    } else {
      const code = Number(part);
      if (!isNaN(code)) {
        ranges.push({ min: code, max: code });
      }
    }
  }

  return ranges.length > 0 ? ranges : [{ min: 200, max: 399 }];
}

export function isHttpStatusExpected(httpCode: number, expectedSpec: string): boolean {
  const ranges = parseExpectedStatus(expectedSpec);
  return ranges.some((r) => httpCode >= r.min && httpCode <= r.max);
}

export interface HttpProbeInput {
  url: string;
  wpCheckPath?: string | null;
  type: MonitorType;
  keyword?: string | null;
  timeoutSeconds: number;
  expectedStatus: string;
  followRedirects: boolean;
}

export interface HttpProbeResult {
  isUp: boolean;
  httpCode: number | null;
  responseMs: number;
  error: string | null;
}

/**
 * Hedef URL'yi oluşturur (WordPress özel kontrol yolu seçilmişse ekler).
 */
export function buildTargetUrl(baseUrl: string, wpCheckPath?: string | null): string {
  if (!wpCheckPath || wpCheckPath.trim() === "") return baseUrl;
  try {
    const u = new URL(baseUrl);
    const cleanPath = wpCheckPath.startsWith("/") ? wpCheckPath : `/${wpCheckPath}`;
    u.pathname = u.pathname.replace(/\/$/, "") + cleanPath;
    return u.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Tek bir HTTP/KEYWORD kontrolü gerçekleştirir.
 */
export async function performHttpProbe(
  input: HttpProbeInput,
  customFetch: typeof fetch = fetch
): Promise<HttpProbeResult> {
  const targetUrl = buildTargetUrl(input.url, input.wpCheckPath);
  const ssrf = await validateSafeUrl(targetUrl, {
    skipDnsInTest: process.env.NODE_ENV === "test",
  });
  if (!ssrf.valid) {
    return {
      isUp: false,
      httpCode: null,
      responseMs: 0,
      error: `SSRF Engeli: ${ssrf.reason}`,
    };
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, input.timeoutSeconds * 1000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await customFetch(targetUrl, {
      method: "GET",
      redirect: input.followRedirects ? "follow" : "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "TakipBot/1.0 (+https://artakip.com/bot)",
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Cache-Control": "no-cache",
      },
    });

    const responseMs = Date.now() - start;
    const httpCode = res.status;

    if (!isHttpStatusExpected(httpCode, input.expectedStatus)) {
      return {
        isUp: false,
        httpCode,
        responseMs,
        error: `Beklenmeyen HTTP kodu: ${httpCode} (beklenen: ${input.expectedStatus})`,
      };
    }

    if (input.type === "KEYWORD" && input.keyword && input.keyword.trim() !== "") {
      const bodyText = await res.text();
      if (!bodyText.includes(input.keyword)) {
        return {
          isUp: false,
          httpCode,
          responseMs,
          error: `Anahtar kelime bulunamadı: "${input.keyword}"`,
        };
      }
    }

    return {
      isUp: true,
      httpCode,
      responseMs,
      error: null,
    };
  } catch (err: unknown) {
    const responseMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    let reason = `Bağlantı hatası: ${message}`;

    if (err instanceof Error && err.name === "AbortError") {
      reason = `Zaman aşımı (${input.timeoutSeconds} sn)`;
    } else if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
      reason = "DNS çözümleme hatası (ENOTFOUND)";
    } else if (/ECONNREFUSED/i.test(message)) {
      reason = "Bağlantı reddedildi (ECONNREFUSED)";
    } else if (/CERT_|SSL|TLS|certificate/i.test(message)) {
      reason = `SSL/TLS hatası: ${message}`;
    }

    return {
      isUp: false,
      httpCode: null,
      responseMs,
      error: reason,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface StateTransitionInput {
  previousStatus: Status;
  previousConsecutiveFails: number;
  previousLastStatusChangeAt: Date | null;
  probeSuccess: boolean;
  probeError: string | null;
  failuresBeforeDown: number;
  now: Date;
}

export interface StateTransitionOutput {
  nextStatus: Status;
  nextConsecutiveFails: number;
  nextLastStatusChangeAt: Date | null;
  shouldRetryImmediately: boolean;
  openIncident: boolean;
  incidentStartedAt?: Date;
  resolveIncident: boolean;
  triggerEmail: "DOWN" | "UP" | null;
}

/**
 * Saf (pure) durum geçiş fonksiyonu:
 * - UP -> DOWN: failuresBeforeDown ardışık hata sayısına ulaşıldığında tetiklenir.
 * - İlk hatada (consecutiveFails === 1 ve failuresBeforeDown > 1) 5 sn sonra hızlı retry önerir.
 * - DOWN -> UP: açık Incident'ı kapatır ve UP mailini tetikler.
 * - Aynı durumda kalırsa mail tetiklemez (spam önleme).
 */
export function evaluateMonitorStateTransition(
  input: StateTransitionInput
): StateTransitionOutput {
  const threshold = Math.max(1, input.failuresBeforeDown);

  if (input.probeSuccess) {
    const wasDown = input.previousStatus === "DOWN";
    const statusChanged = input.previousStatus !== "UP";

    return {
      nextStatus: "UP",
      nextConsecutiveFails: 0,
      nextLastStatusChangeAt: statusChanged ? input.now : input.previousLastStatusChangeAt,
      shouldRetryImmediately: false,
      openIncident: false,
      resolveIncident: wasDown,
      triggerEmail: wasDown ? "UP" : null,
    };
  }

  // Hata durumu
  const nextFails = input.previousConsecutiveFails + 1;

  // Zaten DOWN ise: aynı durumda kalır, yeni mail veya incident üretmez
  if (input.previousStatus === "DOWN") {
    return {
      nextStatus: "DOWN",
      nextConsecutiveFails: nextFails,
      nextLastStatusChangeAt: input.previousLastStatusChangeAt,
      shouldRetryImmediately: false,
      openIncident: false,
      resolveIncident: false,
      triggerEmail: null,
    };
  }

  // Eşik değerine ulaşıldıysa DOWN durumuna geç
  if (nextFails >= threshold) {
    return {
      nextStatus: "DOWN",
      nextConsecutiveFails: nextFails,
      nextLastStatusChangeAt: input.now,
      shouldRetryImmediately: false,
      openIncident: true,
      incidentStartedAt: input.now,
      resolveIncident: false,
      triggerEmail: "DOWN",
    };
  }

  // Henüz eşiğe ulaşılmadı: mevcut durumu koru, ilk hatada 5 sn sonra retry yap
  return {
    nextStatus: input.previousStatus,
    nextConsecutiveFails: nextFails,
    nextLastStatusChangeAt: input.previousLastStatusChangeAt,
    shouldRetryImmediately: nextFails === 1,
    openIncident: false,
    resolveIncident: false,
    triggerEmail: null,
  };
}

/**
 * HTTPS siteler için TLS sertifikası bitiş tarihini kontrol eder.
 */
export async function checkSslCertificateExpiry(rawUrl: string): Promise<{
  expiresAt: Date | null;
  daysRemaining: number | null;
  error?: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { expiresAt: null, daysRemaining: null, error: "Geçersiz URL" };
  }

  if (parsed.protocol !== "https:") {
    return { expiresAt: null, daysRemaining: null };
  }

  const host = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 443;

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        timeout: 8000,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.end();
          if (!cert || !cert.valid_to) {
            resolve({ expiresAt: null, daysRemaining: null, error: "Sertifika bulunamadı" });
            return;
          }
          const expiresAt = new Date(cert.valid_to);
          const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000);
          resolve({ expiresAt, daysRemaining });
        } catch (err) {
          socket.destroy();
          resolve({
            expiresAt: null,
            daysRemaining: null,
            error: err instanceof Error ? err.message : "SSL okuma hatası",
          });
        }
      }
    );

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ expiresAt: null, daysRemaining: null, error: err.message });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ expiresAt: null, daysRemaining: null, error: "SSL bağlantı zaman aşımı" });
    });
  });
}
