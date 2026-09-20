import "server-only";

import { prisma } from "./db";
import { deleteStored } from "./storage";

/**
 * Scheduled cleanup job: finds assets older than 24h (expiresAt <= now),
 * removes the underlying stored file from disk/bucket, and marks the database
 * record as `expired: true` to preserve order history and show user an explanation.
 */
export async function cleanupExpiredAssets(): Promise<{ cleanedCount: number }> {
  const now = new Date();

  const expiredAssets = await prisma.asset.findMany({
    where: {
      expiresAt: { lte: now },
      expired: false,
    },
    select: {
      id: true,
      storageUrl: true,
    },
  });

  let cleanedCount = 0;

  for (const asset of expiredAssets) {
    try {
      await deleteStored(asset.storageUrl);
    } catch (e) {
      // Leave the row un-expired so the next run retries; don't abort the rest of the batch.
      console.error(`[cleanup] could not delete ${asset.storageUrl}`, e);
      continue;
    }
    await prisma.asset.update({ where: { id: asset.id }, data: { expired: true } });
    cleanedCount++;
  }

  return { cleanedCount };
}
