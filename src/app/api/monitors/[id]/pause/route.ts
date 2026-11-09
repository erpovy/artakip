import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeMonitorRepeatableJob } from "@/lib/queue";

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

  const updated = await prisma.monitor.update({
    where: { id: monitor.id },
    data: { paused: true },
  });

  await removeMonitorRepeatableJob(monitor.id);

  return NextResponse.json({ monitor: updated, message: "İzleme duraklatıldı." });
}
