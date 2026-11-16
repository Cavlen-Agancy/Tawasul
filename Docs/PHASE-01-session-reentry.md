# Phase 1 — Session Re-entry & LiveKit Access Control

**Status:** Hardened code, a new SessionRoom migration (not executed), and focused tests are written. **Unverified** — no migration, `prisma generate`, build, automated test, browser, container, or manual staging run has been executed.  
**Authoritative detailed scope:** [`Implementation-Roadmap/phases/PHASE-01-session-reentry.md`](Implementation-Roadmap/phases/PHASE-01-session-reentry.md).

## Implemented Behavior

- Patient must own the booking and be active; booking must be `CONFIRMED` and `ONLINE`.
- Doctor must be assigned to the booking and both doctor/user must be active.
- Staff receive no patient/doctor session token and cannot admit participants.
- Doctor admission accepts only the booking patient's **current server-side entry** identity; it verifies the LiveKit participant SID before granting media permissions.
- Each patient token request rotates `SessionRoom.currentEntryId` and clears `admittedParticipantSid`. The LiveKit identity is `userId:entryId`.
- An old token that reconnects gets a new LiveKit SID; admission is denied and the participant is removed. A fresh lobby entry is required.
- Admission persistence is conditional on the same current entry and admitted SID, so a lobby entry that rotates mid-admission cannot be admitted by a stale request.
- After granting media, the admit route re-lists participants and revokes the grant if the LiveKit SID changed, closing the reconnect-during-grant window.
- Duplicate LiveKit connections for the same identity are rejected and removed rather than admitted.
- Session window opens 5 minutes before start and closes at the exact appointment end; no +15-minute grace.
- LiveKit token TTL equals the remaining appointment window; token expiry does not outlive the session.
- Patient tokens remain `member` with `canPublish=false`/`canSubscribe=false` until doctor admission.
- `/dashboard/session/[bookingId]` remains the canonical patient lobby; `/meeting/[meetingId]/lobby` delegates patients/doctors to the canonical session route and blocks staff.
- At the exact appointment end, a server-side scheduler calls LiveKit `RoomServiceClient.deleteRoom`, forcibly disconnecting any connected patient/doctor even if the browser stays open.
- `SessionRoom.terminatedAt` makes termination idempotent. A Nitro startup plugin sweeps expired un-terminated rooms and re-arms active rooms after restart; a 30-second fallback sweep handles missed/transient failures.
- `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE` is retained as a deprecated no-op; it no longer bypasses ownership, identity, entry, status, admission, or time checks.

## Database

`SessionRoom` adds:

- `currentEntryId String?`
- `admittedParticipantSid String?`
- `terminatedAt DateTime?`
- `@@index([expiresAt, terminatedAt])`

Migration: `prisma/migrations/0002_session_hardening/migration.sql` (authored, not executed). Runtime verification requires `npx prisma generate` and applying this migration.

## Scheduling Reliability

There is no external job system. The implementation uses:

1. an in-process exact `setTimeout` per room (scheduled from token/doctor room access);
2. a Nitro startup recovery that sweeps expired rooms and re-arms future active rooms;
3. a 30-second fallback sweep.

This fits the current single-app-container production compose. Multiple app instances each run the idempotent sweeper; termination is scoped by both `bookingId` and exact `roomName`, so one appointment cannot delete another room. Timers re-check the wall clock and chain delays above Node's maximum timer value. When `ensureSessionRoom` detects a changed appointment end (reschedule), it clears the old termination/admission state and re-arms termination; the termination write is scoped by the observed `expiresAt`, so an in-flight old termination cannot mark the new end. After a restart, an expired room may be terminated up to the sweep interval late; token expiry still blocks new connections.

## Verification Status

- Code implemented.
- Focused tests added/updated (see root `CHANGES.md`) but **not executed**.
- Migration not applied; Prisma client not regenerated.
- Manual two-browser re-entry, old-token reconnect, and exact-end forced-disconnect drills pending.
- Phase 1 must not be marked complete until approved tests and manual checks pass.
- Playwright E2E attempt on 2026-11-08 was BLOCKED: missing Chromium binary, no running LiveKit server, and no generated Prisma client/migration for the hardening schema. See root `CHANGES.md`.

## Residual Risks

- An old token can still connect to the LiveKit waiting room until its JWT expires; it has no media permissions and is rejected/removed when admission is attempted. A future LiveKit webhook/revocation layer could remove it proactively.
- The in-process scheduler is single-instance-oriented; multi-instance scaling relies on the idempotent startup/periodic sweeper.
- No external durable job queue exists for exact termination after a restart beyond the startup sweep/interval.
