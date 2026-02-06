import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidLocale, normalizeLocale, type SupportedLocale } from "@/lib/i18n/config";

const LOCALE_COOKIE = "NEXT_LOCALE";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let locale: string = req.cookies.get(LOCALE_COOKIE)?.value ?? "";

    if (session?.user?.id) {
      const profile = await db.profile.findUnique({
        where: { userId: session.user.id },
        select: { locale: true },
      });
      if (profile?.locale && isValidLocale(profile.locale)) {
        locale = profile.locale;
      }
    }

    const resolved = normalizeLocale(locale || undefined);
    return NextResponse.json({ locale: resolved });
  } catch {
    return NextResponse.json({ locale: "en" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = (body.locale as string) ?? "";
    const locale = normalizeLocale(raw) as SupportedLocale;

    const session = await auth();
    const res = NextResponse.json({ ok: true, locale });

    res.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    if (session?.user?.id) {
      await db.profile.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, locale },
        update: { locale },
      });
    }

    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid locale" }, { status: 400 });
  }
}
