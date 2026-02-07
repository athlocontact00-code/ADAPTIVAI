export type CronAuthResult =
  | { ok: true }
  | { ok: false; reason: "MISSING" | "INVALID" };

export function verifyCronSecretFromRequest(req: Request): CronAuthResult {
  const configured = process.env.INTERNAL_CRON_SECRET;
  if (!configured || configured.length < 16) {
    return { ok: false, reason: "MISSING" };
  }

  const header = req.headers.get("x-internal-cron-secret");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  const provided = header ?? bearer;
  if (!provided) return { ok: false, reason: "INVALID" };

  return provided === configured ? { ok: true } : { ok: false, reason: "INVALID" };
}

export function isCronConfigured(): boolean {
  const configured = process.env.INTERNAL_CRON_SECRET;
  return !!configured && configured.length >= 16 && process.env.NODE_ENV !== "test";
}
