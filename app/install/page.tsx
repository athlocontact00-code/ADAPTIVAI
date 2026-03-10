"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, Monitor, Apple, Download } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPage() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installable, setInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream);
    setIsStandalone(
      window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallable(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-foreground focus:shadow-card"
      >
        Skip to content
      </a>
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="text-xl font-bold">AdaptivAI</span>
          </Link>
          <nav className="flex items-center gap-4">
            <LanguageSwitcher variant="compact" />
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="container py-12 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Logo size={32} />
          <h1 className="text-2xl font-bold tracking-tight">Install AdaptivAI</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Add AdaptivAI to your home screen or install it as an app for quick access.
        </p>

        {isStandalone && (
          <div className="mb-8 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20" role="status" aria-live="polite">
            <p className="text-sm font-medium mb-1">AdaptivAI is already installed.</p>
            <p className="text-sm text-muted-foreground">
              Open it from your home screen or app launcher for the full app-like experience.
            </p>
          </div>
        )}

        {installable && !isIOS && (
          <div className="mb-8 p-4 rounded-lg bg-primary/10 border border-primary/20" role="status" aria-live="polite">
            <p className="text-sm font-medium mb-3">Your browser supports installing the app.</p>
            <Button onClick={handleInstall} className="gap-2">
              <Download className="h-4 w-4" />
              Install app
            </Button>
          </div>
        )}

        {isIOS && (
          <div className="mb-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20" role="note">
            <p className="text-sm font-medium">
              Use <strong>Safari</strong> → tap the Share button (square with arrow) → &quot;Add to Home Screen&quot;.
            </p>
          </div>
        )}

        <div className="space-y-6">
          <section>
            <h2 className="flex items-center gap-2 font-semibold mb-3">
              <Apple className="h-5 w-5" />
              iPhone / iPad (Safari)
            </h2>
            <ol className="list-decimal list-inside text-muted-foreground text-sm space-y-2">
              <li>Open this page in <strong>Safari</strong> (not Chrome or other browsers).</li>
              <li>Tap the <strong>Share</strong> icon (square with arrow up) at the bottom or top.</li>
              <li>Scroll and tap <strong>&quot;Add to Home Screen&quot;</strong>.</li>
              <li>Name the app and tap <strong>Add</strong>.</li>
            </ol>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-semibold mb-3">
              <Smartphone className="h-5 w-5" />
              Android (Chrome)
            </h2>
            <ol className="list-decimal list-inside text-muted-foreground text-sm space-y-2">
              <li>Open this site in <strong>Chrome</strong>.</li>
              <li>Tap the <strong>menu</strong> (three dots) → <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
              <li>Or accept the install banner when it appears.</li>
            </ol>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-semibold mb-3">
              <Monitor className="h-5 w-5" />
              Laptop / Desktop (Chrome or Edge)
            </h2>
            <ol className="list-decimal list-inside text-muted-foreground text-sm space-y-2">
              <li>Open this site in <strong>Chrome</strong> or <strong>Edge</strong>.</li>
              <li>Look for the <strong>Install</strong> icon in the address bar (plus or computer icon), or use menu → <strong>Install AdaptivAI</strong> / <strong>Apps</strong> → <strong>Install this site as an app</strong>.</li>
              <li>Confirm to add the app to your applications.</li>
            </ol>
          </section>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          After installing, open AdaptivAI from your home screen or app list. You’ll stay logged in and get a faster, app-like experience.
        </p>

        <div className="mt-8 flex gap-4">
          <Link href="/">
            <Button variant="outline">Back to home</Button>
          </Link>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
