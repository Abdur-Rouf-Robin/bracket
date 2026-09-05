-- CreateEnum
CREATE TYPE "CricketExtraType" AS ENUM ('NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY');

-- CreateEnum
CREATE TYPE "CricketWicketType" AS ENUM ('BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'RETIRED', 'OBSTRUCTING', 'TIMED_OUT', 'OTHER');

-- CreateEnum
CREATE TYPE "CricketInningsStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CricketFormat" AS ENUM ('T20', 'ODI', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CricketMatchMode" AS ENUM ('TOURNAMENT', 'STANDALONE');

-- CreateEnum
CREATE TYPE "CricketInningsEndReason" AS ENUM ('IN_PROGRESS', 'ALL_OUT', 'OVERS_COMPLETE', 'DECLARED', 'RAIN_DLS', 'MANUAL', 'FORFEIT', 'NO_RESULT', 'ABANDONED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIER');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('OWNER', 'ADMIN', 'COLLABORATOR', 'AFFILIATE');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('FREE', 'UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('OPEN', 'IN_USE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING');

-- DropIndex
DROP INDEX "Match_tournamentId_key_key";

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "iconUrl" TEXT,
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "awaySetsWon" INTEGER,
ADD COLUMN     "bestOf" INTEGER,
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "etAwayScore" DOUBLE PRECISION,
ADD COLUMN     "etHomeScore" DOUBLE PRECISION,
ADD COLUMN     "homeSetsWon" INTEGER,
ADD COLUMN     "isForfeit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isNoResult" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPlacement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legNumber" INTEGER,
ADD COLUMN     "matchMeta" JSONB,
ADD COLUMN     "mvpPlayerId" TEXT,
ADD COLUMN     "penAwayScore" DOUBLE PRECISION,
ADD COLUMN     "penHomeScore" DOUBLE PRECISION,
ADD COLUMN     "placementRank" INTEGER,
ADD COLUMN     "refereeId" TEXT,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reportedByUserId" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "sets" JSONB,
ADD COLUMN     "station" TEXT,
ADD COLUMN     "stationId" TEXT,
ADD COLUMN     "tieId" TEXT;

-- AlterTable
ALTER TABLE "Standing" ADD COLUMN     "adjustments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "buchholz" DOUBLE PRECISION,
ADD COLUMN     "netRunRate" DOUBLE PRECISION,
ADD COLUMN     "setsLost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "setsWon" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sonnebornBerger" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "accessTokenHash" TEXT,
ADD COLUMN     "checkedIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "fairPlayPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "registeredByUserId" TEXT,
ADD COLUMN     "teamPhotoUrl" TEXT,
ADD COLUMN     "withdrawn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TeamPlayer" ADD COLUMN     "isCaptain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "backgroundImageUrl" TEXT,
ADD COLUMN     "communityId" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "rankingId" TEXT,
ADD COLUMN     "scheduleConfig" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "venueAddress" TEXT,
ADD COLUMN     "venueName" TEXT,
ADD COLUMN     "venueType" TEXT,
ADD COLUMN     "venueUrl" TEXT,
ADD COLUMN     "viewPasswordHash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'PREMIER',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "communityId" TEXT,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" INTEGER,
    "lastSentAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "websiteUrl" TEXT,
    "location" TEXT,
    "countryCode" TEXT,
    "audience" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "socials" JSONB NOT NULL DEFAULT '{}',
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'AFFILIATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityFollow" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityGame" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "CommunityGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityAnnouncement" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ranking" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gameId" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "startingRating" INTEGER NOT NULL DEFAULT 1500,
    "kFactorNew" INTEGER NOT NULL DEFAULT 40,
    "kFactorNormal" INTEGER NOT NULL DEFAULT 20,
    "kFactorPro" INTEGER NOT NULL DEFAULT 10,
    "newPlayerMatches" INTEGER NOT NULL DEFAULT 10,
    "proThreshold" INTEGER NOT NULL DEFAULT 2000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingEntry" (
    "id" TEXT NOT NULL,
    "rankingId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "peakRating" DOUBLE PRECISION NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingHistory" (
    "id" TEXT NOT NULL,
    "rankingId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "matchId" TEXT,
    "tournamentId" TEXT,
    "opponentName" TEXT,
    "result" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "ratingAfter" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "communityId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "venueType" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "venueUrl" TEXT,
    "streamUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "communityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAdmin" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTicket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quantity" INTEGER,
    "salesStartAt" TIMESTAMP(3),
    "salesEndAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "privateDetails" TEXT,
    "status" "StationStatus" NOT NULL DEFAULT 'OPEN',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referee" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "accessTokenHash" TEXT,
    "availability" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "teamName" TEXT NOT NULL,
    "players" JSONB NOT NULL DEFAULT '[]',
    "email" TEXT,
    "phone" TEXT,
    "countryCode" TEXT,
    "skillLevel" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "waiverAcceptedAt" TIMESTAMP(3),
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "waitlistPosition" INTEGER,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'FREE',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripeSessionId" TEXT,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchComment" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingAdjustment" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "groupId" TEXT,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandingAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayerStat" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "yellowCards" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "redCards" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goals" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assists" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kills" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deaths" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "mvpScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isMvp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchVote" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketPrediction" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "guestKey" TEXT,
    "guestName" TEXT,
    "picks" JSONB NOT NULL DEFAULT '{}',
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CricketMatch" (
    "id" TEXT NOT NULL,
    "mode" "CricketMatchMode" NOT NULL DEFAULT 'TOURNAMENT',
    "matchId" TEXT,
    "slug" TEXT,
    "title" TEXT,
    "editTokenHash" TEXT,
    "homeTeamName" TEXT,
    "awayTeamName" TEXT,
    "homeRoster" JSONB,
    "awayRoster" JSONB,
    "format" "CricketFormat" NOT NULL DEFAULT 'T20',
    "maxOvers" INTEGER NOT NULL DEFAULT 20,
    "maxWickets" INTEGER NOT NULL DEFAULT 10,
    "ballsPerOver" INTEGER NOT NULL DEFAULT 6,
    "maxOversPerBowler" INTEGER NOT NULL DEFAULT 4,
    "maxBowlersAtLimit" INTEGER NOT NULL DEFAULT 5,
    "inningsCount" INTEGER NOT NULL DEFAULT 2,
    "strikeRotationMode" TEXT NOT NULL DEFAULT 'AUTO',
    "superOverPending" BOOLEAN NOT NULL DEFAULT false,
    "tossWinnerSide" TEXT,
    "tossDecision" TEXT,
    "homePoints" INTEGER,
    "awayPoints" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CricketMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CricketInnings" (
    "id" TEXT NOT NULL,
    "cricketMatchId" TEXT NOT NULL,
    "inningsNumber" INTEGER NOT NULL,
    "battingTeamId" TEXT NOT NULL,
    "bowlingTeamId" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "legalBalls" INTEGER NOT NULL DEFAULT 0,
    "extras" INTEGER NOT NULL DEFAULT 0,
    "targetRuns" INTEGER,
    "status" "CricketInningsStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "endReason" "CricketInningsEndReason",
    "isAllOut" BOOLEAN NOT NULL DEFAULT false,
    "isSuperOver" BOOLEAN NOT NULL DEFAULT false,
    "declared" BOOLEAN NOT NULL DEFAULT false,
    "revisedMaxOvers" INTEGER,
    "dlsParScore" INTEGER,
    "strikerId" TEXT,
    "nonStrikerId" TEXT,
    "currentBowlerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CricketInnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CricketBall" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "overNumber" INTEGER NOT NULL,
    "ballInOver" INTEGER NOT NULL,
    "batsmanId" TEXT NOT NULL,
    "bowlerId" TEXT NOT NULL,
    "runsOffBat" INTEGER NOT NULL DEFAULT 0,
    "extraType" "CricketExtraType" NOT NULL DEFAULT 'NONE',
    "extraRuns" INTEGER NOT NULL DEFAULT 0,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "isLegalDelivery" BOOLEAN NOT NULL DEFAULT true,
    "isWicket" BOOLEAN NOT NULL DEFAULT false,
    "wicketType" "CricketWicketType",
    "dismissedPlayerId" TEXT,
    "fielderId" TEXT,
    "commentary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CricketBall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "Webhook_userId_idx" ON "Webhook"("userId");

-- CreateIndex
CREATE INDEX "Webhook_tournamentId_idx" ON "Webhook"("tournamentId");

-- CreateIndex
CREATE INDEX "Webhook_communityId_idx" ON "Webhook"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE INDEX "Community_ownerId_idx" ON "Community"("ownerId");

-- CreateIndex
CREATE INDEX "Community_isPublic_idx" ON "Community"("isPublic");

-- CreateIndex
CREATE INDEX "CommunityMember_userId_idx" ON "CommunityMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");

-- CreateIndex
CREATE INDEX "CommunityFollow_userId_idx" ON "CommunityFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityFollow_communityId_userId_key" ON "CommunityFollow"("communityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityGame_communityId_gameId_key" ON "CommunityGame"("communityId", "gameId");

-- CreateIndex
CREATE INDEX "CommunityAnnouncement_communityId_createdAt_idx" ON "CommunityAnnouncement"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "Ranking_communityId_idx" ON "Ranking"("communityId");

-- CreateIndex
CREATE INDEX "RankingEntry_rankingId_rating_idx" ON "RankingEntry"("rankingId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "RankingEntry_rankingId_userId_key" ON "RankingEntry"("rankingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RankingEntry_rankingId_displayName_key" ON "RankingEntry"("rankingId", "displayName");

-- CreateIndex
CREATE INDEX "RatingHistory_entryId_createdAt_idx" ON "RatingHistory"("entryId", "createdAt");

-- CreateIndex
CREATE INDEX "RatingHistory_rankingId_matchId_idx" ON "RatingHistory"("rankingId", "matchId");

-- CreateIndex
CREATE INDEX "TournamentTemplate_ownerId_idx" ON "TournamentTemplate"("ownerId");

-- CreateIndex
CREATE INDEX "TournamentTemplate_communityId_idx" ON "TournamentTemplate"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_ownerId_idx" ON "Event"("ownerId");

-- CreateIndex
CREATE INDEX "Event_communityId_idx" ON "Event"("communityId");

-- CreateIndex
CREATE INDEX "Event_isPublished_startAt_idx" ON "Event"("isPublished", "startAt");

-- CreateIndex
CREATE INDEX "EventAdmin_userId_idx" ON "EventAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAdmin_eventId_userId_key" ON "EventAdmin"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventTicket_eventId_idx" ON "EventTicket"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_code_key" ON "EventOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_stripeSessionId_key" ON "EventOrder"("stripeSessionId");

-- CreateIndex
CREATE INDEX "EventOrder_eventId_status_idx" ON "EventOrder"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventOrder_buyerEmail_idx" ON "EventOrder"("buyerEmail");

-- CreateIndex
CREATE INDEX "Station_tournamentId_order_idx" ON "Station"("tournamentId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Station_tournamentId_name_key" ON "Station"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Referee_accessTokenHash_key" ON "Referee"("accessTokenHash");

-- CreateIndex
CREATE INDEX "Referee_tournamentId_idx" ON "Referee"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_teamId_key" ON "Registration"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_stripeSessionId_key" ON "Registration"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Registration_tournamentId_status_idx" ON "Registration"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "Registration_userId_idx" ON "Registration"("userId");

-- CreateIndex
CREATE INDEX "MatchComment_matchId_createdAt_idx" ON "MatchComment"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "StandingAdjustment_tournamentId_teamId_idx" ON "StandingAdjustment"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "MatchPlayerStat_matchId_idx" ON "MatchPlayerStat"("matchId");

-- CreateIndex
CREATE INDEX "MatchPlayerStat_playerId_idx" ON "MatchPlayerStat"("playerId");

-- CreateIndex
CREATE INDEX "MatchPlayerStat_teamId_idx" ON "MatchPlayerStat"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayerStat_matchId_playerId_key" ON "MatchPlayerStat"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "MatchVote_matchId_idx" ON "MatchVote"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchVote_matchId_userId_key" ON "MatchVote"("matchId", "userId");

-- CreateIndex
CREATE INDEX "BracketPrediction_tournamentId_idx" ON "BracketPrediction"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketPrediction_tournamentId_userId_key" ON "BracketPrediction"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketPrediction_tournamentId_guestKey_key" ON "BracketPrediction"("tournamentId", "guestKey");

-- CreateIndex
CREATE UNIQUE INDEX "CricketMatch_matchId_key" ON "CricketMatch"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "CricketMatch_slug_key" ON "CricketMatch"("slug");

-- CreateIndex
CREATE INDEX "CricketMatch_mode_idx" ON "CricketMatch"("mode");

-- CreateIndex
CREATE INDEX "CricketInnings_cricketMatchId_idx" ON "CricketInnings"("cricketMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "CricketInnings_cricketMatchId_inningsNumber_key" ON "CricketInnings"("cricketMatchId", "inningsNumber");

-- CreateIndex
CREATE INDEX "CricketBall_inningsId_idx" ON "CricketBall"("inningsId");

-- CreateIndex
CREATE INDEX "CricketBall_inningsId_sequence_idx" ON "CricketBall"("inningsId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE INDEX "Group_tournamentId_idx" ON "Group"("tournamentId");

-- CreateIndex
CREATE INDEX "Match_tournamentId_status_idx" ON "Match"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "Match_tournamentId_bracketSide_round_idx" ON "Match"("tournamentId", "bracketSide", "round");

-- CreateIndex
CREATE INDEX "Match_tournamentId_groupId_idx" ON "Match"("tournamentId", "groupId");

-- CreateIndex
CREATE INDEX "Match_tournamentId_scheduledAt_idx" ON "Match"("tournamentId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Match_stationId_idx" ON "Match"("stationId");

-- CreateIndex
CREATE INDEX "Match_refereeId_idx" ON "Match"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_accessTokenHash_key" ON "Team"("accessTokenHash");

-- CreateIndex
CREATE INDEX "Tournament_createdById_idx" ON "Tournament"("createdById");

-- CreateIndex
CREATE INDEX "Tournament_gameId_idx" ON "Tournament"("gameId");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Tournament_communityId_idx" ON "Tournament"("communityId");

-- CreateIndex
CREATE INDEX "Tournament_eventId_idx" ON "Tournament"("eventId");

-- CreateIndex
CREATE INDEX "Tournament_isPublic_status_startAt_idx" ON "Tournament"("isPublic", "status", "startAt");

-- CreateIndex
CREATE INDEX "TournamentAdmin_userId_idx" ON "TournamentAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_plan_idx" ON "User"("plan");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityFollow" ADD CONSTRAINT "CommunityFollow_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityFollow" ADD CONSTRAINT "CommunityFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityGame" ADD CONSTRAINT "CommunityGame_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityGame" ADD CONSTRAINT "CommunityGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAnnouncement" ADD CONSTRAINT "CommunityAnnouncement_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAnnouncement" ADD CONSTRAINT "CommunityAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingEntry" ADD CONSTRAINT "RankingEntry_rankingId_fkey" FOREIGN KEY ("rankingId") REFERENCES "Ranking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingEntry" ADD CONSTRAINT "RankingEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_rankingId_fkey" FOREIGN KEY ("rankingId") REFERENCES "Ranking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingHistory" ADD CONSTRAINT "RatingHistory_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "RankingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTemplate" ADD CONSTRAINT "TournamentTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTemplate" ADD CONSTRAINT "TournamentTemplate_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAdmin" ADD CONSTRAINT "EventAdmin_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAdmin" ADD CONSTRAINT "EventAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicket" ADD CONSTRAINT "EventTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "EventTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referee" ADD CONSTRAINT "Referee_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referee" ADD CONSTRAINT "Referee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchComment" ADD CONSTRAINT "MatchComment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchComment" ADD CONSTRAINT "MatchComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingAdjustment" ADD CONSTRAINT "StandingAdjustment_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingAdjustment" ADD CONSTRAINT "StandingAdjustment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingAdjustment" ADD CONSTRAINT "StandingAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_rankingId_fkey" FOREIGN KEY ("rankingId") REFERENCES "Ranking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "TeamPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "Referee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_mvpPlayerId_fkey" FOREIGN KEY ("mvpPlayerId") REFERENCES "TeamPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchVote" ADD CONSTRAINT "MatchVote_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketPrediction" ADD CONSTRAINT "BracketPrediction_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CricketMatch" ADD CONSTRAINT "CricketMatch_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CricketInnings" ADD CONSTRAINT "CricketInnings_cricketMatchId_fkey" FOREIGN KEY ("cricketMatchId") REFERENCES "CricketMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CricketBall" ADD CONSTRAINT "CricketBall_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "CricketInnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

