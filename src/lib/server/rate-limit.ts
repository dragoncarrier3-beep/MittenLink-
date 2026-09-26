import "server-only";
import { headers } from "next/headers";

/**
 * Simple fixed-window rate limiter (per process). Adequate for a single
 * instance demo; for multi-instance production replace the store with a
 * shared one (e.g. Postgres table or Redis) behind the same interface.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "local";
}

export async function rateLimit(action: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const key = `${action}:${await clientKey()}`;
  const nowMs = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - nowMs) / 1000) };
  return { ok: true, retryAfterSeconds: 0 };
}

// Periodically drop expired buckets.
const g = globalThis as unknown as { __mlRateLimitSweep?: ReturnType<typeof setInterval> };
if (!g.__mlRateLimitSweep) {
  g.__mlRateLimitSweep = setInterval(() => {
    const nowMs = Date.now();
    for (const [k, v] of buckets) if (v.resetAt <= nowMs) buckets.delete(k);
  }, 60_000);
  g.__mlRateLimitSweep.unref?.();
}
