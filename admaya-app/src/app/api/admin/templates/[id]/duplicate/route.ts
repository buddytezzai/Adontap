import { requireAdminApi } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { duplicateTemplate } from "@/lib/templates";

export const dynamic = "force-dynamic";

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    return json({ template: await duplicateTemplate((await ctx.params).id) }, 201);
  });
}
