import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DigestClient } from "./digest-client";

export default async function DigestPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const digests = await db.weeklyDigest.findMany({
    where: { userId: session.user.id },
    orderBy: { weekStart: "desc" },
    take: 24,
  });

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      <h1 className="text-xl font-semibold mb-2">Weekly digest</h1>
      <p className="text-sm text-muted-foreground mb-6">
        AI-powered weekly summaries of your training.
      </p>
      <DigestClient digests={digests.map((d) => ({
        id: d.id,
        weekStart: d.weekStart.toISOString(),
        weekEnd: d.weekEnd.toISOString(),
        subject: d.subject,
        text: d.text,
        data: d.data,
        status: d.status,
        sentAt: d.sentAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
      }))} />
    </div>
  );
}
