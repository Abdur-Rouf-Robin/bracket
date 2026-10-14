ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "domainStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "domainResolvedIp" TEXT;

ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "mapName" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "gameMode" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "stageId" TEXT;

CREATE TABLE IF NOT EXISTS "TournamentStage" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "format" "TournamentFormat" NOT NULL,
  "advanceCount" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentStage_tournamentId_order_key" ON "TournamentStage"("tournamentId", "order");
CREATE INDEX IF NOT EXISTS "TournamentStage_tournamentId_idx" ON "TournamentStage"("tournamentId");

CREATE TABLE IF NOT EXISTS "SavedSquad" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedSquad_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedSquad_userId_idx" ON "SavedSquad"("userId");

CREATE TABLE IF NOT EXISTS "SavedSquadPlayer" (
  "id" TEXT NOT NULL,
  "squadId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SavedSquadPlayer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedSquadPlayer_squadId_idx" ON "SavedSquadPlayer"("squadId");

DO $$ BEGIN
  ALTER TABLE "TournamentStage" ADD CONSTRAINT "TournamentStage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Match" ADD CONSTRAINT "Match_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TournamentStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SavedSquad" ADD CONSTRAINT "SavedSquad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SavedSquadPlayer" ADD CONSTRAINT "SavedSquadPlayer_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "SavedSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Match_stageId_idx" ON "Match"("stageId");
