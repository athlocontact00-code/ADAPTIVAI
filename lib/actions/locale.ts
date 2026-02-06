"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidLocale, type SupportedLocale } from "@/lib/i18n/config";

export async function updateUserLocale(locale: SupportedLocale): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    if (!isValidLocale(locale)) {
      return { success: false, error: "Invalid locale" };
    }
    await db.profile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, locale },
      update: { locale },
    });
    return { success: true };
  } catch (e) {
    console.error("[Locale] Update error:", e);
    return { success: false, error: "Failed to update locale" };
  }
}

export async function getUserLocale(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    select: { locale: true },
  });
  return profile?.locale ?? null;
}
