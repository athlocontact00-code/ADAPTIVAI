"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ALLOWED_WHEN_FREE = ["/trial-ended", "/settings"];

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_WHEN_FREE.some((allowed) => pathname === allowed || pathname.startsWith(allowed + "/"));
}

interface TrialGateProps {
  plan: "FREE" | "TRIAL" | "PRO";
  children: React.ReactNode;
}

/**
 * When plan is FREE (trial ended, no Pro), redirect to /trial-ended unless the user is already on an allowed path (trial-ended or settings to upgrade).
 */
export function TrialGate({ plan, children }: TrialGateProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (plan !== "FREE") return;
    if (isAllowedPath(pathname ?? "")) return;
    router.replace("/trial-ended");
  }, [plan, pathname, router]);

  if (plan === "FREE" && pathname != null && !isAllowedPath(pathname)) {
    return null;
  }

  return <>{children}</>;
}
