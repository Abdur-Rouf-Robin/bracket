CREATE TABLE IF NOT EXISTS "OutboundMail" (
  "id" TEXT NOT NULL,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "href" TEXT,
  "delivered" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutboundMail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OutboundMail_createdAt_idx" ON "OutboundMail"("createdAt");
