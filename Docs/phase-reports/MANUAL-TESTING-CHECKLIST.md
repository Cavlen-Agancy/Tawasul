# Manual Testing Checklist — Session Lifecycle

Credentials: see `TEST-ACCOUNTS.local.md`.
Local app: `npm run dev`.
PostgreSQL and LiveKit must be running (`docker compose up -d postgres livekit`).

## Priority 1 — Patient Session Join

### 1.1 Join near appointment time
**Preconditions:** Patient has a CONFIRMED ONLINE booking starting within 5 minutes.
**Actions:**
1. Log in as `test.patient@tawasul.com`.
2. Open `/dashboard/appointments`.
3. Open the appointment detail panel.
4. Click **Join Session**.

**Expected:** The browser navigates to `/dashboard/session/{bookingId}` and remains there. The token/loading state appears, then the waiting room or error/retry state. It must not bounce back to appointments.

### 1.2 Transient interruption
**Preconditions:** Patient is in the waiting room or session page.
**Actions:**
1. In Chrome DevTools → Network, set **Offline** for 5–10 seconds.
2. Restore **Online**.

**Expected:** The session page remains mounted. LiveKit should attempt reconnection; a temporary error/retry state may appear. The page must not silently redirect to appointments.

### 1.3 Intentional leave
**Preconditions:** Patient is on the session page.
**Actions:** Click the leave/end button and confirm.

**Expected:** Patient navigates back to `/dashboard/appointments`.

## Priority 1 — Doctor Admission and Patient Re-entry

### 2.1 Doctor admits patient
**Preconditions:** Patient is waiting on the session page; doctor is assigned to the same booking.
**Actions:**
1. Log in as `test.doctor@tawasul.com` in a second browser profile.
2. Open the assigned session/calendar entry.
3. Admit the patient from the waiting list.

**Expected:** Patient receives media permissions and the waiting state changes to active.

### 2.2 Patient leaves and re-enters
**Actions:**
1. Patient leaves the session.
2. Patient reopens the appointment and clicks **Join Session** again.
3. Doctor admits the newly waiting participant.

**Expected:** Patient must be re-admitted; the old browser session does not restore media access automatically.

### 2.3 Wrong-role access
**Actions:**
- As Patient B, open Patient A's `/dashboard/session/{bookingId}` URL.
- As an unassigned doctor, open Doctor A's session URL.
- As staff, attempt to open a session page.

**Expected:** Access is denied by the server, with no LiveKit credentials for unauthorized users.

## Priority 2 — Appointment-End Forced Disconnect

**Preconditions:** Patient and doctor are both connected near the appointment end.
**Actions:** Let the appointment reach its exact end time without clicking Leave.

**Expected:** Both participants are disconnected by the server-side room deletion. The session cannot be reopened after the end time.

## Priority 2 — Recovery

### 4.1 Application restart
**Preconditions:** An active or waiting session exists.
**Actions:**
1. Restart only the Nuxt dev/app process.
2. Reload the session page and re-enter through the lobby.

**Expected:** The app starts; existing booking data remains; the user can re-enter only through the normal authorization/admission flow.

### 4.2 LiveKit restart
**Preconditions:** A session page is open.
**Actions:**
1. Run `docker compose restart livekit`.
2. Wait for LiveKit to return.
3. Retry/reload the session.

**Expected:** LiveKit returns, API authentication works, and a new valid connection can be established. Existing invalid/old tokens do not regain access.

## Priority 3 — Settings / Account Checks

- Confirm `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=false`.
- Confirm all four test roles can log in.
- Confirm staff cannot obtain a patient/doctor session token.
- Confirm an in-clinic booking has no online session access.

## Unverified Automated Scenarios
The following are not covered by automated verification and should be prioritized manually:
- transient reconnection after `ready`
- terminal disconnect feedback on the page
- real old-token reconnect in LiveKit
- application restart with an active session
- LiveKit restart with an active session

---

# Main Booking Journey — Doctor-Based Booking + Payment Confirmation

## Priority 1 — Doctor selection and availability

**Preconditions:** PostgreSQL, app, and LiveKit are running; at least two active doctors exist with availability.

1. Log in as `test.patient@tawasul.com`.
2. Open `/book`.
3. Confirm the doctor cards show name, specialization, and photo/fallback initial.
4. Confirm dates/times are not shown until a doctor is selected.
5. Select Doctor A.
6. Confirm available dates and times are for Doctor A.
7. Switch to Doctor B.
8. Confirm the previously selected date/time is cleared and availability reloads for Doctor B.
9. Select an online session and continue to Review.

**Expected:** Doctor and session type are visible; old selection is cleared; no stale Doctor A slots remain.

## Priority 1 — Online booking + automatic confirmation

1. Select Doctor B, date, online session type, and a free time.
2. Click **Confirm and Pay**.
3. Complete the local mock payment redirect (development gateway not configured).
4. Wait for `/booking/success`.

**Expected:** The booking is automatically `CONFIRMED` after verified payment. The success page says **Booking Confirmed** and shows the selected doctor. No admin approval is required.

Confirm in the database or admin booking detail:
- `bookings.doctorId` matches selected doctor.
- `bookings.status = CONFIRMED`.
- `payments.status = SUCCESS`.
- `payments.amount` matches the displayed/assigned amount.
- `bookings.holdExpiresAt` is set for new online holds.

## Priority 1 — In-clinic booking

1. On `/book`, select **In clinic**.
2. Choose a free slot and confirm.
3. Verify no payment page is required.
4. Verify the booking is immediately `CONFIRMED` and has no payment row.

## Priority 2 — Failure and idempotency

1. Cancel/fail a mock payment; verify the booking remains `PENDING`.
2. Retry the payment before the hold expires; verify one confirmation.
3. Replay/duplicate the success webhook; verify no duplicate booking or duplicate confirmation email.
4. Attempt a webhook with an incorrect amount or currency; verify no confirmation.

## Priority 2 — Security and consistency

- Patient B cannot access Patient A's booking.
- Doctor sees only their own confirmed/cancelled bookings.
- Staff can access admin booking screens only with the correct permissions.
- After confirmation, the patient's dashboard shows the correct doctor, time, and status.
- Session page joins the correct booking and doctor after confirmation.
