-- Phase 3/4: doctor-based booking and payment-driven confirmation.

-- Online bookings carry a short reservation window. NULL is preserved for
-- legacy rows and for in-clinic bookings.
ALTER TABLE "bookings" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);
CREATE INDEX "bookings_status_holdExpiresAt_idx" ON "bookings"("status", "holdExpiresAt");

-- Backfill doctor-specific availability from the active clinic default for
-- every active doctor that does not yet have any availability rows. Existing
-- custom availability is never modified.
INSERT INTO "availability" ("id", "doctorId", "dayOfWeek", "startTime", "endTime", "sessionDuration", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  d."id",
  s."dayOfWeek",
  s."startTime",
  s."endTime",
  s."sessionDuration",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "doctors" d
JOIN "users" u ON u."id" = d."userId"
CROSS JOIN "admin_schedules" s
WHERE d."isActive" = true
  AND u."isActive" = true
  AND s."isActive" = true
  AND NOT EXISTS (
    SELECT 1 FROM "availability" a WHERE a."doctorId" = d."id"
  )
ON CONFLICT ("doctorId", "dayOfWeek") DO NOTHING;
