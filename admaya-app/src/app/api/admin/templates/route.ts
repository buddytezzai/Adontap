import { requireAdminApi } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/http";
import { createTemplate, listTemplatesAdmin } from "@/lib/templates";
import { templateInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    return json({ templates: await listTemplatesAdmin() });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    const input = templateInputSchema.parse(await readJson(req));
    return json({ template: await createTemplate(input) }, 201);
  });
}
