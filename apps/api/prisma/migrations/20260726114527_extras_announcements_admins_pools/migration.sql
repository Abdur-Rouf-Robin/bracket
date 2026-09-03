-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "poolColor" TEXT;

-- AlterTable
ALTER TABLE "TeamPlayer" ADD COLUMN     "poolColor" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentAdmin" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_tournamentId_idx" ON "Announcement"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentAdmin_tournamentId_idx" ON "TournamentAdmin"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentAdmin_tournamentId_userId_key" ON "TournamentAdmin"("tournamentId", "userId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAdmin" ADD CONSTRAINT "TournamentAdmin_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAdmin" ADD CONSTRAINT "TournamentAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
