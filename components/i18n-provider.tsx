"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/config";
import enMessages from "@/messages/en.json";

type Messages = Record<string, unknown>;

const LocaleContext = createContext<{
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => Promise<void>;
  isLoading: boolean;
}>({
  locale: "en",
  setLocale: async () => {},
  isLoading: true,
});

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within I18nProvider");
  return ctx;
}

async function loadMessages(locale: string): Promise<Messages> {
  try {
    const mod = await import(`@/messages/${locale}.json`);
    return mod.default ?? {};
  } catch {
    const en = await import("@/messages/en.json");
    return en.default ?? {};
  }
}

type I18nProviderProps = {
  children: React.ReactNode;
  /** Server-provided locale from next-intl (avoids ENVIRONMENT_FALLBACK) */
  serverLocale?: string;
  /** Server-provided messages from next-intl */
  serverMessages?: Record<string, unknown>;
};

export function I18nProvider({ children, serverLocale, serverMessages }: I18nProviderProps) {
  const initialLocale = (serverLocale ? normalizeLocale(serverLocale) : "en") as SupportedLocale;
  const initialMessages = (serverMessages && Object.keys(serverMessages).length > 0
    ? serverMessages
    : enMessages) as Messages;

  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);
  const [messages, setMessages] = useState<Messages>(initialMessages);
  const [isLoading, setIsLoading] = useState(!serverMessages);

  const initLocale = useCallback(async () => {
    try {
      const res = await fetch("/api/locale");
      const data = (await res.json()) as { locale?: string };
      const l = normalizeLocale(data.locale);
      setLocaleState(l);
      const msgs = await loadMessages(l);
      setMessages(msgs);
    } catch {
      const msgs = await loadMessages("en");
      setMessages(msgs);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initLocale();
  }, [initLocale]);

  const setLocale = useCallback(async (newLocale: SupportedLocale) => {
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      });
      const msgs = await loadMessages(newLocale);
      setMessages(msgs);
      setLocaleState(newLocale);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("NEXT_LOCALE", newLocale);
      }
    } catch {
      // keep current locale
    }
  }, []);

  const dir = "ltr";

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
    }
  }, [locale, dir]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, isLoading }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <div dir={dir} className="contents">
          {children}
        </div>
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
