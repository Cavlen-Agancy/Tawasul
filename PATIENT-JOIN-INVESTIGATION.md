# Patient Session Join Navigation Investigation

## 1. Observed Behavior
When the `Patient Dashboard` E2E test clicked the enabled Join Session button for a confirmed booking whose appointment was approximately 3 minutes in the future, the browser did **not** remain on or move to:

`/dashboard/session/{bookingId}`

The Playwright `waitForURL` timed out after 20 seconds. The browser instead remained on/returned to:

`/dashboard/appointments`

The Join button was visible and enabled at the time of the click.

## 2. Expected Behavior
Clicking Join Session for an eligible online booking should open `/dashboard/session/{bookingId}` and allow the patient to view the session lobby while waiting for admission.

## 3. Reproduction
- Test: `tests/e2e/patient-dashboard.spec.ts`
- Scenario: `Patient Dashboard >> join button is active near session time and opens the session page`
- Fixture:
  - Confirmed online booking created +3 minutes from test start (`bookingNowId`).
  - E2E test user `e2e.patient@test.com`.
- Steps:
  1. Log in as patient.
  2. Open `/dashboard/appointments`.
  3. Open the appointment detail dialog for `bookingNowId`.
  4. Confirm `join-${bookingNowId}` is enabled.
  5. Click Join Session.
  6. Expect URL to become `/dashboard/session/{bookingNowId}`.
- Observed result: navigation surfaced repeated `/dashboard/appointments` entries and the expected URL never remained stable.

## 4. Flow Trace
Relevant files and symbols:
- `pages/dashboard/appointments.vue`
  - `canJoin(appt)` — true only from 5 minutes before session start until appointment end.
  - `joinSession(appt)` — calls `navigateTo('/dashboard/session/{appt.id}')`.
  - `join-${detailAppt.id}` button calls `joinSession(detailAppt!)` on click.
- `pages/dashboard/session/[bookingId].vue`
  - `bootSession()` calls `fetchToken()` then `connectRoom(token.value)`.
  - `onDisconnected` callback calls `router.push('/dashboard/appointments')`.
  - `onSessionTimeEnded()` also calls `router.push('/dashboard/appointments?sessionEnded=1')`.
- `modules/patient/server/api/patient/session/[bookingId].get.ts`
  - Issues the member token when the booking is CONFIRMED, ONLINE, owned, and within the time window.
- `server/utils/meeting.ts`
  - `meetingWindow()` opens 5 minutes before start and closes at exact appointment end.
- `server/utils/livekit-token.ts`
  - Token TTL bounded by remaining window; patient token is `member` with publish/subscribe false.

## 5. Root Cause
The most likely cause is that the session page initializes and attempts a LiveKit room connection before or during the route navigation. If that connection fails or emits `Disconnected`, the session page immediately calls `router.push('/dashboard/appointments')`, so `waitForURL('/dashboard/session/...')` cannot observe a stable destination.

Code evidence:
- `pages/dashboard/session/[bookingId].vue` sets `onDisconnected: () => router.push('/dashboard/appointments')`.
- `bootSession()` begins `fetchToken()` and then `connectRoom(token.value)`.
- The appointments page's Join handler itself uses unawaited `navigateTo('/dashboard/session/{id}')`, so a quick disconnect callback from the newly mounted session page can replace the navigation.

Alternative/possibly contributing causes not yet proven:
- LiveKit client connection failure in the browser when connecting immediately after navigation.
- Route guard or token API timing while the appointment is only 3 minutes in the future.

The failure is **not** proven to be:
- A join eligibility bug, because `canJoin` was true and the button was enabled.
- A server-side session authorization failure alone, because the server route still enforces the normal window and ownership checks.

## 6. Impact Scores
- Business Impact: 4
- Technical Risk: 3
- UX Severity: 4
- Security Risk: 1

## 7. Minimal Proposed Fix
Before changing code, collect runtime evidence. If the LiveKit disconnect theory is confirmed, the smallest safe alignment is:

1. In `pages/dashboard/session/[bookingId].vue`, prevent the immediate `Disconnected` redirect while `tokenError` already contains a token-fetch failure, or defer redirect only when `loadingStage` indicates an active room.
2. In `pages/dashboard/appointments.vue`, make `joinSession()` await `navigateTo(...)` and guard against losing focus to a re-rendered detail modal.

Do not weaken `canJoin`, token TTL, ownership, session-window rules, or LiveKit admission.

## 8. Regression Risks
- Changing the disconnect redirect could affect genuine disconnect recovery and auto-end behavior.
- Awaiting `navigateTo` could alter navigation timing but is lower risk.
- Any modification to the Join handler must be tested against disabled-window and expired-session tests.

## 9. Verification Plan
1. Re-run this exact E2E scenario.
2. Capture Playwright console log and network responses for `/api/patient/session/{bookingId}`.
3. Capture screenshots at the moment of redirect.
4. Add a temporary test-only log around `connectRoom` and `onDisconnected` if allowed, or use Playwright tracing.
5. Verify that:
   - The Join button is enabled.
   - The session page receives a token.
   - `connectRoom` does not immediately mark the room as disconnected.
   - The URL remains `/dashboard/session/{bookingId}`.
6. Re-run the patient-dashboard E2E suite and confirm the fix does not break window tests.
7. Run the focused API tests under Node 22 after any code change.

**Status:** Root cause not conclusively proven. No application or test code was modified. Further evidence is required before a safe fix can be approved.
