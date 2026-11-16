-- Admin-controlled session join mode. Defaults to the safe PRODUCTION window.
CREATE TYPE "SessionJoinMode" AS ENUM ('PRODUCTION', 'TEST');

ALTER TABLE "settings"
  ADD COLUMN "sessionJoinMode" "SessionJoinMode" NOT NULL DEFAULT 'PRODUCTION';
