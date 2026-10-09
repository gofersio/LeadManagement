-- AlterTable
ALTER TABLE "CampaignStep" ADD COLUMN     "activeVariantIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "variants" JSONB NOT NULL DEFAULT '[]';
