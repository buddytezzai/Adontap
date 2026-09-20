import { requireAdminApi } from "@/lib/auth";
import { BadRequestError, handle, json, readJson } from "@/lib/http";
import { setScoutedAdApproval } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    const body = (await readJson(req)) as { approvedForPublic?: unknown } | null;
    if (typeof body?.approvedForPublic !== "boolean") throw new BadRequestError("approvedForPublic must be true or false");
    return json({ ok: true, ad: await setScoutedAdApproval((await ctx.params).id, body.approvedForPublic) });
  });
}
