import dns from "dns/promises";
import net from "net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "169.254.169.254",
]);

/**
 * IPv4 adresinin özel/iç ağ (private, loopback, link-local, multicast vb.) olup olmadığını kontrol eder.
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;

  // 0.0.0.0/8 (Mevcut ağ)
  if (a === 0) return true;
  // 10.0.0.0/8 (Özel ağ)
  if (a === 10) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local / Cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Özel ağ: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 & 192.0.2.0/24
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  // 192.168.0.0/16 (Özel ağ)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Benchmark)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 (Multicast & Reserved >= 224)
  if (a >= 224) return true;

  return false;
}

/**
 * IPv6 adresinin özel/loopback olup olmadığını kontrol eder.
 */
export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  if (normalized === "::1" || normalized === "::" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice(7);
    if (net.isIPv4(v4)) {
      return isPrivateIPv4(v4);
    }
  }
  // Unique local (fc00::/7 -> fc.. veya fd..)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // Link-local (fe80::/10)
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

export interface SsrfValidationResult {
  valid: boolean;
  reason?: string;
  normalizedUrl?: string;
}

/**
 * Senkron URL + IP kontrolü (DNS çözümlemesi olmadan hızlı doğrulama).
 */
export function validateUrlStructure(rawUrl: string): SsrfValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: "Geçersiz URL formatı." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, reason: "Sadece http ve https protokolleri desteklenir." };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: "URL içinde kullanıcı adı veya şifre bulunamaz." };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) {
    return { valid: false, reason: "Geçersiz alan adı." };
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return { valid: false, reason: "Yerel veya iç ağ adresleri (localhost/internal) eklenemez." };
  }

  // Sayısal / oktal / hex IP gösterimlerini engelle (örn. http://2130706433 veya http://0x7f000001)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(hostname)) {
    return { valid: false, reason: "Tamsayı veya hex IP adresleri kullanılamaz." };
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { valid: false, reason: "Özel veya iç ağ IP adresleri (SSRF koruması) engellendi." };
    }
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}

/**
 * Tam SSRF doğrulaması: URL yapısını kontrol eder ve DNS çözümlemesi yaparak
 * alan adının iç ağ IP'sine işaret etmediğini doğrular.
 */
export async function validateSafeUrl(
  rawUrl: string,
  options: { skipDnsInTest?: boolean } = {}
): Promise<SsrfValidationResult> {
  const struct = validateUrlStructure(rawUrl);
  if (!struct.valid) return struct;

  const parsed = new URL(struct.normalizedUrl!);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (net.isIP(hostname)) {
    return struct;
  }

  if (options.skipDnsInTest) {
    return struct;
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { valid: false, reason: "Alan adı DNS ile çözümlenemedi." };
    }
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return {
          valid: false,
          reason: `Alan adı özel/iç ağ IP adresine (${record.address}) çözümleniyor (SSRF engellendi).`,
        };
      }
    }
  } catch {
    return { valid: false, reason: "Alan adı DNS kaydı doğrulanamadı." };
  }

  return struct;
}
