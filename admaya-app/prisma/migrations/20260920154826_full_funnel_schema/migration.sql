-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('upload', 'generated');

-- AlterEnum
ALTER TYPE "VariableType" ADD VALUE 'image';

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "inspiredByScoutedAdId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "creditBalance" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoutedAd" (
    "id" TEXT NOT NULL,
    "advertiserName" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "creativeSnapshotUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "platforms" JSONB NOT NULL DEFAULT '["facebook", "instagram"]',
    "deliveryStartDate" TIMESTAMP(3) NOT NULL,
    "deliveryStopDate" TIMESTAMP(3),
    "approvedForPublic" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoutedAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "scoutedAdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "type" "AssetType" NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "amountPaidInr" INTEGER NOT NULL,
    "submittedValues" JSONB NOT NULL,
    "refundEligible" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "ScoutedAd_approvedForPublic_category_idx" ON "ScoutedAd"("approvedForPublic", "category");

-- CreateIndex
CREATE INDEX "Vote_scoutedAdId_idx" ON "Vote"("scoutedAdId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_scoutedAdId_userId_key" ON "Vote"("scoutedAdId", "userId");

-- CreateIndex
CREATE INDEX "Asset_userId_expired_expiresAt_idx" ON "Asset"("userId", "expired", "expiresAt");

-- CreateIndex
CREATE INDEX "Asset_expiresAt_idx" ON "Asset"("expiresAt");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_userId_idx" ON "Generation"("userId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_inspiredByScoutedAdId_fkey" FOREIGN KEY ("inspiredByScoutedAdId") REFERENCES "ScoutedAd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_scoutedAdId_fkey" FOREIGN KEY ("scoutedAdId") REFERENCES "ScoutedAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
