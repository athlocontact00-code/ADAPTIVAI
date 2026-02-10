import { NextRequest, NextResponse } from "next/server";

/**
 * Serves platform-specific PWA manifest:
 * - iOS (Safari, WebView): manifest-ios.webmanifest (portrait, apple-touch emphasis)
 * - Android: manifest-android.webmanifest (maskable icons)
 * - Desktop / other: manifest-desktop.webmanifest
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  if (url.pathname !== "/manifest.webmanifest") {
    return NextResponse.next();
  }

  const ua = request.headers.get("user-agent") ?? "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android|webOS|Fennec/.test(ua);

  const manifestPath = isIOS
    ? "/manifest-ios.webmanifest"
    : isAndroid
      ? "/manifest-android.webmanifest"
      : "/manifest-desktop.webmanifest";

  return NextResponse.rewrite(new URL(manifestPath, request.url));
}

export const config = {
  matcher: "/manifest.webmanifest",
};
