-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "sendWindowEndHour" INTEGER NOT NULL DEFAULT 17,
ADD COLUMN     "sendWindowStartHour" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Denver';
