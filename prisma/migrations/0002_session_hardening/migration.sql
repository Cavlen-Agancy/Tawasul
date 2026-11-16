-- Phase 1 session hardening
-- Durable per-entry admission state and idempotent appointment-end termination tracking.

ALTER TABLE "session_rooms"
  ADD COLUMN "currentEntryId" TEXT,
  ADD COLUMN "admittedParticipantSid" TEXT,
  ADD COLUMN "terminatedAt" TIMESTAMP(3);

CREATE INDEX "session_rooms_expiresAt_terminatedAt_idx"
  ON "session_rooms"("expiresAt", "terminatedAt");
