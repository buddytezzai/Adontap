import { requireAdminApi } from "@/lib/auth";
import { changeAdminPassword } from "@/lib/admin-ops";
import { handle, json, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdminApi(req);
    if (admin instanceof Response) return admin;
    if (!rateLimit(`pw:${admin.id}`, 5, 10 * 60_000).ok) return json({ error: "Too many attempts. Try again in a few minutes." }, 429);
    const { currentPassword, newPassword } = changePasswordSchema.parse(await readJson(req));
    await changeAdminPassword(admin.id, currentPassword, newPassword);
    return json({ ok: true });
  });
}
