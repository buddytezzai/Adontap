-- CreateEnum
CREATE TYPE "Engine" AS ENUM ('Seedance', 'Higgsfield', 'HeyGen', 'Runway', 'GoogleVeo');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "VariableType" AS ENUM ('text', 'textarea', 'select');

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "colorFrom" TEXT NOT NULL,
    "colorTo" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "engine" "Engine" NOT NULL,
    "costInr" INTEGER NOT NULL,
    "priceInr" INTEGER NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0.18,
    "status" "TemplateStatus" NOT NULL DEFAULT 'draft',
    "basePrompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVariable" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "VariableType" NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "defaultValue" TEXT NOT NULL,
    "editable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TemplateVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "templateTitle" TEXT NOT NULL,
    "submittedValues" JSONB NOT NULL,
    "assembledPrompt" TEXT NOT NULL,
    "chargeInr" INTEGER NOT NULL,
    "gstInr" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_status_idx" ON "Template"("status");

-- CreateIndex
CREATE INDEX "TemplateVariable_templateId_sortOrder_idx" ON "TemplateVariable"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVariable_templateId_key_key" ON "TemplateVariable"("templateId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "Generation_createdAt_idx" ON "Generation"("createdAt");

-- AddForeignKey
ALTER TABLE "TemplateVariable" ADD CONSTRAINT "TemplateVariable_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
