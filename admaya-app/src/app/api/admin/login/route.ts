import { startSession, verifyCredentials } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/http";
import { assertSameOrigin } from "@/lib/origin";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const parsed = loginSchema.safeParse(await readJson(req));
    if (!parsed.success) return json({ error: "Enter a valid email and password." }, 400);
    const { email, password } = parsed.data;

    // Per IP+email, and per email alone: the per-account cap still holds if the caller hides its IP.
    const keys = [`login:${clientIp(req)}:${email}`, `login-acct:${email}`];
    const limit = [rateLimit(keys[0], 8, 10 * 60_000), rateLimit(keys[1], 15, 10 * 60_000)].find((l) => !l.ok);
    if (limit) return json({ error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.` }, 429);

    const admin = await verifyCredentials(email, password);
    if (!admin) return json({ error: "Incorrect email or password." }, 401);
    keys.forEach(resetRateLimit); // a correct password clears the count: only failures add up toward a lockout
    await startSession(admin);
    return json({ ok: true });
  });
}
