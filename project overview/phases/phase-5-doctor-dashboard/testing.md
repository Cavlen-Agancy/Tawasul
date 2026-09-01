# Phase 5 — Doctor Dashboard
## testing.md

---

## Testing Strategy

Phase 5 introduces doctor-specific pages and API endpoints. Testing includes:

- **Unit Tests (Vitest)** — NO. No pure utility functions are added in this phase.
- **API Tests (Vitest + supertest)** — YES. Test all 6 doctor API endpoints.
- **End-to-End Tests (Playwright)** — YES. Test all doctor dashboard pages and flows.

---

## API Tests

---

### Test File: `tests/api/doctor/profile.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch own profile | Auth: DOCTOR, Path: `/api/doctor/profile` | 200 | `{ id, name, email, phone?, photo?, bio?, slug, specializations, isActive }` |
| Fetch as another user | Auth: DOCTOR (not owner), Path: `/api/doctor/profile` | 403 | `{ message: "Forbidden" }` |
| Fetch unauthenticated | No auth, Path: `/api/doctor/profile` | 401 | `{ message: "Unauthorized" }` |

---

### Test File: `tests/api/doctor/profile.patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Update name and bio | Auth: DOCTOR, Body: `{ name: "New Name", bio: "New bio" }` | 200 | `{ id, name: "New Name", email, bio: "New bio", ... }` |
| Update specializations | Auth: DOCTOR, Body: `{ specializations: ["Therapy", "Counseling"] }` | 200 | `{ ..., specializations: ["Therapy", "Counseling"] }` |
| Update with short name | Auth: DOCTOR, Body: `{ name: "A" }` | 400 | `{ message: "Name must be at least 2 characters" }` |
| Update as another user | Auth: DOCTOR (not owner), Body: `{ name: "New Name" }` | 403 | `{ message: "Forbidden" }` |

---

### Test File: `tests/api/doctor/profile/photo.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Upload valid photo | Auth: DOCTOR, File: valid JPEG (1MB) | 200 | `{ photoUrl: "/doctors/..." }` |
| Upload invalid file type | Auth: DOCTOR, File: PDF | 400 | `{ message: "Only image files are allowed" }` |
| Upload file too large | Auth: DOCTOR, File: JPEG (3MB) | 400 | `{ message: "File size exceeds maximum limit" }` |
| Upload unauthenticated | No auth, File: valid JPEG | 401 | `{ message: "Unauthorized" }` |

---

### Test File: `tests/api/doctor/bookings.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch bookings for date range | Auth: DOCTOR, Query: `?start=2024-03-01&end=2024-03-31` | 200 | `{ bookings: [...] }` (bookings for doctor in range) |
| Fetch with invalid date format | Auth: DOCTOR, Query: `?start=01-03-2024&end=31-03-2024` | 400 | `{ message: "Invalid date format" }` |
| No bookings in range | Auth: DOCTOR, Query: `?start=2024-03-01&end=2024-03-31` | 200 | `{ bookings: [] }` |
| Fetch as another user | Auth: DOCTOR (not owner), Query: `?start=2024-03-01&end=2024-03-31` | 403 | `{ message: "Forbidden" }` |

---

### Test File: `tests/api/doctor/bookings/[id].get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch own booking | Auth: DOCTOR (owner), Path: `/api/doctor/bookings/book-1` | 200 | `{ id, patientName, patientEmail, date, startTime, endTime, service, status, paymentStatus }` |
| Fetch another doctor's booking | Auth: DOCTOR (not owner), Path: `/api/doctor/bookings/book-1` | 403 | `{ message: "Forbidden" }` |
| Booking not found | Auth: DOCTOR, Path: `/api/doctor/bookings/nonexistent` | 404 | `{ message: "Booking not found" }` |

---

### Test File: `tests/api/doctor/session/[bookingId].get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Access own booking within time window | Auth: DOCTOR (owner), Path: `/api/doctor/session/book-1` | 200 | `{ roomName: "tawasul-book-1", jitsiDomain: "meet.jit.si" }` |
| Access own booking outside time window | Auth: DOCTOR (owner), Path: `/api/doctor/session/book-1` (session in future) | 403 | `{ message: "Session is not available at this time" }` |
| Access another doctor's booking | Auth: DOCTOR (not owner), Path: `/api/doctor/session/book-1` | 403 | `{ message: "Forbidden" }` |
| Booking not found | Auth: DOCTOR, Path: `/api/doctor/session/nonexistent` | 404 | `{ message: "Booking not found" }` |
| Booking not confirmed | Auth: DOCTOR (owner), Path: `/api/doctor/session/book-1` (status PENDING) | 403 | `{ message: "Forbidden" }` |

---

## End-to-End Tests (Playwright)

---

### Test File: `tests/e2e/doctor-dashboard.spec.ts`

#### Test: Unauthenticated User Redirected from Doctor Dashboard
- **Starting State:** Logged out, on `/doctor/calendar`.
- **Steps:**
  1. Navigate to `/doctor/calendar`.
- **Assertions:**
  - Redirected to `/login`.

#### Test: Non-Doctor User Redirected from Doctor Dashboard
- **Starting State:** Logged in as PATIENT, on `/doctor/calendar`.
- **Steps:**
  1. Navigate to `/doctor/calendar`.
- **Assertions:**
  - Redirected to `/dashboard`.

#### Test: Doctor Dashboard Redirect Works
- **Starting State:** Logged in as DOCTOR, on `/doctor`.
- **Steps:**
  1. Navigate to `/doctor`.
- **Assertions:**
  - Redirected to `/doctor/calendar`.

#### Test: Incomplete Profile Banner Shows
- **Starting State:** Logged in as DOCTOR with empty `bio`, on `/doctor/calendar`.
- **Steps:**
  1. Navigate to `/doctor/calendar`.
- **Assertions:**
  - Yellow banner with message "Your profile is incomplete..." is visible.
  - Banner has a link to `/doctor/profile`.

#### Test: Calendar Loads Bookings
- **Starting State:** Logged in as DOCTOR with 2 assigned bookings, on `/doctor/calendar`.
- **Steps:**
  1. Navigate to `/doctor/calendar`.
  2. Wait for calendar to load.
- **Assertions:**
  - Calendar shows events for the bookings.
  - Events have patient names as titles.
  - Events are colored in magenta.

#### Test: Calendar Views Work
- **Starting State:** Logged in as DOCTOR with bookings, on `/doctor/calendar`.
- **Steps:**
  1. Click "Week" view button.
  2. Click "Day" view button.
  3. Click "Month" view button.
- **Assertions:**
  - Calendar switches to week view.
  - Calendar switches to day view.
  - Calendar switches back to month view.

#### Test: Calendar Date Navigation Works
- **Starting State:** Logged in as DOCTOR with bookings, on `/doctor/calendar`.
- **Steps:**
  1. Click "Next" button to go to next month.
  2. Click "Previous" button to return.
- **Assertions:**
  - Calendar shows next month.
  - Calendar returns to current month.
  - Bookings for the new month are fetched.

#### Test: Booking Detail Modal Opens
- **Starting State:** Logged in as DOCTOR with 1 booking, on `/doctor/calendar`.
- **Steps:**
  1. Click a booking event on the calendar.
- **Assertions:**
  - Modal opens with booking details.
  - Patient name, date, time, service, and status are visible.
  - "Join Session" button is visible (grayed out if outside time window).

#### Test: Join Session Button in Modal
- **Starting State:** Logged in as DOCTOR with a booking (session starts in 3 minutes), on `/doctor/calendar`.
- **Steps:**
  1. Click the booking event.
  2. Wait for "Join Session" button to become active.
  3. Click "Join Session".
- **Assertions:**
  - Redirected to `/doctor/session/[bookingId]`.

#### Test: Profile Page Loads
- **Starting State:** Logged in as DOCTOR, on `/doctor/profile`.
- **Steps:**
  1. Navigate to `/doctor/profile`.
- **Assertions:**
  - Page title is "My Profile".
  - Name, email, phone, bio, and specializations fields are pre-filled.
  - Email field is read-only.
  - Profile photo is visible (or placeholder).

#### Test: Profile Update Works
- **Starting State:** Logged in as DOCTOR, on `/doctor/profile`.
- **Steps:**
  1. Change name to "Dr. New Name".
  2. Change bio to "New bio text".
  3. Click "Save Changes".
- **Assertions:**
  - Success toast appears.
  - Name and bio are updated in the UI.

#### Test: Specializations Tag Input Works
- **Starting State:** Logged in as DOCTOR, on `/doctor/profile`.
- **Steps:**
  1. Type "Therapy" in specializations input.
  2. Press Enter.
  3. Type "Counseling" and press Enter.
  4. Click X on "Therapy" tag.
- **Assertions:**
  - "Therapy" tag appears.
  - "Counseling" tag appears.
  - "Therapy" tag is removed.

#### Test: Photo Upload Works
- **Starting State:** Logged in as DOCTOR, on `/doctor/profile`.
- **Steps:**
  1. Click "Upload Photo".
  2. Select a valid image file.
- **Assertions:**
  - Photo updates immediately in the UI.
  - Success toast appears.

#### Test: Session Room Page Loads (Within Time Window)
- **Starting State:** Logged in as DOCTOR with a confirmed booking (session starts in 3 minutes — safely within the 5-minute window), on `/doctor/session/book-1`.
- **Steps:**
  1. Navigate to `/doctor/session/book-1`.
- **Assertions:**
  - Jitsi embed loads.
  - Video area and chat panel are visible.
  - "Leave Session" button is visible.

#### Test: Session Room Page Shows Countdown (Outside Time Window)
- **Starting State:** Logged in as DOCTOR with a confirmed booking (session starts in 1 hour), on `/doctor/session/book-1`.
- **Steps:**
  1. Navigate to `/doctor/session/book-1`.
- **Assertions:**
  - Countdown timer is visible (e.g., "Session starts in 55 minutes").
  - Jitsi does not load.
- **Note:** Use a session that starts in at least 10 minutes to avoid flakiness at the boundary.

#### Test: Session Room Page 403 for Another Doctor's Booking
- **Starting State:** Logged in as DOCTOR (not owner of booking-1), on `/doctor/session/book-1`.
- **Steps:**
  1. Navigate to `/doctor/session/book-1`.
- **Assertions:**
  - 403 error is shown or redirected to `/login`.

#### Test: Leave Session Flow
- **Starting State:** Logged in as DOCTOR in a live session, on `/doctor/session/book-1`.
- **Steps:**
  1. Click "Leave Session".
  2. Click "Confirm" in the modal.
- **Assertions:**
  - Modal confirmation dialog appears.
  - After confirmation, redirected to `/doctor/calendar`.

#### Test: Sidebar Navigation Works
- **Starting State:** Logged in as DOCTOR, on `/doctor/calendar`.
- **Steps:**
  1. Click "My Profile" in sidebar.
  2. Click "My Calendar" in sidebar.
  3. Click "Logout" in sidebar.
- **Assertions:**
  - Each link navigates to the correct page.
  - Logout redirects to `/login`.

#### Test: Mobile Bottom Nav Works
- **Starting State:** Logged in as DOCTOR, on `/doctor/calendar` with 375px viewport.
- **Steps:**
  1. Click "Profile" icon in bottom nav.
  2. Click "Calendar" icon.
- **Assertions:**
  - Bottom nav is visible.
  - Each icon navigates to the correct page.

#### Test: Doctor Cannot Access Another Doctor's Bookings
- **Starting State:** Logged in as DOCTOR (not owner of booking-1), on `/doctor/calendar`.
- **Steps:**
  1. Call `GET /api/doctor/bookings?start=2024-03-01&end=2024-03-31` via API.
- **Assertions:**
  - Returns 403.

#### Test: Doctor and Patient Share Same Jitsi Room
- **Starting State:** Booking `book-1` exists, Jitsi room created via patient or doctor.
- **Steps:**
  1. Log in as DOCTOR, navigate to `/doctor/session/book-1` (within time window).
  2. Log in as PATIENT (owner of booking-1), navigate to `/dashboard/session/book-1` (within time window).
- **Assertions:**
  - Both users enter the same Jitsi room (`tawasul-book-1`).

---

## Manual Verification Checklist

Complete every item below before marking Phase 5 as done:

1. **Authentication & Authorization:**
   - [ ] Unauthenticated users redirected to `/login` from all `/doctor` routes.
   - [ ] Non-doctor roles redirected away from `/doctor`.
   - [ ] Doctor cannot access another doctor's bookings.
   - [ ] Doctor cannot access another doctor's session room.

2. **Layout:**
   - [ ] Incomplete profile banner shows when bio is empty.
   - [ ] Banner disappears after bio is added.
   - [ ] Sidebar is visible on desktop.
   - [ ] Bottom nav is visible on mobile.

3. **Calendar:**
   - [ ] Calendar loads bookings for visible date range.
   - [ ] Switching between month, week, day views fetches correct range.
   - [ ] Clicking a booking event opens the correct detail modal.
   - [ ] Booking detail modal shows patient name, date, time, service, status.
   - [ ] Join Session button in modal is active only within time window.

4. **Profile:**
   - [ ] Profile updates correctly and shows success toast.
   - [ ] Photo upload works and displays immediately.
   - [ ] Specializations tag input works (add/remove).
   - [ ] Email field is read-only.

5. **Session Room:**
   - [ ] Session room loads Jitsi when within time window.
   - [ ] Session room shows countdown when outside time window.
   - [ ] Doctor and patient enter the same Jitsi room for the same booking.
   - [ ] Leave Session button works and redirects to calendar.

6. **UI/UX:**
   - [ ] All pages are mobile-responsive (375px viewport).
   - [ ] Loading states are shown during API calls.
   - [ ] Error messages are user-friendly.

---

## Completion Criteria

Mark each item PASS or FAIL with a note before handing off to Phase 6:

```
[ ] All API tests pass (0 failures) — run `npm run test:api`
[ ] All Playwright tests pass (0 failures) — run `npm run test:e2e`
[ ] No TypeScript errors — `npx tsc --noEmit` shows 0 errors
[ ] Manual verification checklist completed
[ ] No console errors in the browser on any doctor page
[ ] Unauthenticated users redirected to /login from all /doctor routes
[ ] Non-doctor roles redirected away from /doctor
[ ] Incomplete profile banner shows when bio is empty
[ ] Calendar loads bookings for visible date range
[ ] Switching between month, week, day views fetches correct range
[ ] Clicking a booking event opens the correct detail modal
[ ] Join Session button in modal is active only within time window
[ ] Session room loads Jitsi when within time window
[ ] Session room shows countdown when outside time window
[ ] Doctor cannot access another doctor's bookings
[ ] Doctor and patient enter the same Jitsi room for the same booking
[ ] Profile updates correctly and shows success toast
[ ] Photo upload works and displays immediately
[ ] Specializations tag input works (add/remove)
[ ] Loading skeletons show while data fetches
[ ] All pages are mobile-responsive
```

**The phase is complete only when all 22 items above are marked PASS.**

If any item is FAIL, fix it before moving to Phase 6. Document what failed and what was done to fix it in a `notes.md` file inside the `phase-5/` folder.
