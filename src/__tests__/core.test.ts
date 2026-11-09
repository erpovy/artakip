import { describe, it, expect } from "vitest";
import { validateUrlStructure, isPrivateIp } from "../lib/ssrf";
import { checkPlanSiteLimit, validateIntervalForPlan } from "../lib/plans";
import {
  evaluateMonitorStateTransition,
  isHttpStatusExpected,
  buildTargetUrl,
} from "../lib/monitor-engine";
import {
  evaluateNotificationPolicy,
  isWithinQuietHours,
  shouldBatchAsAlarmStorm,
  buildDownEmailTemplate,
  buildUpEmailTemplate,
} from "../lib/email";

describe("1. SSRF Koruması Testleri", () => {
  it("geçerli genel http/https URL'lerine izin vermeli", () => {
    expect(validateUrlStructure("https://example.com").valid).toBe(true);
    expect(validateUrlStructure("http://wordpress.org/wp-json/").valid).toBe(true);
    expect(validateUrlStructure("https://8.8.8.8/health").valid).toBe(true);
  });

  it("localhost ve iç ağ IP adreslerini engellemeli", () => {
    expect(validateUrlStructure("http://localhost:3000").valid).toBe(false);
    expect(validateUrlStructure("http://127.0.0.1/admin").valid).toBe(false);
    expect(validateUrlStructure("http://127.0.0.53").valid).toBe(false);
    expect(validateUrlStructure("http://10.0.0.1").valid).toBe(false);
    expect(validateUrlStructure("http://172.16.0.1").valid).toBe(false);
    expect(validateUrlStructure("http://172.31.255.255").valid).toBe(false);
    expect(validateUrlStructure("http://192.168.1.1").valid).toBe(false);
    expect(validateUrlStructure("http://169.254.169.254/latest/meta-data").valid).toBe(false);
    expect(validateUrlStructure("http://[::1]:8080").valid).toBe(false);
  });

  it("http/https dışındaki protokolleri ve gömülü kimlik bilgilerini engellemeli", () => {
    expect(validateUrlStructure("ftp://example.com").valid).toBe(false);
    expect(validateUrlStructure("file:///etc/passwd").valid).toBe(false);
    expect(validateUrlStructure("javascript:alert(1)").valid).toBe(false);
    expect(validateUrlStructure("https://user:pass@example.com").valid).toBe(false);
  });

  it("isPrivateIp yardımcı fonksiyonu özel ve genel IP'leri doğru ayırt etmeli", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.25.0.4")).toBe(true);
    expect(isPrivateIp("172.20.0.1")).toBe(true);
    expect(isPrivateIp("192.168.0.10")).toBe(true);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });
});

describe("2. Plan Limiti ve Kontrol Aralığı Denetimi Testleri", () => {
  it("plan site limitini aşmayan eklemelere izin vermeli", () => {
    const res = checkPlanSiteLimit(3, 5, 2);
    expect(res.allowed).toBe(true);
    expect(res.remainingSlots).toBe(0);
  });

  it("plan site limitini aşan tekli veya CSV toplu eklemeleri reddetmeli", () => {
    const res = checkPlanSiteLimit(4, 5, 2);
    expect(res.allowed).toBe(false);
    expect(res.remainingSlots).toBe(1);
    expect(res.reason).toContain("Plan limitiniz");
  });

  it("plan bazlı minimum kontrol aralığını zorunlu tutmalı", () => {
    expect(validateIntervalForPlan("FREE", 60).valid).toBe(false);
    expect(validateIntervalForPlan("FREE", 600).valid).toBe(true);
    expect(validateIntervalForPlan("PRO", 60).valid).toBe(true);
  });
});

describe("3. İzleme Motoru ve Durum Geçişi (State Transition) Testleri", () => {
  const now = new Date("2026-11-09T10:00:00Z");

  it("ilk hatada (failuresBeforeDown = 2 iken) DOWN'a geçmemeli ve 5sn retry istemeli", () => {
    const res = evaluateMonitorStateTransition({
      previousStatus: "UP",
      previousConsecutiveFails: 0,
      previousLastStatusChangeAt: null,
      probeSuccess: false,
      probeError: "Zaman aşımı",
      failuresBeforeDown: 2,
      now,
    });
    expect(res.nextStatus).toBe("UP");
    expect(res.nextConsecutiveFails).toBe(1);
    expect(res.shouldRetryImmediately).toBe(true);
    expect(res.openIncident).toBe(false);
    expect(res.triggerEmail).toBeNull();
  });

  it("ardışık hata sayısı failuresBeforeDown değerine ulaştığında DOWN'a geçmeli, Incident açmalı ve DOWN maili tetiklemeli", () => {
    const res = evaluateMonitorStateTransition({
      previousStatus: "UP",
      previousConsecutiveFails: 1,
      previousLastStatusChangeAt: null,
      probeSuccess: false,
      probeError: "HTTP 500",
      failuresBeforeDown: 2,
      now,
    });
    expect(res.nextStatus).toBe("DOWN");
    expect(res.nextConsecutiveFails).toBe(2);
    expect(res.openIncident).toBe(true);
    expect(res.triggerEmail).toBe("DOWN");
  });

  it("zaten DOWN olan site hata vermeye devam ettiğinde tekrar mail atmamalı (spam önleme)", () => {
    const res = evaluateMonitorStateTransition({
      previousStatus: "DOWN",
      previousConsecutiveFails: 3,
      previousLastStatusChangeAt: now,
      probeSuccess: false,
      probeError: "HTTP 502",
      failuresBeforeDown: 2,
      now,
    });
    expect(res.nextStatus).toBe("DOWN");
    expect(res.nextConsecutiveFails).toBe(4);
    expect(res.openIncident).toBe(false);
    expect(res.triggerEmail).toBeNull();
  });

  it("DOWN durumundaki site yanıt verdiğinde UP durumuna geçmeli, Incident'ı kapatmalı ve UP maili tetiklemeli", () => {
    const res = evaluateMonitorStateTransition({
      previousStatus: "DOWN",
      previousConsecutiveFails: 2,
      previousLastStatusChangeAt: now,
      probeSuccess: true,
      probeError: null,
      failuresBeforeDown: 2,
      now,
    });
    expect(res.nextStatus).toBe("UP");
    expect(res.nextConsecutiveFails).toBe(0);
    expect(res.resolveIncident).toBe(true);
    expect(res.triggerEmail).toBe("UP");
  });

  it("HTTP durum kodu aralıklarını ve WordPress kontrol yolunu doğru işlemeli", () => {
    expect(isHttpStatusExpected(200, "200-399")).toBe(true);
    expect(isHttpStatusExpected(301, "200-399")).toBe(true);
    expect(isHttpStatusExpected(500, "200-399")).toBe(false);
    expect(buildTargetUrl("https://ornek.com/", "/wp-json/")).toBe("https://ornek.com/wp-json/");
  });
});

describe("4. E-posta Tetikleme, Sessiz Saatler ve Alarm Fırtınası Testleri", () => {
  it("doğrulanmamış e-posta adresine bildirim göndermemeli", () => {
    const decision = evaluateNotificationPolicy({
      eventType: "DOWN",
      userEmailVerified: null,
      notifyOnDown: true,
      notifyOnUp: true,
      notifyOnSslExpiry: true,
    });
    expect(decision.shouldSendNow).toBe(false);
  });

  it("sessiz saatler (23:00 - 07:00) içindeyken bildirimi ertelemeli", () => {
    // UTC 21:30 -> Europe/Istanbul (UTC+3) için 00:30 (gece yarısı sonrası)
    const midnightIstanbul = new Date("2026-11-09T21:30:00Z");
    expect(isWithinQuietHours(midnightIstanbul, "23:00", "07:00", "Europe/Istanbul")).toBe(true);

    const decision = evaluateNotificationPolicy({
      eventType: "DOWN",
      userEmailVerified: new Date(),
      notifyOnDown: true,
      notifyOnUp: true,
      notifyOnSslExpiry: true,
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      timezone: "Europe/Istanbul",
      now: midnightIstanbul,
    });
    expect(decision.shouldSendNow).toBe(false);
    expect(decision.deferForQuietHours).toBe(true);
  });

  it("aynı anda 20+ site kapandığında alarm fırtınası korumasını devreye sokmalı", () => {
    expect(shouldBatchAsAlarmStorm(19)).toBe(false);
    expect(shouldBatchAsAlarmStorm(20)).toBe(true);
    expect(shouldBatchAsAlarmStorm(45)).toBe(true);
  });

  it("Türkçe Kapandı ve Açıldı e-posta şablonlarında gerekli bilgileri ve abonelikten çık linkini içermeli", () => {
    const downTpl = buildDownEmailTemplate({
      monitorId: "mon_1",
      monitorName: "Kurumsal WP Site",
      url: "https://kurumsal.com",
      startedAt: new Date("2026-11-09T10:00:00Z"),
      reason: "HTTP 503",
    });
    expect(downTpl.subject).toContain("KAPANDI");
    expect(downTpl.html).toContain("Kurumsal WP Site");
    expect(downTpl.html).toContain("abonelikten çık");

    const upTpl = buildUpEmailTemplate({
      monitorId: "mon_1",
      monitorName: "Kurumsal WP Site",
      url: "https://kurumsal.com",
      resolvedAt: new Date("2026-11-09T10:15:00Z"),
      durationMs: 15 * 60 * 1000,
    });
    expect(upTpl.subject).toContain("AÇILDI");
    expect(upTpl.subject).toContain("15 dk");
  });
});
