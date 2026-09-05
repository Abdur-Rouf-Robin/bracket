-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- Seed known platform admins
UPDATE "User"
SET "role" = 'ADMIN'
WHERE email IN ('admin@example.com', 'admin@bracket.local');
