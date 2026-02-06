"use server";

import { auth } from "@/lib/auth";
import { track, type AnalyticsEventName } from "@/lib/analytics/events";
import { createRequestId } from "@/lib/logger";

export async function trackEvent(params: {
  name: AnalyticsEventName;
  route?: string;
  source?: string;
  properties?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  return track({
    name: params.name,
    userId,
    requestId: createRequestId(),
    route: params.route,
    source: params.source,
    properties: params.properties,
  });
}
