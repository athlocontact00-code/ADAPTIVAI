"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  Calendar,
  BookOpen,
  LayoutDashboard,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bot,
  TrendingUp,
  Target,
  FlaskConical,
  Sun,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationCenter } from "@/components/notification-center";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LegalFooter } from "@/components/legal-footer";

function AppShellFooterLabels() {
  const t = useTranslations("nav");
  return (
    <>
      <div className="text-xs text-muted-foreground mb-2">{t("adaptivaiPro")}</div>
      <div className="space-y-1 text-xs text-muted-foreground/60">
        <div>• {t("psychologyEngine")}</div>
        <div>• {t("seasonPlanning")}</div>
        <div>• {t("progressTracking")}</div>
        <div>• {t("autoReports")}</div>
      </div>
    </>
  );
}

function FinishSetupBanner() {
  const t = useTranslations("onboarding");
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between">
      <span className="text-sm text-amber-600 dark:text-amber-400">Finish setup to personalize your experience</span>
      <Link href="/onboarding">
        <Button variant="outline" size="sm" className="border-amber-500/30">{t("finishSetup")}</Button>
      </Link>
    </div>
  );
}

function AppShellSettingsLabel() {
  const t = useTranslations("nav");
  return <>{t("settings")}</>;
}

function AppShellSignOutLabel() {
  const t = useTranslations("nav");
  return <>{t("signOut")}</>;
}

function useNavSections() {
  const t = useTranslations("nav");
  return [
    {
      title: null as string | null,
      items: [
        { name: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
        { name: t("today"), href: "/today", icon: Sun },
      ],
    },
    {
      title: t("training"),
      items: [
        { name: t("calendar"), href: "/calendar", icon: Calendar },
        { name: t("season"), href: "/season", icon: Target },
        { name: t("diary"), href: "/diary", icon: BookOpen },
      ],
    },
    {
      title: t("insights"),
      items: [{ name: t("progress"), href: "/progress", icon: TrendingUp }],
    },
    {
      title: t("ai"),
      items: [
        { name: t("aiCoach"), href: "/coach", icon: Bot },
        { name: t("simulator"), href: "/simulator", icon: FlaskConical },
      ],
    },
    {
      title: t("settings"),
      items: [
        { name: t("gettingStarted"), href: "/getting-started", icon: HelpCircle },
        { name: t("settings"), href: "/settings", icon: Settings },
      ],
    },
  ];
}

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  planBadge?: string | null;
  showFinishSetupBanner?: boolean;
}

export function AppShell({ children, user, planBadge, showFinishSetupBanner }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigationSections = useNavSections();

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || "U";

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card/95 backdrop-blur-xl border-r border-border/50 transform transition-transform duration-300 ease-out lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ willChange: "transform" }}
      >
        <div className="flex h-16 items-center gap-2 px-6 border-b shrink-0 safe-area-top">
          <Logo size={28} />
          <span className="text-xl font-bold">AdaptivAI</span>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
            type="button"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-touch">
          {navigationSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className={section.title ? "mt-4 first:mt-0" : ""}>
              {section.title && (
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="shrink-0 p-4 border-t space-y-3 safe-area-inset-bottom">
          <AppShellFooterLabels />
          <LegalFooter compact />
        </div>
      </aside>

      {/* Main content: scrollable column */}
      <div className="lg:pl-64 flex flex-col min-h-[100dvh] w-full">
        {showFinishSetupBanner && <FinishSetupBanner />}
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-3 sm:gap-4 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6 safe-area-top shrink-0">
          <button
            className="lg:hidden flex items-center justify-center w-10 h-10 -ml-2 rounded-lg touch-manipulation"
            onClick={() => setSidebarOpen(true)}
            type="button"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="lg:hidden flex items-center gap-2 shrink-0" aria-label="AdaptivAI Home">
            <Logo size={24} className="h-6 w-6 shrink-0 object-contain" />
          </Link>
          <div className="flex-1 min-w-0" />

          {planBadge && (
            <Link
              href="/settings?tab=billing"
              className="text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20"
            >
              {planBadge}
            </Link>
          )}
          <LanguageSwitcher variant="compact" />
          <NotificationCenter />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  {user.image && <AvatarImage src={user.image} alt="" />}
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  {user.image && <AvatarImage src={user.image} alt="" />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <AppShellSettingsLabel />
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <AppShellSignOutLabel />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content: single primary scroll container; momentum scroll on iOS; safe area bottom for iOS browser bar */}
        <main className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto ux-scroll-main scroll-touch main-content-wrap p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
