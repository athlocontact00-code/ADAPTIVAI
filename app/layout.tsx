import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/session-provider";
import { I18nProvider } from "@/components/i18n-provider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "AdaptivAI - Intelligent Training Platform",
  description: "Your AI-powered training companion for optimized performance",
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
      <body className={inter.className}>
        <SessionProvider>
          <NextIntlClientProvider locale={locale} messages={messages ?? undefined}>
            <I18nProvider serverLocale={locale} serverMessages={messages ?? undefined}>
              {children}
              <Toaster position="top-right" richColors />
            </I18nProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
