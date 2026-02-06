type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as {
  __rlBuckets?: Map<string, Bucket>;
};

const buckets = globalForRateLimit.__rlBuckets ?? new Map<string, Bucket>();
if (!globalForRateLimit.__rlBuckets) globalForRateLimit.__rlBuckets = buckets;

export function rateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(params.key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + params.windowMs;
    buckets.set(params.key, { count: 1, resetAt });
    return { allowed: true, remaining: params.limit - 1, resetAt };
  }

  if (existing.count >= params.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  buckets.set(params.key, existing);
  return { allowed: true, remaining: params.limit - existing.count, resetAt: existing.resetAt };
}

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  return "unknown";
}
