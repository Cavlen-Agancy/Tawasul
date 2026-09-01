# Phase 4 — Patient Dashboard
## testing.md

---

## Testing Strategy

Phase 4 introduces patient-specific pages and API endpoints. Testing includes:

- **Unit Tests (Vitest)** — NO. No pure utility functions are added in this phase.
- **API Tests (Vitest + supertest)** — YES. Test all 6 patient API endpoints.
- **End-to-End Tests (Playwright)** — YES. Test all dashboard pages and flows.

---

## API Tests

---

### Test File: `tests/api/patient/profile.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch own profile | Auth: PATIENT, Path: `/api/patient/profile` | 200 | `{ id, name, email, phone?, photo? }` |
| Fetch as another user | Auth: PATIENT (not owner), Path: `/api/patient/profile` | 403 | `{ message: "Forbidden" }` |
| Fetch unauthenticated | No auth, Path: `/api/patient/profile` | 401 | `{ message: "Unauthorized" }` |

---

### Test File: `tests/api/patient/profile.patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Update name and phone | Auth: PATIENT, Body: `{ name: "New Name", phone: "+20123456789" }` | 200 | `{ id, name: "New Name", email, phone: "+20123456789", photo? }` |
| Update name only | Auth: PATIENT, Body: `{ name: "New Name" }` | 200 | `{ id, name: "New Name", email, phone?, photo? }` |
| Update with short name | Auth: PATIENT, Body: `{ name: "A" }` | 400 | `{ message: "Name must be at least 2 characters" }` |
| Update as another user | Auth: PATIENT (not owner), Body: `{ name: "New Name" }` | 403 | `{ message: "Forbidden" }` |

---

### Test File: `tests/api/patient/profile/photo.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Upload valid photo | Auth: PATIENT, File: valid JPEG (1MB) | 200 | `{ photoUrl: "/patients/..." }` |
| Upload invalid file type | Auth: PATIENT, File: PDF | 400 | `{ message: "Only image files are allowed" }` |
| Upload file too large | Auth: PATIENT, File: JPEG (3MB) | 400 | `{ message: "File size exceeds maximum limit" }` |
| Upload unauthenticated | No auth, File: valid JPEG | 401 | `{ message: "Unauthorized" }` |

---

### Test File: `tests/api/patient/appointments.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch upcoming appointments | Auth: PATIENT, Query: `?tab=upcoming` | 200 | `{ appointments: [...] }` (future CONFIRMED bookings) |
| Fetch past appointments | Auth: PATIENT, Query: `?tab=past` | 200 | `{ appointments: [...] }` (past CONFIRMED + all CANCELLED) |
| Fetch default (upcoming) | Auth: PATIENT, No query | 200 | `{ appointments: [...] }` (same as `?tab=upcoming`) |
| No appointments | Auth: PATIENT, Query: `?tab=upcoming` | 200 | `{ appointments: [] }` |
| Fetch as another user | Auth: PATIENT (not owner), Query: `?tab=upcoming` | 403 | `{ message: "Forbidden" }` |

---

### Test File: `tests/api/patient/payments.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch payments | Auth: PATIENT, Path: `/api/patient/payments` | 200 | `{ payments: [...] }` (all payments for patient's bookings) |
| No payments | Auth: PATIENT, Path: `/api/patient/payments` | 200 | `{ payments: [] }` |
| Fetch as another user | Auth: PATIENT (not owner), Path: `/api/patient/payments` | 403 | `{ message: "Forbidden" }` |

---

### Test File: `tests/api/patient/session/[bookingId].get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Access own booking within time window | Auth: PATIENT (owner), Path: `/api/patient/session/book-1` | 200 | `{ roomName: "tawasul-book-1", jitsiDomain: "meet.jit.si" }` |
| Access own booking outside time window | Auth: PATIENT (owner), Path: `/api/patient/session/book-1` (session in future) | 403 | `{ message: "Session is not available at this time" }` |
| Access another user's booking | Auth: PATIENT (not owner), Path: `/api/patient/session/book-1` | 403 | `{ message: "Forbidden" }` |
| Booking not found | Auth: PATIENT, Path: `/api/patient/session/nonexistent` | 404 | `{ message: "Booking not found" }` |
| Booking not confirmed | Auth: PATIENT (owner), Path: `/api/patient/session/book-1` (status PENDING) | 403 | `{ message: "Forbidden" }` |

---

### Test File: `tests/api/booking/[id]/cancel.patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Cancel own booking (24hr+ before) | Auth: PATIENT (owner), Path: `/api/booking/book-1/cancel` | 200 | `{ message: "Booking cancelled successfully" }` |
| Cancel own booking (<24hr) | Auth: PATIENT (owner), Path: `/api/booking/book-1/cancel` (session in <24hr) | 400 | `{ message: "Cannot cancel booking less than 24 hours before session" }` |
| Cancel as STAFF | Auth: STAFF (APPOINTMENTS DELETE), Path: `/api/booking/book-1/cancel` | 200 | `{ message: "Booking cancelled successfully" }` |
| Cancel another user's booking | Auth: PATIENT (not owner), Path: `/api/booking/book-1/cancel` | 403 | `{ message: "Forbidden" }` |
| Cancel already cancelled | Auth: PATIENT (owner), Path: `/api/booking/book-1/cancel` (status CANCELLED) | 400 | `{ message: "Booking is already cancelled" }` |

---

## End-to-End Tests (Playwright)

---

### Test File: `tests/e2e/patient-dashboard.spec.ts`

#### Test: Unauthenticated User Redirected from Dashboard
- **Starting State:** Logged out, on `/dashboard/appointments`.
- **Steps:**
  1. Navigate to `/dashboard/appointments`.
- **Assertions:**
  - Redirected to `/login`.

#### Test: Non-Patient User Redirected from Dashboard
- **Starting State:** Logged in as DOCTOR, on `/dashboard/appointments`.
- **Steps:**
  1. Navigate to `/dashboard/appointments`.
- **Assertions:**
  - Redirected to `/doctor`.

#### Test: Dashboard Redirect Works
- **Starting State:** Logged in as PATIENT, on `/dashboard`.
- **Steps:**
  1. Navigate to `/dashboard`.
- **Assertions:**
  - Redirected to `/dashboard/appointments`.

#### Test: Appointments Page Loads
- **Starting State:** Logged in as PATIENT with 1 upcoming booking, on `/dashboard/appointments`.
- **Steps:**
  1. Navigate to `/dashboard/appointments`.
- **Assertions:**
  - Page title is "My Appointments".
  - Upcoming tab is active by default.
  - Appointment card is visible with doctor name, date, time, service.
  - "Join Session" button is visible (grayed out if outside time window).
  - "Cancel" button is visible if >24hr before session.

#### Test: Appointments Tabs Work
- **Starting State:** Logged in as PATIENT with 1 upcoming and 1 past booking, on `/dashboard/appointments`.
- **Steps:**
  1. Click "Past" tab.
  2. Click "Upcoming" tab.
- **Assertions:**
  - Past tab shows past booking with "Completed" or "Cancelled" badge.
  - Upcoming tab shows upcoming booking.

#### Test: Cancel Appointment Flow
- **Starting State:** Logged in as PATIENT with 1 upcoming booking (>24hr away), on `/dashboard/appointments`.
- **Steps:**
  1. Click "Cancel" button on the appointment card.
  2. Click "Confirm" in the modal.
- **Assertions:**
  - Modal confirmation dialog appears.
  - After confirmation, card moves from upcoming to past tab (without page reload).
  - Cancellation email is sent (verify via API or mock).

#### Test: Cancel Button Hidden for <24hr
- **Starting State:** Logged in as PATIENT with 1 upcoming booking (<24hr away), on `/dashboard/appointments`.
- **Steps:**
  1. Check the appointment card.
- **Assertions:**
  - "Cancel" button is not visible.

#### Test: Join Session Button State Updates
- **Starting State:** Logged in as PATIENT with 1 upcoming booking (session starts in 3 minutes), on `/dashboard/appointments`.
- **Steps:**
  1. Wait for 60 seconds (or mock `setInterval`).
- **Assertions:**
  - "Join Session" button becomes active (magenta) when within 5 minutes of start time.

#### Test: Payments Page Loads
- **Starting State:** Logged in as PATIENT with 1 payment, on `/dashboard/payments`.
- **Steps:**
  1. Navigate to `/dashboard/payments`.
- **Assertions:**
  - Page title is "My Payments".
  - Payment table shows date, doctor, service, amount, status.
  - Status badge colors: SUCCESS=green, PENDING=yellow, FAILED=red, REFUNDED=gray.

#### Test: Payments Page Mobile View
- **Starting State:** Logged in as PATIENT with 1 payment, on `/dashboard/payments` with 375px viewport.
- **Steps:**
  1. Navigate to `/dashboard/payments`.
- **Assertions:**
  - Table collapses to card list.
  - Each payment is a card with all details.

#### Test: Profile Page Loads
- **Starting State:** Logged in as PATIENT, on `/dashboard/profile`.
- **Steps:**
  1. Navigate to `/dashboard/profile`.
- **Assertions:**
  - Page title is "Profile".
  - Name, email, phone fields are pre-filled.
  - Email field is read-only.
  - Profile photo is visible (or placeholder).

#### Test: Profile Update Works
- **Starting State:** Logged in as PATIENT, on `/dashboard/profile`.
- **Steps:**
  1. Change name to "New Name".
  2. Change phone to "+20123456789".
  3. Click "Save Changes".
- **Assertions:**
  - Success toast appears.
  - Name and phone are updated in the UI.

#### Test: Photo Upload Works
- **Starting State:** Logged in as PATIENT, on `/dashboard/profile`.
- **Steps:**
  1. Click "Upload Photo".
  2. Select a valid image file.
- **Assertions:**
  - Photo updates immediately in the UI.
  - Success toast appears.

#### Test: Session Room Page Loads (Within Time Window)
- **Starting State:** Logged in as PATIENT with a confirmed booking (session starts in 3 minutes — safely within the 5-minute window), on `/dashboard/session/book-1`.
- **Steps:**
  1. Navigate to `/dashboard/session/book-1`.
- **Assertions:**
  - Jitsi embed loads.
  - Video area and chat panel are visible.
  - "Leave Session" button is visible.

#### Test: Session Room Page Shows Countdown (Outside Time Window)
- **Starting State:** Logged in as PATIENT with a confirmed booking (session starts in 1 hour), on `/dashboard/session/book-1`.
- **Steps:**
  1. Navigate to `/dashboard/session/book-1`.
- **Assertions:**
  - Countdown timer is visible (e.g., "Session starts in 55 minutes").
  - Jitsi does not load.
  - Page polls API every 30 seconds.
- **Note:** Use a session that starts in at least 10 minutes to avoid flakiness at the boundary.

#### Test: Session Room Page 403 for Another User's Booking
- **Starting State:** Logged in as PATIENT (not owner of booking-1), on `/dashboard/session/book-1`.
- **Steps:**
  1. Navigate to `/dashboard/session/book-1`.
- **Assertions:**
  - 403 error is shown or redirected to `/login`.

#### Test: Leave Session Flow
- **Starting State:** Logged in as PATIENT in a live session, on `/dashboard/session/book-1`.
- **Steps:**
  1. Click "Leave Session".
  2. Click "Confirm" in the modal.
- **Assertions:**
  - Modal confirmation dialog appears.
  - After confirmation, redirected to `/dashboard/appointments`.

#### Test: Sidebar Navigation Works
- **Starting State:** Logged in as PATIENT, on `/dashboard/appointments`.
- **Steps:**
  1. Click "My Payments" in sidebar.
  2. Click "Profile" in sidebar.
  3. Click "My Appointments" in sidebar.
  4. Click "Logout" in sidebar.
- **Assertions:**
  - Each link navigates to the correct page.
  - Logout redirects to `/login`.

#### Test: Mobile Bottom Nav Works
- **Starting State:** Logged in as PATIENT, on `/dashboard/appointments` with 375px viewport.
- **Steps:**
  1. Click "Payments" icon in bottom nav.
  2. Click "Profile" icon.
  3. Click "Appointments" icon.
- **Assertions:**
  - Bottom nav is visible.
  - Each icon navigates to the correct page.

---

## Manual Verification Checklist

Complete every item below before marking Phase 4 as done:

1. **Authentication & Authorization:**
   - [ ] Unauthenticated users redirected to `/login` from all `/dashboard` routes.
   - [ ] Doctor and staff roles redirected away from `/dashboard`.
   - [ ] Patient cannot access another patient's appointments.
   - [ ] Patient cannot access another patient's session room.

2. **Profile:**
   - [ ] Profile loads with correct data pre-filled.
   - [ ] Name and phone update correctly with success toast.
   - [ ] Photo upload works and displays immediately.
   - [ ] Email field is read-only.

3. **Appointments:**
   - [ ] Upcoming appointments show only CONFIRMED future bookings sorted by date.
   - [ ] Past appointments show past and cancelled bookings.
   - [ ] Join Session button is grayed out outside the 5-minute window.
   - [ ] Join Session button becomes active within the window.
   - [ ] Cancel button hidden when less than 24 hours before session.
   - [ ] Cancel confirmation dialog appears before cancelling.
   - [ ] Cancelled appointment moves to past tab without page reload.
   - [ ] Cancellation email received by patient.

4. **Payments:**
   - [ ] Payments table shows all transactions with correct status badges.
   - [ ] Mobile view collapses to card list.

5. **Session Room:**
   - [ ] Session room shows countdown when outside time window.
   - [ ] Session room loads Jitsi when within time window.
   - [ ] Jitsi video and chat work correctly.
   - [ ] Leave Session button works and redirects to appointments.

6. **Layout:**
   - [ ] Sidebar is visible on desktop.
   - [ ] Bottom nav is visible on mobile.
   - [ ] Sidebar links work correctly.
   - [ ] Bottom nav icons work correctly.

7. **UI/UX:**
   - [ ] Loading skeletons show while data fetches.
   - [ ] All pages are mobile-responsive (375px viewport).
   - [ ] Error messages are user-friendly.
   - [ ] Success toasts appear for actions (save, upload).

8. **Data:**
   - [ ] All patient data is scoped to the logged-in user.
   - [ ] No data leaks between users.

---

## Completion Criteria

Mark each item PASS or FAIL with a note before handing off to Phase 5:

```
[ ] All API tests pass (0 failures) — run `npm run test:api`
[ ] All Playwright tests pass (0 failures) — run `npm run test:e2e`
[ ] No TypeScript errors — `npx tsc --noEmit` shows 0 errors
[ ] Manual verification checklist completed
[ ] No console errors in the browser on any dashboard page
[ ] Unauthenticated users redirected to /login from all /dashboard routes
[ ] Doctor and staff roles redirected away from /dashboard
[ ] Profile loads with correct data pre-filled
[ ] Name and phone update correctly with success toast
[ ] Photo upload works and displays immediately
[ ] Upcoming appointments show only CONFIRMED future bookings sorted by date
[ ] Past appointments show past and cancelled bookings
[ ] Join Session button is grayed out outside the 5-minute window
[ ] Join Session button becomes active within the window
[ ] Cancel button hidden when less than 24 hours before session
[ ] Cancel confirmation dialog appears before cancelling
[ ] Cancelled appointment moves to past tab without page reload
[ ] Cancellation email received by patient
[ ] Payments table shows all transactions with correct status badges
[ ] Session room shows countdown when outside time window
[ ] Session room loads Jitsi when within time window
[ ] Patient cannot access another patient's session room
[ ] Loading skeletons show while data fetches
[ ] All pages are mobile-responsive
```

**The phase is complete only when all 25 items above are marked PASS.**

If any item is FAIL, fix it before moving to Phase 5. Document what failed and what was done to fix it in a `notes.md` file inside the `phase-4/` folder.
