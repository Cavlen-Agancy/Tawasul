# CHANGES.md — Phase 1 Security Hardening

**Scope:** Phase 1 LiveKit access-control hardening only. No Phase 2 work, booking/payment redesign, registration change, or email verification was started.

**Verification status:** No build, automated test, browser check, container, migration, `prisma generate`, or Git command was executed. All tests and runtime checks remain unexecuted.

## Security Behavior Implemented

1. **Forced disconnection at appointment end**
   - A server-side in-process timer is scheduled per room from `ensureSessionRoom`.
   - At exact `SessionRoom.expiresAt`, `RoomServiceClient.deleteRoom` forcibly disconnects patient and doctor even if the browser stays open.
   - `SessionRoom.terminatedAt` makes termination idempotent; repeated calls are no-ops.
   - A Nitro startup plugin sweeps expired un-terminated rooms and re-arms future active rooms after restart.
   - A 30-second fallback sweep retries missed/transient failures.
   - Termination is scoped by both `bookingId` and exact `roomName`; one appointment cannot delete another room.
   - A missing LiveKit room is treated as already terminated; transient LiveKit failures leave `terminatedAt` null for retry.
   - Timers re-check the wall clock and chain delays above Node's maximum timer value, so a long wait cannot fire early.
   - When `ensureSessionRoom` detects that the appointment end changed (reschedule), it clears `terminatedAt`/admission state and re-arms termination for the new end. The termination write is scoped by the observed `expiresAt`, so an in-flight old termination cannot mark the new end as terminated.

2. **Old-token / re-entry denial**
   - Every patient token request rotates `SessionRoom.currentEntryId` and clears `admittedParticipantSid`.
   - Patient LiveKit identity is `userId:entryId`; the previous entry becomes stale server-side.
   - Doctor admission requires the current entry identity, verifies the participant exists in LiveKit, and stores the admitted participant SID.
   - A reconnect with the same old token produces a new LiveKit SID; admission is denied and the participant is removed.
   - A stale entry identity is rejected and removed.
   - Admission persistence is conditional on the same `currentEntryId` and an unchanged/empty admitted SID, closing the race where a new lobby entry arrives mid-admission. A stale write revokes the granted permissions and fails with `409`.
   - After granting media, the route re-lists participants and revokes the grant if the LiveKit SID changed, closing the reconnect-during-grant window.
   - Duplicate LiveKit connections for the same identity are rejected and removed instead of being tied to one admitted SID.
   - Fresh entry rotation permits a new admission; duplicate admission for the same SID is idempotent.
   - No client-side admission flag or previous token is trusted.

## Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `SessionRoom.currentEntryId`, `admittedParticipantSid`, `terminatedAt`, and `@@index([expiresAt, terminatedAt])`. |
| `prisma/migrations/0002_session_hardening/migration.sql` | **New** additive migration for the three SessionRoom columns and index. Not executed. |
| `server/utils/session-room.ts` | Accepts patient entry ID; rotates `currentEntryId`, clears `admittedParticipantSid`, and schedules exact-end termination. Detects a changed appointment end, clears old termination/admission state, and re-arms termination. |
| `server/utils/session-termination.ts` | **New** LiveKit room deletion, idempotent `terminatedAt`, wall-clock re-check/chained timers, per-room scheduling, startup/fallback sweeps, future-room re-arm; termination write scoped to the observed `expiresAt`. |
| `server/plugins/session-termination.ts` | **New** Nitro startup plugin that starts the scheduler/recovery sweeper. |
| `server/utils/session-access.ts` | Added composite `userId:entryId` identity builder/parser; admission validates current entry. (Current file is otherwise unchanged from the prior Phase 1 implementation.) |
| `modules/patient/server/api/patient/session/[bookingId].get.ts` | Generates a fresh entry ID per token; updates room entry; member token identity is `userId:entryId`; still exact window/TTL/active checks. |
| `modules/doctor/server/api/doctor/session/[bookingId].get.ts` | Doctor token/room access does not rotate the patient entry; exact window/TTL/active checks preserved. |
| `modules/doctor/server/api/doctor/session/[bookingId]/admit.post.ts` | Validates current entry and exactly one current participant SID; re-verifies the SID after granting media and revokes on change; conditionally persists admission (entry/SID race guard); rejects/removes stale, duplicate, or reconnected old-token participants; duplicate same-SID admission is safe. |
| `modules/session/server/api/meeting/lobby/[meetingId].get.ts` | Staff/in-clinic `canJoin=false`; `sessionType` returned; exact-end window. |
| `modules/session/composables/useMeetingLobby.ts` | Added `sessionType` to the response type. |
| `pages/dashboard/appointments.vue` | Exact-end UI, removed test-mode early join, added ended message. |
| `modules/doctor/pages/doctor/calendar.vue` | Exact-end UI, removed test-mode early join, Join only for confirmed online. |
| `pages/dashboard/session/[bookingId].vue` | `expiresAt` auto-leave timer, ended state, cleanup; member token flow preserved. |
| `modules/doctor/pages/doctor/session/[bookingId].vue` | Same end handling for doctors; admit flow preserved. |
| `pages/meeting/[meetingId]/lobby.vue` | Delegates to canonical session route; staff unsupported; in-clinic/ended states. |
| `composables/useSessionI18n.ts` | Added English/Arabic session-ended messages. |
| `nuxt.config.ts` | `enableSessionTestMode` marked as a deprecated no-op. |
| `tests/api/setup.ts` | Test-only LiveKit signing keys/URL. |
| `tests/api/patient/helpers.ts` | Added `sessionType` to booking fixtures. |
| `tests/api/patient/session/[bookingId].get.test.ts` | Updated/expanded authorization/window/re-entry tests; asserts entry rotation and admitted-SID clearing, old/new token identity, member grants, TTL, test-mode non-bypass, in-clinic/staff/inactive rejection. |
| `tests/api/doctor/session/[bookingId].get.test.ts` | **New** doctor token/authorization/window/active-account tests. |
| `tests/api/doctor/session/[bookingId]/admit.post.test.ts` | **New/expanded** current-entry/SID admission, wrong identity/doctor/staff, in-clinic/non-confirmed/end, old-token reconnect denial, reconnect-during-grant revocation, duplicate connections, entry rotation, mid-flight entry-rotation race, duplicate admission. |
| `tests/api/session/termination.test.ts` | **New** exact-room deletion, idempotency, cross-booking guard, startup sweep, future re-arm, reschedule clears old termination/re-arms, missing-room/transient failure. |
| `tests/api/session/lobby/[meetingId].get.test.ts` | Staff/in-clinic `canJoin=false`; exact-end false. |
| `tests/utils/meeting.test.ts` | Exact-end window; +15 removed. |
| `tests/utils/livekit-token.test.ts` | **New** member/moderator grants, explicit TTL, default TTL. |
| `tests/api/doctor/profile.test.ts` | Updated outside-window message expectation. |
| `Docs/Implementation-Roadmap/phases/PHASE-01-session-reentry.md` | Updated for entry/SID admission, forced termination, migration, restart recovery, tests, unverified status. |
| `Docs/PHASE-01-session-reentry.md` | Root Phase 1 status/hardening summary and residual risks. |
| `Docs/Implementation-Roadmap/README.md` | Phase 1 status updated; SessionRoom hardening architecture/risk documented. |
| `Docs/Implementation-Roadmap/01-architecture-and-data-impact.md` | SessionRoom fields, migration order, admission/SID and termination architecture updated. |
| `Docs/Implementation-Roadmap/02-phase-plan.md` | Phase 1 scope/database/DoD updated; migration order includes Phase 1. |
| `Docs/Implementation-Roadmap/03-risks-and-open-questions.md` | R6/R7 updated for current-entry/SID and forced termination; owner approvals recorded. |
| `Docs/Implementation-Roadmap/phases/PHASE-06-release-hardening.md` | Added SessionRoom migration, forced-termination, old-token, and E2E/rehearsal checks. |
| `Docs/FINAL-DECISIONS.md` | Owner approval status updated; no unrelated feature implemented. |
| `Docs/OWNER-APPROVAL-REQUIRED.md` | Owner approval status updated; no unrelated feature implemented. |
| `Docs/ROADMAP-DECISIONS-UPDATE.md` | Owner approval status updated; no unrelated feature implemented. |
| `Docs/CONTRADICTION-RESOLUTION-REPORT.md` | Owner approval status updated; no unrelated feature implemented. |
| `Docs/Implementation-Roadmap/00-current-system-analysis.md` | Phase 1 session facts/status updated; no unrelated feature implemented. |
| `Docs/Implementation-Roadmap/phases/PHASE-02-doctor-workspace-simplification.md` | Owner approval status updated; no unrelated feature implemented. |
| `Docs/Implementation-Roadmap/phases/PHASE-03-doctor-booking-foundation.md` | Owner approval status updated; no unrelated feature implemented. |
| `Docs/Implementation-Roadmap/phases/PHASE-04-payment-confirmation-lifecycle.md` | Owner approval status updated; no unrelated feature implemented. |
| `Docs/Implementation-Roadmap/phases/PHASE-06-release-hardening.md` | Owner approval status and Phase 1 verification checks updated; no unrelated feature implemented. |

## Files Created

| File | Purpose |
|---|---|
| `prisma/migrations/0002_session_hardening/migration.sql` | Additive SessionRoom entry/admission/termination fields and index. |
| `server/utils/session-termination.ts` | Idempotent LiveKit room termination + restart/fallback scheduler. |
| `server/plugins/session-termination.ts` | Nitro startup hook for scheduler/recovery. |
| `tests/api/doctor/session/[bookingId].get.test.ts` | Doctor session token/authorization tests. |
| `tests/api/doctor/session/[bookingId]/admit.post.test.ts` | Admission/current-entry/old-token tests. |
| `tests/api/session/termination.test.ts` | Termination/sweep/idempotency tests. |
| `tests/utils/livekit-token.test.ts` | Token grant/TTL tests. |
| `Docs/PHASE-01-session-reentry.md` | Root Phase 1 implementation/security status. |
| `CHANGES.md` | This report. |

## Files Deleted

None.

## Assumptions

- Production currently runs one app container, so an in-process exact timer plus durable `expiresAt`/`terminatedAt` and startup/30s sweeps is the smallest reliable solution without a new job system. Multiple instances would each run the idempotent sweeper.
- Tokens are per-entry; doctor access does not rotate the patient's entry.
- `expiresAt`/`terminatedAt` are durable metadata; `SessionRoom.expiresAt` is not authorization.
- A patient token from an old entry may still connect to the LiveKit waiting room until JWT expiry, but it has no media permissions and cannot be admitted; admission attempts remove it.
- LiveKit `participant.sid` provides a reliable connection-instance discriminator for old-token reconnect detection.
- The migration must be applied and `prisma generate` run before verification.

## Problems Encountered and Resolutions

- No existing cron/job infrastructure: added a Nitro startup plugin + per-room timers + durable startup/fallback sweep rather than a new job system.
- JWT expiration alone cannot disconnect active participants: added server-side `deleteRoom` at exact end.
- Old tokens cannot be revoked in JWT: added server-side entry rotation, current-entry validation, LiveKit SID admission state, and stale-participant removal.
- Existing admit tests used raw `userId` identity and no SID; updated to composite entry identity and mocked LiveKit participant listing.
- Existing tests expected +15 and old error messages; updated.
- LiveKit tests had no deterministic signing credentials; added test-only fake keys.
- No tests/migrations/build were run per task restrictions.

## Tests Added/Updated but NOT Executed

- `tests/utils/meeting.test.ts`
- `tests/utils/livekit-token.test.ts`
- `tests/api/patient/session/[bookingId].get.test.ts`
- `tests/api/doctor/session/[bookingId].get.test.ts`
- `tests/api/doctor/session/[bookingId]/admit.post.test.ts`
- `tests/api/session/termination.test.ts`
- `tests/api/session/lobby/[meetingId].get.test.ts`
- `tests/api/doctor/profile.test.ts`
- `tests/api/patient/helpers.ts`
- `tests/api/setup.ts`

## Remaining Risks / Verification Required

1. **Not verified:** no migration, `prisma generate`, automated test, build, browser, container, or staging run.
2. **Restart timing:** after a restart, a missed expired room may be terminated up to the 30-second sweep interval late; token expiry still blocks new joins.
3. **Old token waiting-room connection:** an unexpired old token may connect to the waiting room but has no media permissions and is removed when admission is attempted. A future LiveKit webhook/revocation layer could remove it proactively.
4. **Single-instance scheduler assumption:** multi-instance deployments rely on the idempotent startup/periodic sweeper; no external durable job queue exists.
5. **Reschedule interaction:** the existing same-day start-time patch does not touch `SessionRoom` directly. The next token request detects the changed end, clears the old termination/admission state, and re-arms termination (rotating the entry on a patient request). The Phase 3 reschedule endpoints must reset session state explicitly rather than relying on the next token request.
6. Manual two-browser drills required: exact-end forced disconnect, old-token reconnect denial, fresh lobby re-admission, wrong doctor/patient/staff denial.

## Phase 1 Playwright E2E Attempted

**Status:** BLOCKED — required runtime dependencies are unavailable. No Phase 1 E2E tests were executed.

**Environment check:**
- Playwright package is present (`@playwright/test` 1.62.1), but its Chromium binary is not installed at `/home/abdelrhman/.cache/ms-playwright/chromium_headless_shell-1234/...`.
- PostgreSQL is running for the app (`tawasul_postgres` on 5433), but `prisma generate` and the Phase 1 migration have not been run.
- No LiveKit server is listening: port 7880 is closed and the `tawasul_livekit` container exited (status 127).
- `.env` points `LIVEKIT_URL` at an external tunnel rather than the local server.

**What still needs to be supplied before re-attempting E2E:**
1. `npx playwright install chromium`
2. A running LiveKit server, e.g. `docker compose up -d livekit` with `LIVEKIT_URL=http://localhost:7880`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` matching the server container.
3. `npx prisma generate` and `npx prisma migrate deploy`.
4. A seeded, isolated test database and Playwright fixtures covering patient A/B, assigned/unassigned doctors, staff, confirmed online and in-clinic bookings.
5. No UI or app logic was changed for this attempted run.

## Commands to Run Later (not executed)

```bash
npx prisma generate
npx prisma migrate deploy
npm run test -- tests/utils/meeting.test.ts tests/utils/livekit-token.test.ts "tests/api/patient/session/[bookingId].get.test.ts" "tests/api/doctor/session/[bookingId].get.test.ts" "tests/api/doctor/session/[bookingId]/admit.post.test.ts" tests/api/session/termination.test.ts "tests/api/session/lobby/[meetingId].get.test.ts" tests/api/doctor/profile.test.ts
npm run test
npm run test:e2e -- tests/e2e/patient-dashboard.spec.ts
npx nuxt build
```

Manual staging checks:

1. Patient joins own confirmed online booking and waits in Lobby.
2. Doctor admits patient.
3. Patient leaves; old token reconnect is denied/removed; fresh lobby entry requires a fresh doctor admit.
4. Another patient/doctor/staff cannot enter or admit.
5. At exact appointment end, connected patient and doctor are forcibly disconnected; Join/token/admit remain blocked afterward.
6. Repeat termination/sweep; verify no cross-booking deletion.
7. Existing booking/payment/dashboard flows still work.

---

# Environment Fixes — 2026-11-08

## Files Changed

| Path | Change |
|---|---|
| `.env` | Set `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=false`. No other environment values were changed or printed. |
| `CHANGES.md` | Added this environment-fix report. |
| Prisma-managed database state | Recorded `0001_init` as the baseline migration and applied `0002_session_hardening`. Existing rows were preserved. |
| `node_modules/@prisma/client` | Regenerated with the current schema (generated output, not a tracked source change). |

No source files, application features, dependencies, ports, or container configurations were changed.

## Files Created

None in the repository. Temporary verification scripts were kept under `/tmp/opencode/` only.

## Files Deleted

None.

## Migration Status

- Before:
  - Migration files: `0001_init`, `0002_session_hardening`.
  - `_prisma_migrations` did not exist; both migrations were reported unapplied.
  - Tables already existed, and `prisma migrate diff` showed the live database matched the current schema except for the three `session_rooms` hardening columns and their index.
- Resolution:
  - Baseline: `0001_init` was recorded as applied using `prisma migrate resolve --applied 0001_init` because the existing schema already matched it. This preserved all data.
  - Applied: `npx prisma migrate deploy` applied only `0002_session_hardening`.
- After:
  - `0001_init` and `0002_session_hardening` are both recorded as finished and not rolled back.
  - `prisma migrate status` reports: `Database schema is up to date!`
  - `session_rooms` now includes `currentEntryId`, `admittedParticipantSid`, `terminatedAt`, and the `(expiresAt, terminatedAt)` index.

## Prisma Client

- `npx prisma generate` completed successfully with Prisma 5.22.0.
- Client generated to `./node_modules/@prisma/client`.
- No Prisma generation errors remain.

## Session Test Mode

- `.env` now explicitly sets `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=false`.
- `nuxt.config.ts` continues to read the flag into the deprecated no-op public config; no other configuration enables it.
- `.env.example` already contained `false`.

## Database and Application Operational Status

- PostgreSQL: `tawasul_postgres` running and healthy on host port `5433`.
- Database connectivity: Prisma connected and migration status is clean.
- Row counts before and after migration were unchanged: users 161, bookings 38, session_rooms 8, payments 27, doctors 120.
- Application: a clean `nuxt dev` process started successfully on port `3456` and returned HTTP 200 for `/`.
- No Prisma Client, migration, or startup initialization errors appeared in application logs.
- LiveKit container remains running and its local HTTP endpoint responds.

## Assumptions

- `0001_init` was baselined rather than executed because every table and constraint from that migration already existed, and the schema diff to the current Prisma model contained only the `0002_session_hardening` changes.
- Baseline was performed through the official `prisma migrate resolve` workflow; `_prisma_migrations` was not edited manually and no data was reset.

## Problem Encountered and Resolution

- The database had tables but no migration history. Running `migrate deploy` directly would have failed on `0001_init` with existing objects. Root cause was identified via `prisma migrate diff`; `0001_init` was baselined, then `0002_session_hardening` was applied normally. All existing records were preserved.

## Remaining Blocker

- `.env` sets `LIVEKIT_URL` to an external tunnel hostname that currently does not resolve. The app therefore logs `ENOTFOUND` errors from the session-termination startup sweep and browser-side LiveKit connections will fail. The local LiveKit server is running at `http://localhost:7880` / `ws://localhost:7880`. This was not changed because this task was limited to test mode and Prisma migration fixes.

---

# Local LiveKit Configuration — 2026-11-08

## LiveKit Container

- Docker Compose service: `livekit`
- Container: `tawasul_livekit`
- Image: `livekit/livekit-server:v1.13.7` (unchanged)
- Status: Running
- Published ports: `7880-7881/tcp`, `7882/udp`, `50000-50100/udp`
- Startup log confirms development mode, single-node routing, HTTP port 7880, RTC TCP 7881, ICE range 50000–50100.
- The service has no Docker healthcheck; availability was verified directly over HTTP and through the server API.

## Application Connection URL

- Previous value: external Cloudflare tunnel hostname (unresolved, caused `ENOTFOUND`)
- New value: `LIVEKIT_URL=ws://localhost:7880`
- Runtime determined to be the host (`nuxt dev`), so `localhost` is the correct target rather than the Docker service name.
- No other active references to the old tunnel hostname remain.

## API Credentials

- Container `LIVEKIT_KEYS` matches `.env` `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`.
- Server-side `RoomServiceClient.listRooms()` against `http://localhost:7880` succeeded (`LiveKit API OK; rooms: 0`).
- Credentials were not printed or changed.

## Application-to-LiveKit Verification

- LiveKit HTTP endpoint `http://localhost:7880/` returned HTTP 200.
- A clean `nuxt dev` start on port 3456 returned HTTP 200.
- Application startup logs contained no `ENOTFOUND` or DNS errors after the URL change.
- LiveKit logs show the application successfully calling `RoomService.DeleteRoom` against the local server during the startup termination sweep. The expected `not_found` responses for expired, non-existent rooms were handled by the application.
- No application features, authentication logic, or LiveKit versions were changed.

## Files Changed

| Path | Change |
|---|---|
| `.env` | Replaced the unresolved tunnel URL with `LIVEKIT_URL=ws://localhost:7880`. |
| `CHANGES.md` | Added this LiveKit configuration report. |

No files were created or deleted in the repository. Temporary verification scripts remain under `/tmp/opencode/` only.

## Problems Encountered and Resolutions

- The application was configured with a dead Cloudflare tunnel URL, producing `getaddrinfo ENOTFOUND` errors in the session-termination scheduler.
- Replaced the value with the local LiveKit endpoint after confirming the app runs on the host and the container publishes port 7880.
- Verified credentials by comparing the container's `LIVEKIT_KEYS` with `.env` without exposing secrets.

## Remaining Blockers

None for local LiveKit connectivity. No E2E, security, or application feature testing was started.

---

# Phase 1 Testing Infrastructure Fixes — 2026-11-08

## Files Changed (test-only)

| Path | Change |
|---|---|
| `tests/api/doctor/session/[bookingId]/admit.post.test.ts` | Rebuilt the LiveKit mock constructor in `beforeEach`; replaced per-test `vi.restoreAllMocks()` with a helper that restores only the `Date.now` spy. This prevents the hoisted mock constructor from being wiped between tests. Assertions unchanged. |
| `tests/api/patient/session/[bookingId].get.test.ts` | The token-lifetime assertion now uses `exp - nbf` instead of `exp - iat`; LiveKit JWTs include `nbf` but not `iat`. |
| `tests/utils/livekit-token.test.ts` | Same JWT claim correction for explicit and default TTL assertions. |
| `tests/utils/useTheme.test.ts` | Added `setAttribute`/`removeAttribute` to the mocked `documentElement`, matching the methods used by `useTheme`. |
| `tests/e2e/global-setup.ts` | Granted the E2E staff fixture the standard operational permissions, so the STAFF account reaches the authorized Admin Overview. No authorization logic changed. |

No application files, application configuration, schema, or migrations were modified.

## Test Results

- Focused Vitest run: 3 files, 35 tests passed.
- Full Vitest run (Node 22.23.1): 45 files, 304 tests passed, 0 failed.
- Authentication Playwright E2E: 10/10 passed.
- Full existing Playwright E2E: 50 passed, 6 failed.
- Remaining E2E failures are recorded in `TEST-REPORT.md`; one is Phase 1-relevant (join button near session time did not navigate to the session page).
- Phase 1 browser re-entry, forced-disconnect, session-isolation, real-LiveKit old-token, application-restart, and LiveKit-restart scenarios remain unverified.

---

# Patient Session Join Redirect Fix — 2026-11-08

## Root Cause
The patient session page (`pages/dashboard/session/[bookingId].vue`) mounted `useLiveKitSession` with an unconditional `RoomEvent.Disconnected` callback:

```ts
onDisconnected: () => {
  router.push('/dashboard/appointments')
}
```

During the initial LiveKit connection lifecycle, this callback could fire before the session route remained stable. As a result, clicking `Join Session` initially navigated to `/dashboard/session/{id}`, then the session page mounted and began token fetch/connection. An early or transient `Disconnected` event during initialization immediately redirected the browser back to `/dashboard/appointments`, causing Playwright's `waitForURL('/dashboard/session/{id}')` to time out.

This occurred without violating session eligibility: eligibility and authorization remained enforced by `canJoin`, the patient session API, and the server-side token route.

## Files Changed

| Path | Change |
|---|---|
| `pages/dashboard/session/[bookingId].vue` | Made the LiveKit `Disconnected` redirect conditional. The redirect only runs when `confirmedExit.value` is true or `loadingStage.value === 'ready'`. During initial connection, recoverable disconnection, or terminal connection failure, the route remains mounted so the page can show connection status and retry affordances. Explicit leave and genuine established-session disconnection behavior is preserved. |

## Files Created
None.

## Files Deleted
None.

## Assumptions
- `RoomEvent.Disconnected` during initial connection or recoverable interruption is not terminal and should not discard the mounted session route.
- A connection that has reached `ready` has successfully established; disconnecting from that state should preserve the existing redirect behavior.
- `confirmedExit` already tracks explicit user departure.
- LiveKit SDK behavior remains unchanged; no configuration was modified.

## Problem Encountered and Resolution
- Existing problem: the `join button ... opens the session page` Playwright test redirected back to appointment list before the test could observe `/dashboard/session/{bookingId}`.
- Root cause: the unconditional `onDisconnected` redirect annihilated the initial navigation when an early disconnection occurred.
- Fix: suppress automatic redirect until either the session is ready or the user explicitly leaves. Terminal connection failures still set `loadingStage = 'failed'` and remain on the page for retry.

## Tests Executed

Command:
```bash
npx playwright test tests/e2e/patient-dashboard.spec.ts -g "join button is active near session time and opens the session page"
```

Result:
- 1 passed.

Previously failing test status:
- PASSING after the fix.

## Tests Not Executed
No broader Playwright suite or Vitest suite was rerun for this fix. Existing focused verification from the previous change set already included:
- 45 Vitest test files / 304 tests.
- Authentication E2E: 10/10.
- Full existing Playwright suite baseline: 50 passed, 6 failed.

The remaining 5 Playwright failures were not addressed by this patient-session redirect fix.

## Remaining Issues
- The broader join-to-session flow has now passed in isolation, but existing Playwright tests intentionally assert other dashboard/calendar behaviors that still fail.
- Browser-level forced disconnect, session-isolation, and real-LiveKit old-token scenarios remain unverified.
- No claim of complete Phase 1 browser verification is made.

---

# Patient Session Join Redirect Fix — 2026-11-08 (Follow-Up)

## Files Changed
- `pages/dashboard/session/[bookingId].vue`: changed the LiveKit `RoomEvent.Disconnected` handler so automatic navigation only occurs for explicit departure (`confirmedExit.value`). Initial, recoverable, and terminal-without-confirmed-exit disconnections now remain on the session route and expose the existing error/retry UI instead of redirecting immediately.

## Files Created
None.

## Files Deleted
- `playwright.phase1.config.ts` (temporary test-only configuration, removed after verification).

## Assumptions
- `confirmedExit` reliably tracks intentional user departure.
- LiveKit emits `Reconnecting` for temporary interruptions, so suppressing all automatic `Disconnected` redirects keeps the session page mounted.

## Problem Encountered and Resolution
- The join button was visible/enabled and initially navigated, but an early `Disconnected` event redirected back to appointments before Playwright could observe the session route.
- Root cause: the unconditional redirect.
- Resolution: redirect only on confirmed departure.

## Tests Executed
Command:
```bash
npx playwright test tests/e2e/patient-dashboard.spec.ts -g "join button is active near session time and opens the session page"
```
Result: 1 passed.

Additional browser-level forced-disconnect, old-token, session-isolation, restart, and LiveKit-recovery scenarios remain unverified. No claim of complete Phase 1 browser coverage is made.

---

# Phase 1 Lifecycle Implementation — 2026-11-08

## Files Changed
| Path | Change |
|---|---|
| `composables/useLiveKitSession.ts` | On terminal `RoomEvent.Disconnected`, set `loadingStage = 'failed'` and a visible connection error before invoking the page callback. This exposes the existing retry UI instead of leaving a stale connected screen. |
| `pages/dashboard/session/[bookingId].vue` | The patient `onDisconnected` handler now navigates only when `confirmedExit` is true. Transient or terminal disconnects keep the session route open with the retry/error state. |
| `modules/doctor/pages/doctor/session/[bookingId].vue` | The doctor `onDisconnected` handler now navigates only when `confirmedExit` is true, matching the patient lifecycle while preserving explicit leave/end behavior. |

## Files Created
None.

## Files Deleted
- Temporary `playwright.phase1.config.ts` test-runner configuration (removed after verification; it contained a machine-specific Chrome path).

## Assumptions
- LiveKit emits `Reconnecting`/`Reconnected` for recoverable interruptions and `Disconnected` for terminal loss; auto-reconnect remains enabled.
- `confirmedExit` is the reliable signal for intentional departure.
- Existing retry UI (`loadingStage === 'failed'`) is the correct user-facing terminal state.

## Problems Encountered and Resolution
- Terminal LiveKit disconnects left pages mounted without a clear failure state; fixed by setting the existing failed/error state in the shared composable.
- Patient and doctor pages otherwise navigated away on transient disconnects; both now navigate only after confirmed departure.

## Tests Executed
- `npm run test` (Node 22.23.1): 303 passed, 1 failed.
  - Failure: `tests/api/booking/[id].patch.test.ts > allows the patient to keep their own current slot` — `This slot is no longer available`. This is unrelated to the lifecycle changes and is classified as a pre-existing fixture/availability issue.
- Focused Playwright join navigation test: passed on rerun (30.0s). First attempt timed out loading `/login`; categorized as environment flake.
- Full Playwright suite was not rerun after the lifecycle changes.

---

# Session Lifecycle Continuation — 2026-11-09

## Files Changed

| Path | Change |
|---|---|
| `tests/api/booking/[id].patch.test.ts` | Fixed confirmed fixture isolation defect. Fixture Saturdays now use a per-run far-future offset and skip public holidays, preventing collisions with persistent E2E/development bookings. Conflict assertions remain unchanged. |
| `composables/useLiveKitSession.ts` | On terminal LiveKit `Disconnected`, set the existing failed/error state so the current route shows retry/error UI instead of silently leaving or appearing connected. |
| `pages/dashboard/session/[bookingId].vue` | Automatic post-disconnect redirect now occurs only after confirmed departure; transient and terminal disconnects remain on the session route with retry/error UI. |
| `modules/doctor/pages/doctor/session/[bookingId].vue` | Doctor disconnect redirect now also occurs only after confirmed departure. |
| `TEST-REPORT.md` | Added final verification results, fixture-isolation investigation, and remaining unverified scenarios. |
| `Docs/phase-reports/phase-1-test-fixture-isolation.md` | Phase report for the fixture isolation fix. |
| `Docs/phase-reports/phase-2.md` | Scope review: no session-lifecycle Phase 2 exists; unrelated roadmap Phase 2 not started. |
| `Docs/phase-reports/phase-3.md` | Scope review: no session-lifecycle Phase 3 exists; unrelated roadmap Phase 3 not started. |
| `Docs/phase-reports/MANUAL-TESTING-CHECKLIST.md` | Human testing checklist for session lifecycle and recovery scenarios. |
| `Docs/phase-reports/FINAL-SUMMARY.md` | Overall completion and verification summary. |

## Files Created
- `Docs/phase-reports/phase-1-test-fixture-isolation.md`
- `Docs/phase-reports/phase-2.md`
- `Docs/phase-reports/phase-3.md`
- `Docs/phase-reports/MANUAL-TESTING-CHECKLIST.md`
- `Docs/phase-reports/FINAL-SUMMARY.md`

## Files Deleted
- Temporary `playwright.phase1.config.ts` (removed after test execution; contained a machine-specific browser path).

## Migrations
None in this continuation. Prior migration `0002_session_hardening` remains applied.

## Assumptions
- LiveKit emits `Reconnecting` for recoverable interruptions and `Disconnected` for terminal loss.
- `confirmedExit` is the reliable signal for intentional departure.
- Existing booking conflict validation must remain unchanged; only fixtures were adjusted.

## Problems Encountered and Resolved
- Booking fixture collision: leftover E2E booking on the fixed fixture date caused a false conflict. Fixed by per-run far-future dates and holiday skipping.
- Far-future fixtures could land on a public holiday: fixed with `isHoliday` filtering.
- Test page load occasionally timed out before hydration: a rerun passed; classified as environment flake.

## Test Commands and Results
```bash
npx vitest run "tests/api/booking/[id].patch.test.ts" -t "allows the patient to keep their own current slot"
# PASS (two consecutive runs)

npx vitest run "tests/api/booking/[id].patch.test.ts"
# PASS 6/6 (three consecutive runs after final fixture adjustment)

npm run test
# PASS 45 files / 304 tests
```

Playwright patient join test:
```bash
npx playwright test tests/e2e/patient-dashboard.spec.ts -g "join button is active near session time and opens the session page"
# PASS on rerun; an earlier attempt timed out loading /login (environment flake)
```

## Remaining Unverified
- Full Playwright suite after the latest lifecycle changes.
- Real-LiveKit old-token reconnect.
- Application restart with an active session.
- LiveKit restart with an active session.

---

# Main Booking Objective — Doctor-Based Booking + Payment Confirmation — 2026-11-09

## Implementation Summary
- Completed the Phase 2 prerequisite: default schedule cloning for new doctors and availability backfill for active doctors with none.
- Implemented Phase 3 doctor-based booking: active doctor listing, doctor selection, doctor-specific availability, server-side doctor validation/persistence, unified `/book`, homepage/dashboard links.
- Implemented Phase 4 payment-driven confirmation: online holds, automatic confirmation after verified payment, in-clinic immediate confirmation, amount/currency validation, idempotent webhooks, legacy doctorless admin remediation restriction.

## Files Changed

| Path | Change |
|---|---|
| `prisma/schema.prisma` | Added `Booking.holdExpiresAt` and `@@index([status, holdExpiresAt])`. |
| `prisma/migrations/0003_doctor_booking_foundation/migration.sql` | **New** additive migration for the hold field/index and active-doctor availability backfill. Applied locally. |
| `server/utils/availability.ts` | Doctor-scoped slots/dates, active holds, global blocked dates, blocked slots, active doctor/user filters, session duration in slot payload. Preserved optional all-doctor mode for existing callers. |
| `server/utils/validation.ts` | Added required `doctorId` to availability/create schemas and `sessionType` to booking creation. |
| `server/utils/booking-status.ts` | Rewritten successful-payment handling: amount/currency validation, advisory lock/idempotency, active hold/doctor/conflict checks, conditional confirmation, one-time confirmation emails. Failed payment behavior retained. |
| `server/api/public/doctors.get.ts` | **New** active-doctor public listing with safe fields. |
| `modules/booking/server/api/booking/available-dates.get.ts` | Requires/validates active `doctorId`; calls doctor-scoped availability. |
| `modules/booking/server/api/booking/available-slots.get.ts` | Requires/validates active `doctorId`; calls doctor-scoped availability. |
| `modules/booking/server/api/booking/create.post.ts` | Requires active doctor; advisory-locked transaction; doctor-specific slot; persists doctor; online hold/payment or in-clinic immediate confirmation; confirmation emails. |
| `modules/booking/server/api/booking/[id].patch.ts` | Same-day reschedule uses booked doctor's availability and active-hold conflict rules; legacy doctorless rows rejected for admin remediation. |
| `modules/booking/composables/types.ts` | Added public doctor, doctor/slot, session type, and booking response fields. |
| `modules/booking/composables/useBooking.ts` | Added doctors, selected doctor, session type, switching reset, doctor-scoped availability, doctorId/sessionType at creation. |
| `modules/booking/pages/book.vue` | Added doctor cards, doctor-first gate, session-type selection, review doctor/session details, query prefill after doctor selection. |
| `modules/booking/pages/booking/success.vue` | Shows confirmed vs pending, polls briefly for webhook confirmation, cleans up timer. |
| `modules/payment/server/api/payment/initiate.post.ts` | Rejects cancelled, doctorless, and already-confirmed bookings. |
| `modules/payment/server/api/payment/webhook.post.ts` | Extracts Paymob/Stripe amounts/currency, validates successful events, rejects amount/currency mismatches, supports nested Stripe/Paymob payloads. |
| `modules/payment/server/api/payment/dev/complete.get.ts` | Dev mock payment validates stored amount/currency before confirming. |
| `modules/booking/server/api/booking/[id]/cancel.patch.ts` | Patient cancellation refunds SUCCESS payments only. |
| `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts` | Admin assignment restricted to legacy doctorless PENDING bookings. |
| `modules/admin/server/api/admin/doctors/index.post.ts` | New doctors receive cloned active default availability. |
| `modules/patient/composables/usePatientDashboard.ts` | Availability calls accept/pass doctorId; inline flow availability no longer requests data without a doctor. |
| `pages/dashboard/appointments.vue` | Booking/date/calendar entry points now navigate to unified `/book`; reschedule passes the booked doctor. |
| `pages/index.vue` | Added active doctor cards linking to `/book?doctorId=...`. |
| `.env.example` | Documented `BOOKING_HOLD_MINUTES` (default 20). |
| `tests/api/booking/available-slots.get.test.ts` | Rewritten for doctor-specific slots, inactive doctor, missing doctorId, blocked date. |
| `tests/api/booking/available-dates.get.test.ts` | Rewritten for doctor-specific dates, missing/inactive doctor. |
| `tests/api/booking/create.post.test.ts` | Rewritten for doctor-required online/in-clinic/inactive-doctor flows. |
| `tests/api/booking/date-handling.test.ts` | Updated to create/use a doctor and pass doctorId. |
| `tests/api/booking/[id].patch.test.ts` | Updated fixtures to doctor-linked bookings; conflict/ownership/cancel assertions preserved. |
| `tests/api/public/doctors.get.test.ts` | **New** active/inactive doctor listing and safe-field tests. |
| `tests/api/payment/webhook.post.test.ts` | Rewritten for automatic confirmation, idempotency, amount mismatch, failed payment, valid/invalid signatures. |
| `TEST-REPORT.md` | Updated with implementation status and unexecuted verification. |
| `Docs/phase-reports/phase-2-prerequisites.md` | **New** phase report. |
| `Docs/phase-reports/phase-3-doctor-booking.md` | **New** phase report. |
| `Docs/phase-reports/phase-4-payment-confirmation.md` | **New** phase report. |
| `Docs/phase-reports/MANUAL-TESTING-CHECKLIST.md` | Added complete doctor-selection/payment journey and recovery checks. |
| `Docs/phase-reports/FINAL-SUMMARY.md` | Replaced with current implementation/verification summary. |
| `Docs/phase-reports/phase-2.md`, `phase-3.md` | Added addenda pointing to implemented roadmap phases. |

## Files Created
- `prisma/migrations/0003_doctor_booking_foundation/migration.sql`
- `server/api/public/doctors.get.ts`
- `tests/api/public/doctors.get.test.ts`
- `Docs/phase-reports/phase-2-prerequisites.md`
- `Docs/phase-reports/phase-3-doctor-booking.md`
- `Docs/phase-reports/phase-4-payment-confirmation.md`

## Files Deleted
None.

## Migration
- `0003_doctor_booking_foundation` applied successfully to local development DB.
- `prisma migrate deploy` succeeded; `prisma migrate status` reports schema up to date.
- `prisma generate` completed successfully.
- Backfill verification: active doctors with zero availability = 0.
- No rows were deleted or reset; no destructive SQL.

## Tests Executed
None after these changes. The task explicitly prohibited builds, full suites, and browser verification without approval.
Pre-change baseline: full Vitest 45 files / 304 tests passed.
Tests were added/updated but not executed.

## Assumptions
- Local development database is the target.
- `BOOKING_HOLD_MINUTES` is optional and defaults to 20, clamped 5–60.
- Legacy doctorless PENDING bookings remain admin-remediation only.
- Paymob/Stripe payload extraction covers the common top-level/nested shapes; provider-specific HMAC field semantics remain to be validated against live gateways.

## Problems Encountered / Resolved
- The project had admin-schedule availability competing with doctor availability; patient endpoints now use doctor-specific availability.
- Existing tests assumed admin-schedule/doctorless bookings; relevant tests were updated, but not executed.
- No automation run was allowed after implementation, so compile/runtime verification remains outstanding.

## Remaining Risks
- No automated execution evidence for the new booking/payment code.
- Real payment gateway webhook semantics, amount/currency normalization, and refund reconciliation are unverified.
- Hold expiry/late success reconciliation is implemented conservatively but unverified.
- Full E2E and real LiveKit recovery remain unverified.
- Admin UI still contains legacy pending/assignment surfaces; backend restricts assignment to doctorless legacy rows.

## Verification Commands Prepared
```bash
npm run test -- tests/api/public/doctors.get.test.ts tests/api/booking/available-slots.get.test.ts tests/api/booking/available-dates.get.test.ts tests/api/booking/create.post.test.ts "tests/api/booking/[id].patch.test.ts" tests/api/payment/webhook.post.test.ts
npm run test
```
No command above was executed.

## Additional Files Touched
- `components/patient-calendar.vue` — reschedule availability calls now pass the appointment's `doctorId`.
- `Docs/Implementation-Roadmap/phases/PHASE-03-doctor-booking-foundation.md` — implementation-status note added.
- `Docs/Implementation-Roadmap/phases/PHASE-04-payment-confirmation-lifecycle.md` — implementation-status note added.
- `Docs/phase-reports/phase-2.md`, `phase-3.md` — addenda linking the now-implemented roadmap phases.

All new booking/payment tests remain **NOT EXECUTED**.

---

# Doctor-Based Booking Completion Fixes — 2026-11-09

## Files Changed
- `server/utils/availability.ts`: Doctor-scoped slot availability excluding the booking being rescheduled, active holds, and global blocked dates.
- `modules/booking/server/api/booking/[id].patch.ts`: Reschedule uses the booked doctor's availability; self-slot exclusion keeps a patient on their current slot; conflict checks consider active holds.
- `server/utils/booking-status.ts`: Payment slot locks are keyed to the doctor/date/start, with amount/currency validation.
- `Docs/phase-reports/phase-3-doctor-booking.md`: Implementation note remains pending automated verification.

## Verification
No builds, automated tests, or browser verification were run because test execution was not approved in this phase.

---

# Doctor Booking + Payment Verification — 2026-11-09

## Files Changed
| Path | Change |
|---|---|
| `server/api/public/doctors.get.ts` | Added server-side pagination (default/capped 12), stable ordering, `items/page/pageSize/total/totalPages`, retained `doctors` alias. |
| `modules/booking/composables/useBooking.ts` | Added doctor pagination state, stale-request protection, page navigation that clears selected doctor/dependent selections. |
| `modules/booking/pages/book.vue` | 4/2/1 responsive doctor grid, loading/empty/error states, pagination controls, page-size 12, doctor switch clears selected day/slots. |
| `pages/index.vue` | Homepage doctor cards limited to first 12; supports paginated API shape. |
| `server/utils/availability.ts` | Excludes the booking being rescheduled from slot occupancy; defensive global-blocked fallback; doctor-scoped availability. |
| `modules/booking/server/api/booking/[id].patch.ts` | Passes the current booking id when validating its own reschedule slot. |
| `modules/payment/server/api/payment/webhook.post.ts` | Official Paymob field-order HMAC verification (timing-safe), supports `obj`/nested payloads, query/header HMAC, amount/currency rejection. |
| `tests/api/public/doctors.get.test.ts` | Added pagination, page-size cap, non-overlap, out-of-range, inactive/user-inactive coverage. |
| `tests/api/payment/webhook.post.test.ts` | Official HMAC payloads, currency, unknown booking, concurrent duplicate, amount-locking, Stripe coverage. |
| `tests/e2e/booking-doctor-selection.spec.ts` | **New** browser coverage: grid/pagination, 4/2/1 responsive layout, doctor select/switch, online mock-payment confirmation, in-clinic confirmation. |
| `tests/utils/availability.test.ts` | Test mocks handled missing global-blocked collection. |
| `modules/booking/server/api/booking/holidays.get.ts` | Uses month/year schema instead of doctor-required availability schema. |
| `server/utils/validation.ts` | Added separate `monthYearQuerySchema`; availability/create schemas remain doctor-required. |
| `TEST-REPORT.md`, phase reports | Updated with executed results and remaining risks. |

## Defects Found and Fixed
1. **Current-slot reschedule false conflict** — `getAvailableSlots` counted the booking being rescheduled; current booking id is now excluded.
2. **Holiday API 400** — holiday endpoint shared the doctor-required schema; split month/year validation.
3. **Payment HMAC not provider-official** — Paymob now uses its documented field-order HMAC, timing-safe comparison, and nested/header/query HMAC support.
4. **Availability test mocking** — `globalBlockedDate` missing in mocks; defensive fallback added.
5. **Webhook test isolation** — distinct dates per test prevent active-hold collisions.

## Tests Executed
Focused API:
```bash
npx vitest run tests/api/public/doctors.get.test.ts tests/api/booking/available-slots.get.test.ts tests/api/booking/available-dates.get.test.ts tests/api/booking/create.post.test.ts "tests/api/booking/[id].patch.test.ts" tests/api/payment/webhook.post.test.ts
# 36 passed / 0 failed
```
Full Vitest:
```bash
npm run test
# 46 files passed / 312 tests passed / 0 failed
```
Playwright:
```bash
npx playwright test tests/e2e/auth.spec.ts tests/e2e/booking-doctor-selection.spec.ts
# 13 passed initially; then additional journey/switch tests:
npx playwright test tests/e2e/booking-doctor-selection.spec.ts -g "Doctor booking journey"
# 2 passed
npx playwright test tests/e2e/booking-doctor-selection.spec.ts -g "switching doctors clears"
# 1 passed
```
Total Playwright verification: **16 passed / 0 failed**.

## Migration
- `0003_doctor_booking_foundation` was already applied; not reapplied.
- Schema up to date; Prisma Client generated previously.

## Remaining Unverified
- Real Paymob/Stripe sandbox transactions and live signature delivery.
- Hold expiry and late-payment reconciliation.
- Full legacy Playwright suite (calendar/admin known failures) after the booking refactor.
- Real LiveKit old-token reconnect and restart recovery.

---

# Session Join Mode Setting — 2026-11-16

## Implemented
- Added persisted, admin-only `Settings.sessionJoinMode` enum (`PRODUCTION` | `TEST`, default `PRODUCTION`) with additive migration `prisma/migrations/0004_session_join_mode/migration.sql` (**not applied**).
- Canonical client-safe rules in `lib/session-join.ts`; server gate in `server/utils/session-join-mode.ts` falls back to `PRODUCTION` on missing/invalid/error. `server/utils/meeting.ts` now delegates to the canonical helper.
- Patient/doctor token endpoints, doctor admit, and meeting lobby use the canonical gate. TEST mode skips only the clock check; ownership, CONFIRMED/ONLINE, identity/SID admission and token authorization are unchanged. TEST tokens use a fixed 1-hour TTL and room expiry.
- Added authenticated read-only `GET /api/session/join-mode` returning only `{ mode }`.
- Admin settings GET/PATCH, validation, types, and UI expose the mode with an explicit save action and a TEST-mode security warning.
- Patient/doctor Join buttons use the server-provided mode with the same canonical predicate.

## Verification
- SFC parse/template compile OK for changed Vue files.
- Added `tests/utils/session-join.test.ts` (pure) and admin authorization cases in `tests/api/admin/settings.test.ts`.
- **Not run:** Vitest/Playwright/build (DB and browser checks not authorized); migration not applied; Prisma Client not regenerated.
- LiveKit verification was read-only: no containers were present (`docker ps -a` empty) and `localhost:7880` was not listening; application connectivity therefore Unverified. No container was started or changed.

## Open decisions
- "ADMIN" mapped to STAFF holding `SETTINGS:READ`/`UPDATE` (project has no ADMIN account type).
- No reliable production detector was added; TEST mode must be governed operationally.
- Setting is inert until migration `0004` is applied and Prisma Client regenerated.

---

# Admin-only session mode / local LiveKit — 2026-11-16 (BLOCKED)

- **Blocker:** `prisma/schema.prisma:198-202` `AccountType` has only `PATIENT`, `DOCTOR`, `STAFF`; there is no `ADMIN` role. Per instruction, no silent mapping ADMIN→STAFF was made. ADMIN-only read/update could not be implemented; product decision required (new role vs. documented seed-admin identity).
- Migration `0004_session_join_mode` is the only pending migration (`prisma migrate status`), target is local `tawasul_db` at `localhost:5433`. **Not applied**: doing so would activate the feature while its API still permits STAFF with SETTINGS permissions, the exact gap this task forbids.
- LiveKit: `docker compose up -d livekit` started the documented `tawasul_livekit` container (image pulled by compose). Verified container running, `localhost:7880` HTTP 200, and server-side `RoomServiceClient.listRooms()` OK (rooms=0) using app config without printing secrets. App `/api/health` returned `{"status":"ok"}` (HTTP 200).
- No files besides this CHANGES.md record were changed for this task; no DB writes, no commits/pushes/deploys.

---

# ADMIN role + ADMIN-only Session Join Mode — 2026-11-16

Supersedes the previous "no ADMIN role" blocker.

## Implemented
- Added `ADMIN` to the Prisma `AccountType` enum with additive migration `prisma/migrations/0005_admin_account_role` (no existing STAFF user was bulk-migrated).
- `server/utils/auth.ts` adds `requireAdmin`; `requirePermission` now accepts `STAFF | ADMIN` and lets `ADMIN` bypass the STAFF permission table. STAFF behaviour is otherwise unchanged.
- Seed admin (identified only by the existing `SEED_ADMIN_EMAIL`) is created/updated as `ADMIN`; the designated local seed admin was promoted (1 record) without printing identity or credentials.
- Session Join Mode is ADMIN-only:
  - New `GET/PATCH /api/admin/session-join-mode` use `requireAdmin`.
  - General `GET /api/admin/settings` omits `sessionJoinMode` for non-ADMIN; `PATCH` rejects `sessionJoinMode` from non-ADMIN with 403.
  - Admin UI card is rendered only for `ADMIN`, warns about TEST mode, and requires an explicit save.
- Removed the non-admin `/api/session/join-mode` mode read. Patient/doctor Join buttons now use server-computed `/api/session/join-eligibility` (per-booking `canJoin`/`reason`), so non-admins never receive the setting. The token endpoints remain authoritative.
- ADMIN integrated into login session type, route middleware, admin navigation/overview, and meeting layout back-links.
- Safe default remains `PRODUCTION`; invalid/missing values fall back to `PRODUCTION`.

## Database/migrations
- Verified local target (`tawasul_db` at `localhost:5433`), then applied `0004_session_join_mode` and `0005_admin_account_role` via `prisma migrate deploy`; `prisma generate` completed; `prisma migrate status` reports schema up to date.
- Persisted mode after verification: `PRODUCTION`.

## Verification
- Unit: `vitest run tests/utils/session-join.test.ts tests/utils/meeting.test.ts tests/utils/permissions.test.ts tests/utils/auth.test.ts` — **49 passed**.
- Live HTTP role probes (ADMIN/STAFF/DOCTOR/PATIENT): ADMIN mode read/write 200; STAFF/DOCTOR/PATIENT 403; STAFF general settings 200 without `sessionJoinMode`; eligibility 200 only for patient/doctor and contains no mode.
- Playwright against localhost:3000 — **25/25 passed**: ADMIN sees/edits/saves the card, TEST warning, persistence after reload, restore to PRODUCTION; STAFF sees no card and is denied APIs; DOCTOR/PATIENT cannot reach the admin page and are denied APIs.
- LiveKit unchanged: `tawasul_livekit` running, HTTP 200, SDK `listRooms` OK (0 rooms), app health 200. No restart/reconfigure.
- Not run: DB-mutating API suites added for ADMIN authorization and TEST-mode security, `nuxt build`, and typecheck. A local Nuxt dev restart was required to load the regenerated Prisma Client.
