-- AlterTable
ALTER TABLE "Job" ADD COLUMN "serverMatchError" TEXT;
ALTER TABLE "Job" ADD COLUMN "serverMatchFailedAt" DATETIME;
