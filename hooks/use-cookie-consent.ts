"use client";

import { useState, useEffect } from "react";
import { mayLoadAnalytics } from "@/lib/cookie-consent";

/**
 * Hook for gating analytics/tracking on consent.
 * Use when you add analytics (e.g. GA, Plausible): only load when mayLoadAnalytics() is true.
 */
export function useCookieConsent(): { analyticsAllowed: boolean } {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    setAnalyticsAllowed(mayLoadAnalytics());
  }, []);

  return { analyticsAllowed };
}
