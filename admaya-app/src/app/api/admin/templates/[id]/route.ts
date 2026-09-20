import { requireAdminApi } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/http";
import { deleteTemplate, getTemplateAdmin, setTemplateStatus, updateTemplate } from "@/lib/templates";
import { statusSchema, templateInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    return json({ template: await getTemplateAdmin((await ctx.params).id) });
  });
}

// Full save from the editor drawer.
export function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    const input = templateInputSchema.parse(await readJson(req));
    return json({ template: await updateTemplate((await ctx.params).id, input) });
  });
}

// Quick status change (the pill in the table, and Archive / Restore).
export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    const { status } = statusSchema.parse(await readJson(req));
    return json({ template: await setTemplateStatus((await ctx.params).id, status) });
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    await deleteTemplate((await ctx.params).id);
    return json({ ok: true });
  });
}
