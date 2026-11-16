# Test Environment Report — Tawasul

## 1. PostgreSQL
- Container: `tawasul_postgres`
- Status: Running and healthy
- Host port: `5433`
- `pg_isready`: accepting connections
- Prisma datasource connection: successful
- Migration status: `0001_init` and `0002_session_hardening` are recorded as not applied; schema exists but Phase 1 hardening columns may not
- Ran `npx prisma migrate status`; no migrations were applied

## 2. LiveKit
- Container: `tawasul_livekit`
- Status: Running
- HTTP endpoint `http://localhost:7880`: HTTP 200
- Server-side API authentication: `RoomServiceClient.listRooms()` succeeded
- Configured keys are present in `.env`; external URL in `.env` points to a tunnel, internal SDK uses localhost for local runs
- Health interface: single-node development mode on port 7880

## 3. Testing Dependencies
- Vitest: installed
- Playwright: installed, Chromium binary missing initially, installed successfully after release of its directory lock
- Node and npm: available
- TypeScript tooling: available via tsx and prisma

## 4. Test Accounts
Created four idempotent accounts:

| Role | Account | Status |
|---|---|---|
| ADMIN | Existing seed administrator (`admin@tawasul.com`) | Active |
| DOCTOR | `test.doctor@tawasul.com` | Active with Doctor record and availability |
| STAFF | `test.staff@tawasul.com` | Active with standard admin permissions |
| PATIENT | `test.patient@tawasul.com` | Active |

Authentication was verified successfully for all four roles through `/api/auth/login` with HTTP 200.

## 5. Test Account Credentials
- Location: `TEST-ACCOUNTS.local.md`
- Git-ignored: yes (`TEST-ACCOUNTS.local.md` added to `.gitignore`)

## 6. Authentication Verification
- admin@tawasul.com: AUTHENTICATED (STAFF)
- test.patient@tawasul.com: AUTHENTICATED (PATIENT)
- test.doctor@tawasul.com: AUTHENTICATED (DOCTOR, with Doctor record)
- test.staff@tawasul.com: AUTHENTICATED (STAFF)

## 7. Problems Encountered and Resolutions
- PostgreSQL container was initially stopped; started with `docker compose up -d postgres`
- LiveKit container was unavailable due to port 50079 UDP conflict from a wsdd process; stopped that process and started `docker compose up -d livekit`
- Prisma migration status reports 0001_init and 0002_session_hardening unapplied despite schema tables existing
- Playwright Chromium was missing initially; resolved by re-running the browser installation
- No application functionality was modified during preparation

## 8. Remaining Blockers
- `prisma generate` / migration `0002_session_hardening` not applied, so Phase 1 hardening columns may be missing from `session_rooms`
- `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=true` is currently enabled in `.env` (must be disabled for genuine security testing)
- Comprehensive E2E test fixtures and bookings have not been executed yet
- LiveKit is running as a single-node development instance without restart/recovery checks

## 9. Files Created or Modified
- `TEST-ACCOUNTS.local.md` (new)
- `TEST-ENVIRONMENT-REPORT.md` (new)
- `.gitignore` (append entry for `TEST-ACCOUNTS.local.md`)

## 10. Data Safety
No production data or existing accounts were knowingly modified. New test accounts were created with clearly identifiable test names and emails.
