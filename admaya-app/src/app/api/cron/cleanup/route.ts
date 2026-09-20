import { timingSafeEqual } from "node:crypto";
import { cleanupExpiredAssets } from "@/lib/cleanup";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Enforces the 24-hour retention: deletes expired files and marks their rows expired.
// Call it on a schedule (Vercel Cron, crontab, GitHub Actions):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron/cleanup
function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function run(req: Request) {
  if (!process.env.CRON_SECRET) return json({ error: "CRON_SECRET is not configured" }, 503);
  if (!authorised(req)) return json({ error: "Unauthorized" }, 401);
  return json({ ok: true, ...(await cleanupExpiredAssets()) });
}

export const GET = (req: Request) => handle(() => run(req));
export const POST = (req: Request) => handle(() => run(req));
