# Phase 1 — Session Re-entry & Join-Window Enforcement

**Requirement:** D — Patient Session Re-entry.  
**Priority rationale:** Security Risk 5, Business Impact 5, UX Severity 5, Technical Risk 2. This is an isolated access-control boundary; doing it first reduces privacy risk without waiting for the booking redesign.  
**Implementation status (2026-11-08):** Hardened code, a new `SessionRoom` migration (not executed), and focused tests have been written, but **no migration, prisma generate, test, build, browser, container, or manual staging run has been executed**. The phase is therefore **implemented but unverified**, not complete. Manual two-browser re-entry, old-token, and exact-end termination drills remain required.

## 1. Business Objective

Allow a patient to leave and re-enter the waiting lobby repeatedly **before the appointment end**, with the doctor required to admit them each time. At or after the end time, neither the patient nor the doctor may join. All checks must be enforced by the server, not only by hiding buttons.

## 2. Scope

Included:

- Change the shared meeting window from end + 15 minutes to exact appointment end.
- Keep the existing patient waiting room at `/dashboard/session/[bookingId]` as the canonical waiting lobby.
- Support repeated token issuance/re-entry within the window.
- Require doctor admission on every new patient connection.
- Bound LiveKit token lifetime to the remaining appointment window.
- Add server-side time-window and identity checks to doctor admission.
- Make the unused `/meeting/[meetingId]/lobby` page either delegate to the canonical route or become a functional pre-lobby; no second video implementation.
- Update all UI copy/button windows and existing tests.

Out of scope:

- Booking redesign or auto-confirmation (Phases 3–4).
- Doctor dashboard simplification (Phase 2).
- LiveKit recording, TURN configuration, or new vendor.
- Changing the patient session page visual redesign.
- Email verification.

## 3. Prerequisites

- Read `00-current-system-analysis.md` sections 6–7.
- Existing booking/session flows work as inspected (no runtime verification required to plan).
- Apply `prisma/migrations/0002_session_hardening` and run `prisma generate` before runtime verification; neither was executed in this task.
- No new dependency.

## 4. Current Implementation Facts to Preserve

- `server/utils/meeting.ts` is the shared window authority.
- Patient token: `canPublish: false`, `canSubscribe: false`; doctor token: moderator.
- Patient page waits for a permission change; doctor admits through `updateParticipant`.
- `GET /api/patient/session/:bookingId` and doctor equivalent enforce ownership and status.
- `SessionRoom` is upserted on first access; DB `expiresAt` is not used for authorization.
- `/dashboard/session/[bookingId]` already contains the waiting-room UI and doctor-admit transition. **CONFIRMED.**
- `/meeting/[meetingId]/lobby` is a stub: its `onJoin` only sets a timeout. **CONFIRMED.**

## 5. Implementation Tasks

### Task 1: Make the shared window close at the exact end

**Files:**
- Modify: `server/utils/meeting.ts`
- Modify: `tests/utils/meeting.test.ts`

Changes:

- Remove the `MEETING_CLOSE_LATE_MIN = 15` semantic (keep a deprecated `0` export only if other imports require it).
- Set `closeAt = sessionEnd.getTime()`.
- Change `canJoinMeetingAt` to `nowMs < closeAt` (or `<=` only if the product explicitly defines “at end” as inclusive; requirement says at or after end is not available, so use `<`).
- Preserve `MEETING_OPEN_EARLY_MIN = 5`.
- Remove unused imports if the helper only needs local-date reconstruction.

Acceptance details:

- Booking `10:00–11:00`: token allowed at `10:59:59`; denied at exactly `11:00:00`.
- Existing date/UTC-midnight handling must remain unchanged.

### Task 2: Bound token lifetime to the appointment window

**Files:**
- Modify: `server/utils/livekit-token.ts`
- Modify: `modules/patient/server/api/patient/session/[bookingId].get.ts`
- Modify: `modules/doctor/server/api/doctor/session/[bookingId].get.ts`

Changes:

- Add an optional `ttlSeconds?: number` to `LiveKitTokenPayload`.
- In `generateLiveKitToken`, use the supplied positive TTL; keep 3600 seconds as the default for direct callers.
- In both session APIs, calculate `remainingSeconds = Math.floor((closeAt - Date.now()) / 1000)` and pass it so the token expires at the appointment end.
- If `remainingSeconds < 1`, reject with `403` before calling LiveKit (defense in depth; `canJoinMeetingAt` should already reject).
- Return `expiresAt: new Date(closeAt).toISOString()` to the client so the session pages can schedule an automatic leave at the end.
- Keep `SessionRoom.expiresAt = new Date(closeAt)` and update it on each successful token request via `ensureSessionRoom`; never treat it as the authorization source.
- Each **patient** token request generates a fresh `currentEntryId` and clears `admittedParticipantSid`. The LiveKit identity is `userId:entryId`; the previous entry becomes stale server-side.
- Doctor token/room access does not rotate the patient's entry.
- Do not change the token grant model: patient remains `member` (no publish/subscribe); doctor remains `moderator`.

Acceptance details:

- A token requested at 10:58 for a 10:00–11:00 session has TTL <= 120 seconds.
- A token requested near the end cannot outlive the appointment end; below 1 second remaining the request is rejected.
- Existing client `liveKitUrl` configuration is unchanged.

### Task 3: Harden doctor admission

**Files:**
- Modify: `modules/doctor/server/api/doctor/session/[bookingId]/admit.post.ts`

Changes:

- After resolving the doctor and booking, reject unless:
  - booking exists and has a `sessionRoom`;
  - `booking.doctorId === doctor.id`;
  - `booking.status === 'CONFIRMED'` and `sessionType === 'ONLINE'`;
  - the doctor/user and patient are active;
  - the exact appointment window is open;
  - supplied identity parses to the booking patient and matches `sessionRoom.currentEntryId`.
- Query `RoomServiceClient.listParticipants(room)` and require exactly one participant with the exact identity; store/examine its LiveKit SID. Multiple connections for the same identity are rejected and removed.
- If `admittedParticipantSid` exists and differs from the current SID, reject and remove the reconnected old-token participant. This is the server-side re-entry gate.
- If the entry is stale, remove the participant and reject.
- If no participant is in the room, return `409`.
- On first admission, grant permissions, then re-list participants and verify the same SID still has the identity; if it changed, revoke and return `409`. Then persist `admittedParticipantSid` with a conditional update requiring the same `currentEntryId` and an empty or identical admitted SID. If the condition fails (lobby entry rotated mid-flight), revoke and return `409`; on a database error, revoke and return `500`.
- Duplicate admission for the same current SID is idempotent.
- Keep the `updateParticipant` grant (`canPublish`, `canSubscribe`, `canPublishData`, `hidden: false`, `recorder: false`).

Acceptance details:

- Wrong doctor → 403 before LiveKit mutation.
- Correct doctor at exact end/after → 403, no admission.
- Correct doctor inside window with current identity/SID → success.
- Wrong/stale entry or different patient → 403 and participant removed.
- Reconnect with the same old token creates a new SID; admission is denied and participant removed until a fresh lobby entry is issued.
- If the entry rotates while an admission request is in flight, the conditional persist fails, permissions are revoked, and the request returns `409`.
- If the participant reconnects between the SID check and the grant, the post-grant re-list detects the changed SID, revokes the grant, and returns `409`.
- Duplicate connections for the same identity are rejected and removed.
- Duplicate admission of the same SID is safe.

### Task 4: Canonical patient lobby and re-entry UI

**Files:**
- Modify: `pages/dashboard/appointments.vue`
- Modify: `pages/dashboard/session/[bookingId].vue`
- Modify: `modules/doctor/pages/doctor/calendar.vue`
- Modify: `pages/meeting/[meetingId]/lobby.vue`
- Modify: `composables/useSessionI18n.ts`
- Modify if needed: `modules/patient/composables/usePatientDashboard.ts` (join-related state only)

Changes:

- Patient dashboard `canJoin` must open 5 minutes before start and close at `endTime` (no +15).
- Doctor calendar `canJoinBooking` must use the same rule.
- Update copy in `pages/dashboard/appointments.vue`, `pages/meeting/[meetingId]/lobby.vue`, and session i18n strings from “up to 15 minutes after it ends” to “until the session ends”.
- Keep patient Join → `/dashboard/session/:bookingId`; this page is the waiting lobby.
- Make `/meeting/[meetingId]/lobby` delegate correctly:
  - On a successful `fetchMeeting`, if `meeting.canJoin` and the user presses Join, navigate to:
    - `/dashboard/session/${meetingId}` for `role === 'patient'`
    - `/doctor/session/${meetingId}` for `role === 'doctor'`
  - If `role === 'staff'`, show an explicit unsupported state; staff receive no session token and cannot join the video room.
  - The lobby API returns `canJoin: false` for staff; the Join control must never appear for staff.
  - Do not leave a timeout-only Join button.
- Add an explicit note/comments that re-entry is a fresh token + lobby cycle; no client “already joined” state may bypass the lobby.
- Use the server-provided `expiresAt` to schedule a client-side leave at the exact appointment end on both patient and doctor session pages. This is a UX complement to the server token TTL, not a security boundary.
- Ensure leaving the session page does not set any persistent “admitted” flag.

Acceptance details:

- At 1:00–1:30, patient joins, leaves, returns before 2:00; they appear again in the doctor waiting list and require admission again.
- At 2:00 or later, the dashboard Join button is disabled and a direct navigation to the session page returns a server error state.
- No access to another patient's session via URL.

### Task 4a: Force appointment-end disconnection and recover after restarts

**Files:**
- Add: `server/utils/session-termination.ts`
- Add: `server/plugins/session-termination.ts`
- Modify: `server/utils/session-room.ts`
- Modify: `prisma/schema.prisma`
- Add: `prisma/migrations/0002_session_hardening/migration.sql` (not executed)

Changes:

- `ensureSessionRoom` schedules an exact per-room termination timer and stores durable `expiresAt`/`terminatedAt`.
- `terminateSessionRoom` calls LiveKit `RoomServiceClient.deleteRoom`, scoped by both `bookingId` and exact `roomName`, and records `terminatedAt`. Repeated calls are no-ops. The write is scoped by the observed `expiresAt`, so an in-flight termination cannot mark a later rescheduled end as terminated. A missing LiveKit room is treated as already terminated; transient failures leave `terminatedAt` null for retry.
- A Nitro startup plugin runs a startup recovery: sweeps expired un-terminated rooms and re-arms timers for future active rooms. This covers app restarts and missed timer execution.
- A 30-second fallback sweep catches expired rooms after transient failures or missed executions.
- The process is single-instance-oriented (current production compose has one app container). Multiple instances would each run the idempotent sweeper; no cross-booking deletion is possible because both `bookingId` and `roomName` are checked.
- No new dependency or external job system is introduced.

Acceptance details:

- At the exact end, the LiveKit room is deleted, disconnecting patient and doctor even if the browser stays open.
- Repeated or delayed termination is safe and cannot delete another booking's room.
- After an app restart, expired un-terminated rooms are swept and future active rooms are re-armed.
- LiveKit transient failure does not mark the room terminated; the next sweep retries.
- Timers re-check the wall clock and chain delays above Node's maximum timer value; a long wait cannot fire early.
- When `ensureSessionRoom` observes a changed appointment end, it clears `terminatedAt`/admission state and re-arms termination for the new end. The termination write is scoped by the observed `expiresAt`, so an old in-flight termination cannot mark the new end.

### Task 5: Remove test-mode authorization bypasses

**Files:**
- Modify: `modules/patient/server/api/patient/session/[bookingId].get.ts`
- Modify: `modules/doctor/server/api/doctor/session/[bookingId].get.ts`
- Modify: `pages/dashboard/appointments.vue`
- Modify: `modules/doctor/pages/doctor/calendar.vue`
- `nuxt.config.ts` retains `enableSessionTestMode` only as a deprecated no-op for environment compatibility.

Changes:

- **No test-mode bypass remains.** Both session routes always enforce authentication, booking ownership, role, booking status, online/in-clinic type, active accounts, participant identity, and the appointment window.
- Remove the server-side `sessionTestMode` conditions and the client-side early-join/test-mode banners.
- `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE` has no effect on session authorization. It is not read by the session routes or calendars.
- Keep test infrastructure that does not weaken authorization (fixtures, mocks, local test credentials).

Acceptance details:

- Development/test mode cannot admit a user, bypass ownership, bypass participant identity, or open the window early.
- The hidden `enableSessionTestMode` config value is a no-op; production and development use the same access rules.

## 6. Expected Database Changes

`SessionRoom` gains:

- `currentEntryId String?` — current patient lobby entry generation.
- `admittedParticipantSid String?` — LiveKit participant SID admitted for the current entry.
- `terminatedAt DateTime?` — idempotent appointment-end termination marker.
- `@@index([expiresAt, terminatedAt])`.

Migration `prisma/migrations/0002_session_hardening/migration.sql` is authored but **not executed**. Existing rows stay compatible (nullable fields). `prisma generate` and migration execution are required before runtime verification.

## 7. Expected API Changes

| Endpoint | Change |
|---|---|
| `GET /api/patient/session/:bookingId` | Close at end; token TTL = remaining window; rotate `currentEntryId`, clear `admittedParticipantSid`, return `expiresAt`; composite identity `userId:entryId`. |
| `GET /api/doctor/session/:bookingId` | Same window/TTL/`expiresAt`; doctor access does not rotate the patient's entry. |
| `POST /api/doctor/session/:bookingId/admit` | Reject outside window, non-confirmed/in-clinic, wrong doctor/patient/entry; verify LiveKit participant SID; persist admission; reject and remove old-token reconnects. |
| `GET /api/meeting/lobby/:meetingId` | Uses shared end-time rule; staff/in-clinic `canJoin=false`; returns `sessionType`. |
| Internal `terminateSessionRoom` | Deletes the exact LiveKit room at appointment end and records `terminatedAt`; idempotent. |

Request/response shapes are additive (`expiresAt`, `sessionType`); existing clients remain compatible.

## 8. UI/UX Considerations

- Show the patient the exact join window: “Available 5 minutes before the session and until it ends.”
- After leaving, the patient returns to the calendar and the Join button remains available until the end.
- The doctor’s waiting list must show a re-entered patient again. Avoid any “already admitted” UI state that persists across page reloads.
- Explain that re-entry requires admission again; do not promise automatic re-admission.
- Preserve existing loading, error, and retry states on the session page.
- Staff-facing `/meeting` page must not imply it can join a video call if that capability is not implemented.

## 9. Acceptance Criteria

1. Patient can join and leave repeatedly before the appointment end.
2. Every re-entry uses a fresh token and the waiting lobby.
3. Doctor must explicitly admit the patient on every re-entry.
4. The server rejects token issuance at or after the appointment end.
5. The doctor admit endpoint rejects outside the window and for a mismatched participant identity.
6. Patient cannot access another patient's booking/session.
7. Doctor cannot access another doctor's session.
8. Patient token cannot publish/subscribe until admission; the existing permission model is preserved.
9. A token's TTL cannot exceed the remaining appointment window.
10. `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE` does not bypass ownership, identity, status, or the time window in any environment.
11. At the exact appointment end, the LiveKit room is forcibly deleted, disconnecting already-connected patient and doctor.
12. Termination is idempotent, scoped to one booking/room, retryable after transient failures, and recovered after app restart/missed timer.
13. An old patient token from a previous entry/admission cannot restore media access; a reconnect with a new LiveKit SID is rejected and removed.
14. A fresh lobby entry rotates the server-side entry, and only then can the doctor admit the patient again.
15. A mid-admission entry rotation cannot be persisted; permissions are revoked and the admission fails.
16. A reconnect between the SID check and the grant is detected after the grant, revoked, and rejected.
17. Duplicate LiveKit connections for one identity are rejected and removed.
18. A reschedule that changes the appointment end clears the old termination/admission state and re-arms termination for the new end.

## 10. Required Tests

### Unit

- `tests/utils/meeting.test.ts`:
  - opens 5 minutes before start;
  - joinable inside the window;
  - denied one minute before open;
  - denied exactly at end;
  - denied one minute after end;
  - same result for a UTC-midnight `@db.Date` booking.
- `tests/utils/livekit-token.test.ts`:
  - member token has `canPublish: false` and `canSubscribe: false`;
  - moderator token has publish/subscribe permission;
  - explicit TTL is honored for the remaining window;
  - default TTL remains 3600 for direct callers.

### API

- `tests/api/patient/session/[bookingId].get.test.ts`:
  - returns a room inside the window;
  - rejects before the window, at exact end, and after end;
  - rejects another patient's booking and staff accounts;
  - rejects in-clinic and non-confirmed bookings;
  - rejects a deactivated patient;
  - creates/updates a single `SessionRoom` and reuses its name;
  - second call rotates `currentEntryId`, clears the admitted SID, and issues a different member identity;
  - development/test mode does not bypass ownership or the end boundary.
- `tests/api/doctor/session/[bookingId].get.test.ts` (new):
  - assigned doctor gets an in-window moderator token;
  - wrong doctor, staff, inactive doctor, inactive patient, in-clinic, non-confirmed, early, and exact-end requests fail.
- `tests/api/doctor/session/[bookingId]/admit.post.test.ts` (new):
  - correct doctor + current entry identity/SID inside window succeeds;
  - wrong identity, wrong doctor, staff, inactive patient, in-clinic, non-confirmed, and exact-end requests fail;
  - stale entry and old-token reconnected SID are rejected and removed;
  - a mid-flight entry rotation fails the conditional persist, revokes, and returns `409`;
  - a reconnect between the SID check and grant is revoked after the grant and returns `409`;
  - duplicate connections for one identity are rejected and removed;
  - repeated admission of the same SID is safe;
  - fresh entry rotation permits a new admission.
- `tests/api/session/termination.test.ts` (new):
  - exact-room deletion and `terminatedAt` recording;
  - idempotent repeated termination;
  - cross-booking room-name guard;
  - startup/missed-execution sweep;
  - future-room timer re-arm after restart;
  - a reschedule changes `expiresAt`, clears the old termination/admission state, and re-arms termination;
  - missing LiveKit room treated as terminated;
  - transient failure leaves retry state.
- `tests/api/session/lobby/[meetingId].get.test.ts`:
  - `canJoin` false at exact end;
  - owner/doctor roles unchanged; staff metadata has `canJoin: false`;
  - in-clinic `canJoin` false;
  - unauthorized user still 403.

### E2E

- `tests/e2e/patient-dashboard.spec.ts`:
  - Join button enabled before end, disabled at/after end;
  - direct navigation outside the window shows the server-backed waiting/error state;
  - existing `/meeting/:id/lobby` waiting-state test updated to the new copy/route behavior.

LiveKit network connection itself may be mocked or omitted in E2E; the server behavior is the primary acceptance boundary. If a staging LiveKit is used, run a manual two-browser re-entry drill.

## 11. Risks and Dependencies

- **Risk:** LiveKit room is destroyed after all participants leave, so re-entry may recreate the room. Verify in staging; the token/room-name path supports recreation.
- **Risk:** Token TTL of 1 second at the boundary may fail clock skew. Keep the window check authoritative; do not extend the token for convenience.
- **Risk:** The old `/meeting` lobby page may be referenced by external links; preserve the route but redirect/delegate.
- **Risk:** The termination scheduler is in-process and single-instance-oriented. The durable `expiresAt`/`terminatedAt` fields + startup sweep + 30s fallback cover restarts/missed timers; a multi-instance deployment runs the idempotent sweeper per instance. Exact timing after a restart can be delayed by up to the sweep interval.
- **Risk:** Old-token reconnects are denied and removed at admission, but an old token can still connect to the LiveKit waiting room until its JWT expires; it has no media permission and cannot be admitted again. A future LiveKit webhook/revocation layer could remove it proactively.
- **Risk:** The existing same-day start-time reschedule path does not touch the session row itself; the next token request detects the changed end and resets entry/admission/termination state. A future confirmed-booking reschedule feature must reset that state explicitly and re-arm termination.
- **Dependency:** Requires the `SessionRoom` migration and `prisma generate` before runtime verification.
- **Dependency:** None on booking/payment phases; the existing `CONFIRMED` status is used.
- **Dependency:** Phase 4 changes how bookings become `CONFIRMED`; this phase remains valid because it consumes the status, not the payment flow.

## 12. Definition of Done

- All changed UI copy and buttons use the exact end-time rule.
- Server tests cover exact-boundary rejection, re-entry, wrong patient, wrong doctor, wrong identity, old-token reconnected SID, reconnect-during-grant revocation, duplicate connections, entry rotation, mid-flight entry races, forced termination, idempotency, restart sweep, reschedule re-arm, and cross-booking isolation.
- `SessionRoom` migration is applied in staging and `prisma generate` has run.
- No new dependency.
- Manual/staging re-entry drill documented (join → leave → join → doctor re-admits).
- Manual/staging appointment-end drill documented (active participant forcibly disconnected).
- The phase is merged without implementing booking/payment redesign.
