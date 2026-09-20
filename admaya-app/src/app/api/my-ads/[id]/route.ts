import { getCustomerUser } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { handle, json, NO_STORE, UnauthorizedError } from "@/lib/http";
import { assertSameOrigin } from "@/lib/origin";
import { deleteStored } from "@/lib/storage";

export const dynamic = "force-dynamic";

export function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await getCustomerUser();
    if (!user) throw new UnauthorizedError("Unauthorized");

    const { id } = await ctx.params;
    const asset = await prisma.asset.findFirst({ where: { id, userId: user.id } });
    if (!asset) return Response.json({ error: "Asset not found" }, { status: 404, headers: NO_STORE });

    await deleteStored(asset.storageUrl);
    await prisma.asset.delete({ where: { id } });
    return json({ ok: true });
  });
}
