-- AlterEnum
ALTER TYPE "BracketSide" ADD VALUE 'SWISS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TournamentFormat" ADD VALUE 'SWISS';
ALTER TYPE "TournamentFormat" ADD VALUE 'LEADERBOARD';
ALTER TYPE "TournamentFormat" ADD VALUE 'TIME_TRIAL';
ALTER TYPE "TournamentFormat" ADD VALUE 'SINGLE_RACE';
ALTER TYPE "TournamentFormat" ADD VALUE 'GRAND_PRIX';

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "eventCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "raceCount" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "swissRounds" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "EventResult" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventIndex" INTEGER NOT NULL,
    "eventLabel" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "position" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventResult_tournamentId_eventIndex_idx" ON "EventResult"("tournamentId", "eventIndex");

-- CreateIndex
CREATE UNIQUE INDEX "EventResult_tournamentId_eventKey_teamId_key" ON "EventResult"("tournamentId", "eventKey", "teamId");

-- AddForeignKey
ALTER TABLE "EventResult" ADD CONSTRAINT "EventResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResult" ADD CONSTRAINT "EventResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
