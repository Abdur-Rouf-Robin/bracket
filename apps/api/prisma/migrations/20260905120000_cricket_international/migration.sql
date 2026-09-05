-- AlterEnum
ALTER TYPE "CricketFormat" ADD VALUE 'TEST';
ALTER TYPE "CricketFormat" ADD VALUE 'HUNDRED';

-- AlterEnum
ALTER TYPE "CricketWicketType" ADD VALUE 'RETIRED_HURT';

-- AlterTable
ALTER TABLE "CricketMatch" ADD COLUMN "followOnEnforced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CricketMatch" ADD COLUMN "followOnMargin" INTEGER;
