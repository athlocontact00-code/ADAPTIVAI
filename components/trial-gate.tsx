"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isProPath, FREE_ALLOWED_PATHS } from "@/lib/tiers";

function isAllowedPath(pathname: string): boolean {
  return FREE_ALLOWED_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith(allowed + "/"),
  );
}

interface TrialGateProps {
  plan: "FREE" | "TRIAL" | "PRO";
  children: React.ReactNode;
}

/**
 * Freemium gate: Free users can access basic features (dashboard, calendar,
 * diary, today, settings, getting-started). Pro-only paths redirect to the
 * paywall page (/trial-ended). TRIAL and PRO users get full access.
 */
export function TrialGate({ plan, children }: TrialGateProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (plan !== "FREE") return;
    if (!pathname) return;
    if (isAllowedPath(pathname)) return;
    // Pro-only path — redirect to trial-ended
    if (isProPath(pathname)) {
      router.replace("/trial-ended");
    }
  }, [plan, pathname, router]);

  // Block render only for pro-only paths while redirecting
  if (plan === "FREE" && pathname != null && !isAllowedPath(pathname) && isProPath(pathname)) {
    return null;
  }

  return <>{children}</>;
}
