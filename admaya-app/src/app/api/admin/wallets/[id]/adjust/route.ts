import { requireAdminApi } from "@/lib/auth";
import { adjustCredits } from "@/lib/admin-ops";
import { handle, json, readJson } from "@/lib/http";
import { adjustCreditsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    const { amount, reason } = adjustCreditsSchema.parse(await readJson(req));
    const creditBalance = await adjustCredits((await ctx.params).id, amount, reason, admin.email);
    return json({ ok: true, creditBalance });
  });
}
