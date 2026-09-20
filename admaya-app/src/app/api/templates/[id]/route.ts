import { handle, json } from "@/lib/http";
import { getPublishedTemplate } from "@/lib/templates";

// Public: 404 for anything that is not published — a draft looks exactly like a template that doesn't exist.
export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const template = await getPublishedTemplate(id);
    if (!template) return json({ error: "Template not found" }, 404);
    return json({ template });
  });
}
