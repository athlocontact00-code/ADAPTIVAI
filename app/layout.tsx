import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/session-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";

export const viewport: Viewport = {
  themeColor: "#0B0B0F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.adaptivai.online";
const assetVersion = "6";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "AdaptivAI - Intelligent Training Platform",
  description: "Your AI-powered training companion for optimized performance",
  manifest: `/manifest.webmanifest?v=${assetVersion}`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AdaptivAI",
  },
  icons: {
    icon: [
      { url: `/favicon-16.png?v=${assetVersion}`, sizes: "16x16", type: "image/png" },
      { url: `/favicon-32.png?v=${assetVersion}`, sizes: "32x32", type: "image/png" },
      { url: `/favicon-48.png?v=${assetVersion}`, sizes: "48x48", type: "image/png" },
      { url: `/favicon.png?v=${assetVersion}`, sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: `/apple-touch-icon.png?v=${assetVersion}`, sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    title: "AdaptivAI - Intelligent Training Platform",
    description: "Your AI-powered training companion for optimized performance",
    siteName: "AdaptivAI",
    images: [
      { url: `/icons/icon-512.png?v=${assetVersion}`, width: 512, height: 512, alt: "AdaptivAI" },
      { url: `/logo.png?v=${assetVersion}`, width: 512, height: 512, alt: "AdaptivAI" },
    ],
  },
  twitter: {
    card: "summary",
    title: "AdaptivAI - Intelligent Training Platform",
    description: "Your AI-powered training companion for optimized performance",
    images: [`/icons/icon-512.png?v=${assetVersion}`],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={typeof locale === "string" ? locale : "en"} className="dark" suppressHydrationWarning>
      <body className="min-h-screen min-h-[100dvh] font-sans">
        <SessionProvider>
          <NextIntlClientProvider locale={locale} messages={messages ?? undefined}>
            <I18nProvider serverLocale={locale} serverMessages={messages ?? undefined}>
              {children}
              <Toaster position="top-right" richColors />
              <CookieConsentBanner />
            </I18nProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
