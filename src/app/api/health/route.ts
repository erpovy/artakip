import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQueueHealth } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "unreachable";
  }

  const queueHealth = await getQueueHealth();

  return NextResponse.json({
    status: dbStatus === "ok" ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    queue: queueHealth,
  });
}
