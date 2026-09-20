import { getCustomerUser } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { handle, json, UnauthorizedError } from "@/lib/http";
import type { AssetDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// Only these metadata fields are customer-facing. Everything else stored on the row (provider request
// ids, internal diagnostics) stays server-side.
const PUBLIC_METADATA = ["generationId", "engine", "durationSeconds", "pricePaid", "originalName", "size", "mimeType"] as const;

export function GET() {
  return handle(async () => {
    const user = await getCustomerUser();
    if (!user) throw new UnauthorizedError("Unauthorized");

    const assets = await prisma.asset.findMany({
      where: { userId: user.id },
      include: { template: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });

    const assetsDto: AssetDTO[] = assets.map((a) => {
      const meta = (a.metadata && typeof a.metadata === "object" ? a.metadata : {}) as Record<string, unknown>;
      return {
        id: a.id,
        type: a.type as "upload" | "generated",
        storageUrl: a.storageUrl,
        templateTitle: a.template?.title || "Custom AI Video Ad",
        expiresAt: a.expiresAt.toISOString(),
        expired: a.expired || a.expiresAt.getTime() <= Date.now(),
        createdAt: a.createdAt.toISOString(),
        metadata: Object.fromEntries(PUBLIC_METADATA.filter((k) => k in meta).map((k) => [k, meta[k]])),
      };
    });
    return json({ assets: assetsDto });
  });
}
