import { randomUUID } from "node:crypto";
import { getCustomerUser } from "@/lib/customer-auth";
import { prisma } from "@/lib/db";
import { BadRequestError, handle, json, TooManyRequestsError, UnauthorizedError } from "@/lib/http";
import { assertSameOrigin } from "@/lib/origin";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, saveUpload, sniffImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await getCustomerUser();
    if (!user) throw new UnauthorizedError("Please sign in to upload files");
    if (!rateLimit(`upload:${user.id}`, 20, 60 * 60_000).ok) throw new TooManyRequestsError("Upload limit reached. Try again later.");

    // Reject oversize bodies before buffering them.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new BadRequestError("File size exceeds 8MB limit");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new BadRequestError("Expected a multipart form upload");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new BadRequestError("No file provided");
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestError("File size exceeds 8MB limit");

    const buffer = Buffer.from(await file.arrayBuffer());
    // The type is decided from the file's own bytes. The client's declared MIME type and file extension
    // are never trusted, and the stored name is generated here — so an ".html" can't be smuggled in.
    const ext = sniffImage(buffer);
    if (!ext) throw new BadRequestError("Only JPEG, PNG, and WebP images are supported");

    const { storageUrl } = await saveUpload(buffer, ext);
    const asset = await prisma.asset.create({
      data: {
        id: `asset-${randomUUID()}`,
        userId: user.id,
        type: "upload",
        storageUrl,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24-hour retention (see /api/cron/cleanup)
        metadata: { originalName: file.name.slice(0, 120), size: buffer.length, mimeType: `image/${ext === "jpg" ? "jpeg" : ext}` },
      },
    });
    return json({ ok: true, url: storageUrl, assetId: asset.id });
  });
}
