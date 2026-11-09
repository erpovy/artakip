import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeMonitorCheck } from "@/worker/index";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Site bulunamadı." }, { status: 404 });
  }

  await executeMonitorCheck(monitor.id);
  const refreshed = await prisma.monitor.findUnique({ where: { id: monitor.id } });

  return NextResponse.json({
    monitor: refreshed,
    message: "Anlık kontrol tamamlandı.",
  });
}
