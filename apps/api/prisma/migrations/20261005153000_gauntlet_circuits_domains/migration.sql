ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'GAUNTLET';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'CUSTOM_BRACKET';

ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Community_customDomain_key" ON "Community"("customDomain");

ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "lobbyCode" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "lobbyUrl" TEXT;

CREATE TABLE IF NOT EXISTS "Circuit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "communityId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "points" JSONB NOT NULL DEFAULT '[25,18,15,12,10,8,6,4,2,1]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Circuit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Circuit_slug_key" ON "Circuit"("slug");
CREATE INDEX IF NOT EXISTS "Circuit_ownerId_idx" ON "Circuit"("ownerId");
CREATE INDEX IF NOT EXISTS "Circuit_communityId_idx" ON "Circuit"("communityId");

ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "circuitId" TEXT;
CREATE INDEX IF NOT EXISTS "Tournament_circuitId_idx" ON "Tournament"("circuitId");

DO $$ BEGIN
  ALTER TABLE "Circuit" ADD CONSTRAINT "Circuit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Circuit" ADD CONSTRAINT "Circuit_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
