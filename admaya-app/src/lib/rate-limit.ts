// Tiny in-memory fixed-window limiter. Good enough to blunt password guessing and request spam
// on a single MVP process; swap for Redis/Upstash when this runs on more than one instance.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  b.count += 1;
  return { ok: b.count <= max, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

/** Forget a key's count. Used after a successful login so only FAILED attempts add up toward a lockout. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * The caller's IP, for rate limiting only.
 *
 * X-Forwarded-For is client-controlled unless a proxy in front of us overwrites it, so it is only
 * believed when TRUST_PROXY=true (set that behind Vercel/nginx/Cloudflare, which set the header).
 * Otherwise every caller shares the bucket "unknown" — a coarse global cap, which is safe (it cannot be
 * dodged by inventing headers) but shared.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const real = req.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return "unknown";
}
