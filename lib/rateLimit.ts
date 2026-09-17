type Bucket = { count: number; resetAt: number };

const globalBuckets = globalThis as typeof globalThis & { __jarvisRateLimits?: Map<string, Bucket> };
const buckets = globalBuckets.__jarvisRateLimits ?? new Map<string, Bucket>();
globalBuckets.__jarvisRateLimits = buckets;

export function requestIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${identity}`;
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 2_000) {
    for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
  }

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}

export function rateLimitResponse(result: ReturnType<typeof checkRateLimit>) {
  return new Response(JSON.stringify({ error: `Temporary usage limit reached. Try again in ${result.retryAfterSeconds} seconds.` }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfterSeconds),
      "X-RateLimit-Remaining": "0",
      "Cache-Control": "no-store",
    },
  });
}
