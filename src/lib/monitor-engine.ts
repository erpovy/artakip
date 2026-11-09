import http from "http";
import https from "https";
import tls from "tls";
import { MonitorType, Status } from "./prisma";
import { validateUrlStructure } from "./ssrf";

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
 * Node.js yerel http/https modülü ile IPv4 öncelikli, yönlendirme takipli ve
 * eksik ara SSL sertifikalarına (intermediate CA) toleranslı istek yapar.
 */
function requestWithNodeHttp(
  urlStr: string,
  timeoutMs: number,
  followRedirects: boolean,
  redirectsLeft = 5
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch (e) {
      reject(e);
      return;
    }

    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;
    const effectiveTimeoutMs = Math.min(Math.max(2000, timeoutMs), 8000);
    let settled = false;

    const finishResolve = (val: { status: number; body: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      resolve(val);
    };

    const finishReject = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      reject(err);
    };

    const req = transport.request(
      parsed,
      {
        method: "GET",
        family: 4,
        servername: parsed.hostname,
        timeout: effectiveTimeoutMs,
        rejectUnauthorized: false,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 TakipBot/1.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          Connection: "close",
        },
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        const location = res.headers.location;

        if (
          followRedirects &&
          redirectsLeft > 0 &&
          [301, 302, 303, 307, 308].includes(statusCode) &&
          location
        ) {
          res.resume();
          if (/suspendedpage\.cgi|\/cgi-sys\/suspended/i.test(location)) {
            finishResolve({
              status: 503,
              body: "Account Suspended (cgi-sys/suspendedpage.cgi)",
            });
            return;
          }
          try {
            const nextUrl = new URL(location, parsed).toString();
            requestWithNodeHttp(nextUrl, effectiveTimeoutMs, followRedirects, redirectsLeft - 1)
              .then(finishResolve)
              .catch(finishReject);
          } catch (e) {
            finishReject(e);
          }
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const maxBytes = 256 * 1024; // Maksimum 256KB oku

        res.on("data", (chunk: Buffer) => {
          if (totalBytes < maxBytes) {
            chunks.push(chunk);
            totalBytes += chunk.length;
          } else {
            res.destroy();
          }
        });

        const completeBody = () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          finishResolve({ status: statusCode, body });
        };

        res.on("end", completeBody);
        res.on("close", completeBody);
        res.on("error", finishReject);
      }
    );

    const hardTimer = setTimeout(() => {
      req.destroy(new Error("AbortError"));
      finishReject(new Error("AbortError"));
    }, effectiveTimeoutMs);

    req.on("timeout", () => {
      req.destroy(new Error("AbortError"));
      finishReject(new Error("AbortError"));
    });

    req.on("error", finishReject);
    req.end();
  });
}

/**
 * Tek bir HTTP/KEYWORD kontrolü gerçekleştirir.
 */
export async function performHttpProbe(
  input: HttpProbeInput,
  customFetch?: typeof fetch
): Promise<HttpProbeResult> {
  const targetUrl = buildTargetUrl(input.url, input.wpCheckPath);
  const ssrf = validateUrlStructure(targetUrl);
  if (!ssrf.valid) {
    return {
      isUp: false,
      httpCode: null,
      responseMs: 0,
      error: `SSRF Engeli: ${ssrf.reason}`,
    };
  }

  const timeoutMs = Math.max(2000, input.timeoutSeconds * 1000);
  const start = Date.now();

  try {
    let httpCode: number;
    let bodyText = "";

    if (customFetch) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await customFetch(targetUrl, {
          method: "GET",
          redirect: input.followRedirects ? "follow" : "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "TakipBot/1.0 (+https://artakip.artovy.com)",
          },
        });
        httpCode = res.status;
        if (input.type === "KEYWORD" && input.keyword) {
          bodyText = await res.text();
        }
      } finally {
        clearTimeout(timer);
      }
    } else {
      const res = await requestWithNodeHttp(
        targetUrl,
        timeoutMs,
        input.followRedirects
      );
      httpCode = res.status;
      bodyText = res.body;
    }

    const responseMs = Date.now() - start;

    // WHM / cPanel askıya alınmış hesap (Account Suspended) tespiti
    if (
      /cgi-sys\/suspendedpage\.cgi|<title>\s*Account Suspended\s*<\/title>|This Account has been suspended/i.test(
        bodyText
      )
    ) {
      return {
        isUp: false,
        httpCode: 503,
        responseMs,
        error: "WHM/cPanel Hesabı Askıya Alınmış (Account Suspended)",
      };
    }

    if (!isHttpStatusExpected(httpCode, input.expectedStatus)) {
      return {
        isUp: false,
        httpCode,
        responseMs,
        error: `Beklenmeyen HTTP kodu: ${httpCode} (beklenen: ${input.expectedStatus})`,
      };
    }

    if (input.type === "KEYWORD" && input.keyword && input.keyword.trim() !== "") {
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

    if (
      (err instanceof Error && err.name === "AbortError") ||
      message.includes("AbortError")
    ) {
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
 * - UNKNOWN -> DOWN: İlk kez kontrol edilen site yanıt vermiyorsa doğrudan DOWN gösterir ("Kontrol Bekleniyor"da takılı kalmaz).
 * - İlk hatada (previousStatus === "UP", consecutiveFails === 1 ve failuresBeforeDown > 1) 5 sn sonra hızlı retry önerir.
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

  // Eşik değerine ulaşıldıysa VEYA ilk kez kontrol edilen (UNKNOWN) bir site hata verdiyse DOWN durumuna geç
  if (nextFails >= threshold || input.previousStatus === "UNKNOWN") {
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

  // Henüz eşiğe ulaşılmadı (previousStatus === "UP"): mevcut durumu koru, ilk hatada 5 sn sonra retry yap
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
