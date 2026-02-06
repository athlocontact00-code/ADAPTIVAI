import { db } from "@/lib/db";
import { logError } from "@/lib/logger";

type AnalyticsEventCreateArgs = {
  data: {
    userId: string | null;
    name: string;
    requestId: string | null;
    route: string | null;
    source: string | null;
    propertiesJson: string | null;
  };
};

type AnalyticsDbClient = {
  analyticsEvent: {
    create: (args: AnalyticsEventCreateArgs) => Promise<unknown>;
  };
};

export type AnalyticsEventName =
  | "checkin_opened"
  | "checkin_submitted"
  | "checkin_accepted"
  | "checkin_overridden"
  | "checkin_skipped"
  | "premium_checkin_saved"
  | "conflict_suggestion_proposal"
  | "conflict_suggestion_applied"
  | "conflict_suggestion_dismissed"
  | "workout_start_blocked"
  | "workout_started"
  | "feedback_submitted"
  | "plan_proposal_shown"
  | "plan_proposal_accepted"
  | "plan_proposal_declined"
  | "simulator_run_started"
  | "simulator_run_succeeded"
  | "simulator_run_failed";

export type TrackInput = {
  name: AnalyticsEventName;
  userId?: string | null;
  requestId?: string;
  route?: string;
  source?: string;
  properties?: Record<string, unknown>;
};

function sanitizeProperties(props?: Record<string, unknown>): Record<string, unknown> {
  if (!props) return {};

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    // Hard guardrails: do not store free-text fields (diary/feedback/etc)
    if (/^(notes|note|comment|text|content|reason)$/i.test(k)) continue;

    if (typeof v === "string") {
      // Avoid storing long strings which might contain PII
      out[k] = v.length > 120 ? `${v.slice(0, 117)}...` : v;
      continue;
    }

    if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
      continue;
    }

    // For objects/arrays: store shallowly as JSON-safe structure
    try {
      JSON.stringify(v);
      out[k] = v;
    } catch {
      out[k] = "non_serializable";
    }
  }

  return out;
}

export async function track(input: TrackInput): Promise<{ success: boolean; error?: string }> {
  try {
    const properties = sanitizeProperties(input.properties);

    const analyticsDb = db as unknown as AnalyticsDbClient;
    await analyticsDb.analyticsEvent.create({
      data: {
        userId: input.userId ?? null,
        name: input.name,
        requestId: input.requestId ?? null,
        route: input.route ?? null,
        source: input.source ?? null,
        propertiesJson: JSON.stringify(properties),
      },
    });

    return { success: true };
  } catch (err) {
    logError("analytics.track_failed", {
      name: input.name,
      userId: input.userId ?? null,
      requestId: input.requestId ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "Failed to record event" };
  }
}
