import { endSession } from "@/lib/auth";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST() {
  return handle(async () => {
    await endSession();
    return json({ ok: true });
  });
}
