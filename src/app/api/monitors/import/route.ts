import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateSafeUrl } from "@/lib/ssrf";
import { checkPlanSiteLimit, DEFAULT_PLANS } from "@/lib/plans";
import { scheduleMonitorRepeatableJob } from "@/lib/queue";

interface CsvRowReport {
  line: number;
  name: string;
  url: string;
  valid: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const csvText = String(body.csv || "").trim();
    const dryRun = Boolean(body.dryRun);
    const defaultTag = body.tag ? String(body.tag).trim() : "";

    if (!csvText) {
      return NextResponse.json({ error: "CSV içeriği boş olamaz." }, { status: 400 });
    }

    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const report: CsvRowReport[] = [];
    const validEntries: Array<{ name: string; url: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Başlık satırını atla (ad,url veya name,url)
      if (i === 0 && /^("?ad"?|"?name"?)\s*[,;]\s*("?url"?)/i.test(line)) {
        continue;
      }

      const sep = line.includes(";") ? ";" : ",";
      const parts = line.split(sep).map((p) => p.replace(/^"|"$/g, "").trim());

      let name = "";
      let rawUrl = "";

      if (parts.length === 1) {
        rawUrl = parts[0];
        try {
          name = new URL(rawUrl).hostname;
        } catch {
          name = rawUrl;
        }
      } else {
        name = parts[0];
        rawUrl = parts[1];
      }

      if (!name || !rawUrl) {
        report.push({
          line: i + 1,
          name: name || "-",
          url: rawUrl || "-",
          valid: false,
          error: "Eksik site adı veya URL.",
        });
        continue;
      }

      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = `https://${rawUrl}`;
      }

      const ssrf = await validateSafeUrl(rawUrl, { skipDnsInTest: true });
      if (!ssrf.valid) {
        report.push({
          line: i + 1,
          name,
          url: rawUrl,
          valid: false,
          error: ssrf.reason,
        });
        continue;
      }

      report.push({
        line: i + 1,
        name,
        url: ssrf.normalizedUrl!,
        valid: true,
      });
      validEntries.push({ name, url: ssrf.normalizedUrl! });
    }

    const currentCount = await prisma.monitor.count({ where: { userId: user.id } });
    const limitResult = checkPlanSiteLimit(
      currentCount,
      user.planSiteLimit,
      validEntries.length
    );

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        validCount: validEntries.length,
        invalidCount: report.filter((r) => !r.valid).length,
        limitAllowed: limitResult.allowed,
        limitReason: limitResult.reason,
        remainingSlots: Math.max(0, user.planSiteLimit - currentCount),
        report,
      });
    }

    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: limitResult.reason,
          report,
        },
        { status: 403 }
      );
    }

    const planCfg = await prisma.planConfig.findUnique({ where: { plan: user.plan } });
    const defaultInterval =
      planCfg?.minIntervalSeconds ??
      DEFAULT_PLANS[user.plan]?.minIntervalSeconds ??
      300;

    const createdMonitors = [];
    for (const entry of validEntries) {
      const m = await prisma.monitor.create({
        data: {
          userId: user.id,
          name: entry.name,
          url: entry.url,
          intervalSeconds: Math.max(300, defaultInterval),
          timeoutSeconds: 15,
          tags: defaultTag ? [defaultTag] : ["wordpress"],
        },
      });
      await scheduleMonitorRepeatableJob(m.id, m.intervalSeconds);
      createdMonitors.push(m);
    }

    return NextResponse.json(
      {
        message: `${createdMonitors.length} site başarıyla içe aktarıldı ve izlemeye alındı.`,
        importedCount: createdMonitors.length,
        report,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("CSV import error:", err);
    return NextResponse.json({ error: "CSV içe aktarma sırasında hata oluştu." }, { status: 500 });
  }
}
