import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const contact = await prisma.alertContact.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!contact) {
    return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
  }

  await prisma.alertContact.delete({ where: { id: contact.id } });
  return NextResponse.json({ message: "Bildirim e-postası silindi." });
}
