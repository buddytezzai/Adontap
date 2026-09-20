import { getCustomerUser } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { contentTypeFor, isValidUploadName, readUpload, UPLOAD_URL_PREFIX } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Serves a customer's own upload. 404 (never 403) for everything else, so file names can't be probed.
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isValidUploadName(name)) return notFound();

  const user = await getCustomerUser();
  if (!user) return notFound();
  const asset = await prisma.asset.findFirst({
    where: { userId: user.id, storageUrl: UPLOAD_URL_PREFIX + name, expired: false },
    select: { id: true },
  });
  if (!asset) return notFound();

  const bytes = await readUpload(name);
  const type = contentTypeFor(name);
  if (!bytes || !type) return notFound();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type, // fixed by our own allow-list, from the server-generated extension
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
