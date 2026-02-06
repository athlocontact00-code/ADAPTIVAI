import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const digests = await db.weeklyDigest.findMany({
    where: { userId: session.user.id },
    orderBy: { weekStart: "desc" },
    take: 12,
  });

  return NextResponse.json({
    digests: digests.map((d) => ({
      id: d.id,
      weekStart: d.weekStart.toISOString(),
      weekEnd: d.weekEnd.toISOString(),
      subject: d.subject,
      text: d.text,
      data: d.data,
      status: d.status,
      sentAt: d.sentAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  });
}
