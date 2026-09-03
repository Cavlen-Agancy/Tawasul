# Phase 6 — Admin Dashboard & Permission System
## testing.md

---

## Testing Strategy

Phase 6 introduces the admin dashboard, permission system, and complex data management. Testing includes:

- **Unit Tests (Vitest)** — NO. No new utility functions are added in this phase.
- **API Tests (Vitest + supertest)** — YES. Test all 31 admin API endpoints.
- **End-to-End Tests (Playwright)** — YES. Test all admin pages, permission flows, and data management.

---

## API Tests

---

### Test File: `tests/api/admin/overview.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch overview as STAFF | Auth: STAFF, Path: `/api/admin/overview` | 200 | Returns correct stats when data exists |
| Returns zeros when no data | Auth: STAFF, Path: `/api/admin/overview` (empty DB) | 200 | All counts and sums are 0 |
| Fetch as non-STAFF | Auth: PATIENT, Path: `/api/admin/overview` | 403 | `{ message: "Forbidden" }` |
| Fetch unauthenticated | No auth, Path: `/api/admin/overview` | 401 | `{ message: "Unauthorized" }` |

---

### Test File: `tests/api/admin/bookings.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch all bookings | Auth: STAFF (APPOINTMENTS READ), Path: `/api/admin/bookings` | 200 | `{ bookings: [...] }` |
| Fetch with doctorId filter | Auth: STAFF (APPOINTMENTS READ), Query: `?doctorId=doc-1` | 200 | `{ bookings: [...] }` (filtered by doctor) |
| Fetch with status filter | Auth: STAFF (APPOINTMENTS READ), Query: `?status=CONFIRMED` | 200 | `{ bookings: [...] }` (filtered by status) |
| Fetch with date range | Auth: STAFF (APPOINTMENTS READ), Query: `?start=2024-03-01&end=2024-03-31` | 200 | `{ bookings: [...] }` (filtered by date range) |
| Fetch without permission | Auth: STAFF (no APPOINTMENTS READ), Path: `/api/admin/bookings` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/bookings/[id].get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch booking by ID | Auth: STAFF (APPOINTMENTS READ), Path: `/api/admin/bookings/book-1` | 200 | `{ id, patientName, patientEmail, doctorName, date, startTime, endTime, service, status, paymentStatus }` |
| Booking not found | Auth: STAFF (APPOINTMENTS READ), Path: `/api/admin/bookings/nonexistent` | 404 | `{ message: "Booking not found" }` |
| Fetch without permission | Auth: STAFF (no APPOINTMENTS READ), Path: `/api/admin/bookings/book-1` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/bookings/[id]/cancel.patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Cancel CONFIRMED booking | Auth: STAFF (APPOINTMENTS DELETE), Path: `/api/admin/bookings/book-1/cancel` | 200 | `{ message: "Booking cancelled successfully" }` |
| Cancel already CANCELLED | Auth: STAFF (APPOINTMENTS DELETE), Path: `/api/admin/bookings/book-1/cancel` (status CANCELLED) | 400 | `{ message: "Booking is already cancelled" }` |
| Cancel without permission | Auth: STAFF (no APPOINTMENTS DELETE), Path: `/api/admin/bookings/book-1/cancel` | 403 | `{ message: "You do not have permission..." }` |
| No 24hr restriction | Auth: STAFF (APPOINTMENTS DELETE), Path: `/api/admin/bookings/book-1/cancel` (session in <24hr) | 200 | `{ message: "Booking cancelled successfully" }` |

---

### Test File: `tests/api/admin/doctors.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch all doctors | Auth: STAFF (DOCTORS READ), Path: `/api/admin/doctors` | 200 | `{ doctors: [...] }` (with session counts) |
| Fetch without permission | Auth: STAFF (no DOCTORS READ), Path: `/api/admin/doctors` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/doctors/[id].get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch doctor by ID | Auth: STAFF (DOCTORS READ), Path: `/api/admin/doctors/doc-1` | 200 | `{ id, name, email, phone?, photo?, bio?, slug, specializations, isActive, availability, blockedSlots, bookingHistory }` |
| Doctor not found | Auth: STAFF (DOCTORS READ), Path: `/api/admin/doctors/nonexistent` | 404 | `{ message: "Doctor not found" }` |

---

### Test File: `tests/api/admin/doctors/index.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Create doctor | Auth: STAFF (DOCTORS CREATE), Body: `{ name: "Dr. Ahmed", email: "ahmed@test.com" }` | 201 | `{ id, name, email, ... }` (no password) |
| Create with duplicate email | Auth: STAFF (DOCTORS CREATE), Body: `{ name: "Dr. Ahmed", email: "existing@test.com" }` | 400 | `{ message: "Email already in use" }` |
| Create without permission | Auth: STAFF (no DOCTORS CREATE), Body: `{ name: "Dr. Ahmed", email: "ahmed@test.com" }` | 403 | `{ message: "You do not have permission..." }` |
| Does not return temp password | Auth: STAFF (DOCTORS CREATE), Body: `{ name: "Dr. Ahmed", email: "ahmed@test.com" }` | 201 | Response does not include `password` or `temporaryPassword` |

---

### Test File: `tests/api/admin/doctors/[id].patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Update doctor | Auth: STAFF (DOCTORS UPDATE), Path: `/api/admin/doctors/doc-1`, Body: `{ name: "New Name" }` | 200 | `{ id, name: "New Name", ... }` |
| Update without permission | Auth: STAFF (no DOCTORS UPDATE), Path: `/api/admin/doctors/doc-1` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/doctors/[id]/availability/index.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Replace availability | Auth: STAFF (DOCTORS UPDATE), Path: `/api/admin/doctors/doc-1/availability`, Body: `{ availability: [...] }` | 200 | `{ message: "Availability updated successfully" }` |
| Replace without permission | Auth: STAFF (no DOCTORS UPDATE), Path: `/api/admin/doctors/doc-1/availability` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/doctors/[id]/availability/block.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Add blocked slot | Auth: STAFF (DOCTORS UPDATE), Path: `/api/admin/doctors/doc-1/availability/block`, Body: `{ date: "2024-03-04", startTime: "10:00", endTime: "11:00" }` | 201 | `{ blockedSlot: { id, date, startTime, endTime } }` |
| Add without permission | Auth: STAFF (no DOCTORS UPDATE), Path: `/api/admin/doctors/doc-1/availability/block` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/doctors/[id]/availability/block/[blockId].delete.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Delete blocked slot | Auth: STAFF (DOCTORS UPDATE), Path: `/api/admin/doctors/doc-1/availability/block/block-1` | 200 | `{ message: "Blocked slot removed successfully" }` |
| Delete without permission | Auth: STAFF (no DOCTORS UPDATE), Path: `/api/admin/doctors/doc-1/availability/block/block-1` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/patients.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch all patients | Auth: STAFF (PATIENTS READ), Path: `/api/admin/patients` | 200 | `{ patients: [...] }` (with session counts) |
| Fetch with search | Auth: STAFF (PATIENTS READ), Query: `?search=Ahmed` | 200 | `{ patients: [...] }` (filtered by search) |
| Fetch without permission | Auth: STAFF (no PATIENTS READ), Path: `/api/admin/patients` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/patients/[id].get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch patient by ID | Auth: STAFF (PATIENTS READ), Path: `/api/admin/patients/patient-1` | 200 | `{ id, name, email, phone?, photo?, createdAt, bookingHistory, paymentHistory }` |
| Patient not found | Auth: STAFF (PATIENTS READ), Path: `/api/admin/patients/nonexistent` | 404 | `{ message: "Patient not found" }` |

---

### Test File: `tests/api/admin/payments.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch all payments | Auth: STAFF (PAYMENTS READ), Path: `/api/admin/payments` | 200 | `{ payments: [...], summary: { totalSuccess, totalRefunded, totalCount } }` |
| Fetch with filters | Auth: STAFF (PAYMENTS READ), Query: `?start=2024-03-01&end=2024-03-31&status=SUCCESS` | 200 | `{ payments: [...], summary: {...} }` (filtered) |
| Fetch without permission | Auth: STAFF (no PAYMENTS READ), Path: `/api/admin/payments` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/staff.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch all staff | Auth: STAFF (STAFF READ), Path: `/api/admin/staff` | 200 | `{ staff: [...] }` (excluding seed admin) |
| Fetch without permission | Auth: STAFF (no STAFF READ), Path: `/api/admin/staff` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/staff/index.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Create staff | Auth: STAFF (STAFF CREATE), Body: `{ name: "Staff User", email: "staff@test.com", permissions: [...] }` | 201 | `{ id, name, email, permissions, ... }` (no password) |
| Create with duplicate email | Auth: STAFF (STAFF CREATE), Body: `{ name: "Staff User", email: "existing@test.com", permissions: [...] }` | 400 | `{ message: "Email already in use" }` |
| Create without permission | Auth: STAFF (no STAFF CREATE), Body: `{ name: "Staff User", email: "staff@test.com", permissions: [...] }` | 403 | `{ message: "You do not have permission..." }` |
| Permissions are created in DB | Auth: STAFF (STAFF CREATE), Body: `{ name: "Staff User", email: "staff@test.com", permissions: [{ resource: "PATIENTS", action: "READ" }] }` | 201 | Verify `Permission` record exists in DB for the created staff |

---

### Test File: `tests/api/admin/staff/[id].patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Update staff | Auth: STAFF (STAFF UPDATE), Path: `/api/admin/staff/staff-1`, Body: `{ name: "New Name" }` | 200 | `{ id, name: "New Name", ... }` |
| Update permissions (full replace) | Auth: STAFF (STAFF UPDATE), Path: `/api/admin/staff/staff-1`, Body: `{ permissions: [{ resource: "DOCTORS", action: "READ" }] }` | 200 | `{ permissions: [{ resource: "DOCTORS", action: "READ" }] }` (old permissions replaced) |
| Update without permission | Auth: STAFF (no STAFF UPDATE), Path: `/api/admin/staff/staff-1` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/staff/[id].delete.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Deactivate staff | Auth: STAFF (STAFF DELETE), Path: `/api/admin/staff/staff-1` | 200 | `{ message: "Staff member deactivated successfully" }` |
| Deactivate seed admin | Auth: STAFF (STAFF DELETE), Path: `/api/admin/staff/seed-admin` (email matches SEED_ADMIN_EMAIL) | 403 | `{ message: "Cannot deactivate the platform administrator" }` |
| Deactivate without permission | Auth: STAFF (no STAFF DELETE), Path: `/api/admin/staff/staff-1` | 403 | `{ message: "You do not have permission..." }` |
| Soft delete only | Auth: STAFF (STAFF DELETE), Path: `/api/admin/staff/staff-1` | 200 | Verify `User.isActive` is `false` (not hard deleted) |

---

### Test File: `tests/api/admin/settings/index.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch settings | Auth: STAFF (SETTINGS READ), Path: `/api/admin/settings` | 200 | `{ id, platformName, contactEmail, ..., paymentGatewayKey: "****abcd", paymentGatewaySecret: "****abcd" }` |
| Payment keys are masked | Auth: STAFF (SETTINGS READ), Path: `/api/admin/settings` | 200 | Keys show only last 4 chars preceded by `****` |
| Never returns full key | Auth: STAFF (SETTINGS READ), Path: `/api/admin/settings` | 200 | Full key values are never returned |
| Fetch without permission | Auth: STAFF (no SETTINGS READ), Path: `/api/admin/settings` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/settings/index.patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Update non-key fields | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/settings`, Body: `{ platformName: "New Name" }` | 200 | `{ platformName: "New Name", ... }` |
| Update with masked keys | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/settings`, Body: `{ paymentGatewayKey: "****abcd" }` | 200 | Keys remain unchanged in DB |
| Update with real key | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/settings`, Body: `{ paymentGatewayKey: "real_key_123" }` | 200 | Key is updated in DB |
| Update without permission | Auth: STAFF (no SETTINGS UPDATE), Path: `/api/admin/settings` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/schedule/index.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch all schedule records | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/schedule` | 200 | `{ schedules: [...] }` (sorted by dayOfWeek) |
| Returns empty array when none exist | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/schedule` (empty DB) | 200 | `{ schedules: [] }` |
| Fetch without permission | Auth: STAFF (no SETTINGS UPDATE), Path: `/api/admin/schedule` | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/schedule/index.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Create valid record | Auth: STAFF (SETTINGS UPDATE), Body: `{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", sessionDuration: 60 }` | 201 | `{ id, dayOfWeek, startTime, endTime, sessionDuration, isActive }` |
| Invalid dayOfWeek | Auth: STAFF (SETTINGS UPDATE), Body: `{ dayOfWeek: 7, startTime: "09:00", endTime: "17:00", sessionDuration: 60 }` | 400 | `{ message: "Invalid day of week" }` |
| startTime >= endTime | Auth: STAFF (SETTINGS UPDATE), Body: `{ dayOfWeek: 1, startTime: "17:00", endTime: "09:00", sessionDuration: 60 }` | 400 | `{ message: "Start time must be before end time" }` |
| Invalid sessionDuration | Auth: STAFF (SETTINGS UPDATE), Body: `{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", sessionDuration: 90 }` | 400 | `{ message: "Invalid session duration" }` |
| Without permission | Auth: STAFF (no SETTINGS UPDATE) | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/schedule/[id].patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Update record | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/schedule/sched-1`, Body: `{ isActive: false }` | 200 | `{ id, isActive: false, ... }` |
| Record not found | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/schedule/nonexistent` | 404 | `{ message: "Schedule record not found" }` |

---

### Test File: `tests/api/admin/schedule/[id].delete.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Delete record | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/schedule/sched-1` | 200 | `{ message: "Schedule record deleted successfully" }` |
| Record not found | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/schedule/nonexistent` | 404 | `{ message: "Schedule record not found" }` |

---

### Test File: `tests/api/admin/blocked-dates/index.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch blocked dates | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/blocked-dates` | 200 | `{ blockedDates: [...] }` (sorted by date ASC) |
| Returns empty array when none exist | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/blocked-dates` | 200 | `{ blockedDates: [] }` |
| Without permission | Auth: STAFF (no SETTINGS UPDATE) | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/blocked-dates/index.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Create valid blocked date | Auth: STAFF (SETTINGS UPDATE), Body: `{ date: "2024-03-15", reason: "Holiday" }` | 201 | `{ blockedDate: { id, date, reason } }` |
| Past date | Auth: STAFF (SETTINGS UPDATE), Body: `{ date: "2020-01-01" }` | 400 | `{ message: "Date must be in the future" }` |
| Without permission | Auth: STAFF (no SETTINGS UPDATE) | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/blocked-dates/[id].delete.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Delete blocked date | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/blocked-dates/block-1` | 200 | `{ message: "Blocked date removed successfully" }` |
| Not found | Auth: STAFF (SETTINGS UPDATE), Path: `/api/admin/blocked-dates/nonexistent` | 404 | `{ message: "Blocked date not found" }` |

---

### Test File: `tests/api/admin/bookings/pending.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch PENDING bookings | Auth: STAFF (APPOINTMENTS READ), Path: `/api/admin/bookings/pending` | 200 | `{ pendingBookings: [...] }` (only status PENDING, doctorId null) |
| Returns empty array when none exist | Auth: STAFF (APPOINTMENTS READ), Path: `/api/admin/bookings/pending` | 200 | `{ pendingBookings: [] }` |
| Without permission | Auth: STAFF (no APPOINTMENTS READ) | 403 | `{ message: "You do not have permission..." }` |

---

### Test File: `tests/api/admin/bookings/[id]/assign.patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Assign doctor to PENDING booking | Auth: STAFF (APPOINTMENTS UPDATE), Path: `/api/admin/bookings/book-1/assign`, Body: `{ doctorId: "doc-1" }` | 200 | Booking has `doctorId: "doc-1"`, status CONFIRMED; confirmation email sent to patient |
| Assign non-PENDING booking | Auth: STAFF (APPOINTMENTS UPDATE), Path: `/api/admin/bookings/book-1/assign` (status CONFIRMED) | 400 | `{ message: "Only PENDING bookings can be assigned" }` |
| Assign inactive doctor | Auth: STAFF (APPOINTMENTS UPDATE), Body: `{ doctorId: "doc-inactive" }` (isActive false) | 400 | `{ message: "Doctor not found or inactive" }` |
| Assign doctor with conflicting booking | Auth: STAFF (APPOINTMENTS UPDATE), Body: `{ doctorId: "doc-1" }` (doctor already CONFIRMED at same date/time) | 400 | `{ message: "Doctor already has a booking at this time" }` |
| Without permission | Auth: STAFF (no APPOINTMENTS UPDATE) | 403 | `{ message: "You do not have permission..." }` |
| Sends email to doctor on success | Auth: STAFF (APPOINTMENTS UPDATE), Body: `{ doctorId: "doc-1" }` | 200 | Notification email sent to doctor (verify via mock) |

---

## End-to-End Tests (Playwright)

---

### Test File: `tests/e2e/admin-dashboard.spec.ts`

#### Test: Non-Staff User Redirected from Admin
- **Starting State:** Logged in as PATIENT, on `/admin/overview`.
- **Steps:**
  1. Navigate to `/admin/overview`.
- **Assertions:**
  - Redirected to `/dashboard`.

#### Test: Admin Redirect Works
- **Starting State:** Logged in as STAFF, on `/admin`.
- **Steps:**
  1. Navigate to `/admin`.
- **Assertions:**
  - Redirected to `/admin/overview`.

#### Test: Sidebar Filters by Permissions
- **Starting State:** Logged in as STAFF with only `PATIENTS READ` permission, on `/admin/overview`.
- **Steps:**
  1. Check sidebar links.
- **Assertions:**
  - Only Overview, Manage Patients, and Logout are visible.
  - All Appointments, Manage Doctors, Manage Payments, Manage Staff, Settings are hidden.

#### Test: Overview Page Loads
- **Starting State:** Logged in as STAFF (full permissions), on `/admin/overview`.
- **Steps:**
  1. Navigate to `/admin/overview`.
- **Assertions:**
  - Stats cards are visible with correct values.
  - Recent bookings table shows last 5 bookings.

#### Test: Master Calendar Loads
- **Starting State:** Logged in as STAFF (APPOINTMENTS READ), on `/admin/appointments`.
- **Steps:**
  1. Navigate to `/admin/appointments`.
  2. Wait for calendar to load.
- **Assertions:**
  - Calendar shows all bookings.
  - Bookings are color-coded by doctor.
  - Doctor filter dropdown is visible.
  - Status filter dropdown is visible.

#### Test: Master Calendar Doctor Filter Works
- **Starting State:** Logged in as STAFF (APPOINTMENTS READ), on `/admin/appointments`.
- **Steps:**
  1. Select a doctor from the filter dropdown.
- **Assertions:**
  - Calendar shows only bookings for the selected doctor.

#### Test: Booking Detail Modal Opens
- **Starting State:** Logged in as STAFF (APPOINTMENTS READ), on `/admin/appointments`.
- **Steps:**
  1. Click a booking event on the calendar.
- **Assertions:**
  - Modal opens with booking details.
  - Patient name, doctor name, date, time, service, and status are visible.

#### Test: Cancel Booking from Admin
- **Starting State:** Logged in as STAFF (APPOINTMENTS DELETE), on `/admin/appointments`.
- **Steps:**
  1. Click a booking event.
  2. Click "Cancel Booking" in the modal.
  3. Confirm in the confirmation dialog.
- **Assertions:**
  - Modal closes.
  - Booking is removed from calendar (or status updates to CANCELLED).
  - Cancellation email is sent to patient (verify via API or mock).

#### Test: Admin Schedule Setup
- **Starting State:** Logged in as admin, on `/admin/settings` (Schedule section).
- **Steps:**
  1. Go to Settings → Schedule section.
  2. Enable Monday with 09:00–17:00, 60 min sessions.
  3. Click "Save Schedule".
  4. Visit `/book` as patient.
- **Assertions:**
  - Schedule save succeeds.
  - Monday dates are now available on `/book`.

#### Test: Admin Blocks a Date
- **Starting State:** Logged in as admin, on `/admin/settings` (Blocked Dates section).
- **Steps:**
  1. Block tomorrow's date with an optional reason.
  2. Visit `/book` as patient.
- **Assertions:**
  - Blocked date is saved and shown in the list.
  - Tomorrow is not available on `/book`.

#### Test: Admin Assigns Doctor to Pending Booking
- **Starting State:** Patient has booked a session (payment succeeds, booking PENDING); STAFF logged in on `/admin/appointments`.
- **Steps:**
  1. Go to Appointments → Pending tab.
  2. Click "Assign Doctor" on the booking.
  3. Select an active doctor from the dropdown.
  4. Click "Confirm Assignment".
- **Assertions:**
  - Booking moves from the Pending tab to the master calendar as CONFIRMED.
  - Patient receives confirmation email (verify via mock).
  - Doctor receives notification email (verify via mock).
  - Success toast appears and the row is removed from the pending table.

#### Test: Cannot Assign Inactive Doctor or Conflicting Doctor
- **Starting State:** Patient PENDING booking exists; STAFF with APPOINTMENTS UPDATE.
- **Steps:**
  1. Open Assign Doctor modal.
  2. Attempt to assign an inactive doctor, then a doctor already booked at that time.
- **Assertions:**
  - Error message "Doctor not found or inactive" / "Doctor already has a booking at this time" appears.
  - Booking status remains PENDING.

#### Test: Manage Doctors Page Loads
- **Starting State:** Logged in as STAFF (DOCTORS READ), on `/admin/doctors`.
- **Steps:**
  1. Navigate to `/admin/doctors`.
- **Assertions:**
  - Doctors table shows all doctors.
  - Add Doctor button is visible (if DOCTORS CREATE permission).

#### Test: Add Doctor Flow
- **Starting State:** Logged in as STAFF (DOCTORS CREATE), on `/admin/doctors`.
- **Steps:**
  1. Click "Add Doctor".
  2. Fill in name, email, phone, bio, specializations.
  3. Click "Save".
- **Assertions:**
  - Success toast appears.
  - Doctor appears in the table.
  - Welcome email is sent to doctor (verify via API or mock).

#### Test: Doctor Detail Page Loads
- **Starting State:** Logged in as STAFF (DOCTORS READ), on `/admin/doctors/doc-1`.
- **Steps:**
  1. Navigate to `/admin/doctors/doc-1`.
- **Assertions:**
  - Profile tab shows doctor details.
  - Calendar tab shows doctor's bookings.
  - Availability tab shows doctor's availability and blocked slots.

#### Test: Doctor Availability Management
- **Starting State:** Logged in as STAFF (DOCTORS UPDATE), on `/admin/doctors/doc-1` (Availability tab).
- **Steps:**
  1. Update availability for a day.
  2. Click "Save Availability".
  3. Add a blocked slot.
  4. Delete the blocked slot.
- **Assertions:**
  - Availability updates successfully.
  - Blocked slot is added and visible.
  - Blocked slot is removed after deletion.

#### Test: Manage Patients Page Loads
- **Starting State:** Logged in as STAFF (PATIENTS READ), on `/admin/patients`.
- **Steps:**
  1. Navigate to `/admin/patients`.
- **Assertions:**
  - Patients table shows all patients.
  - Search input works.

#### Test: Patient Detail Page Loads
- **Starting State:** Logged in as STAFF (PATIENTS READ), on `/admin/patients/patient-1`.
- **Steps:**
  1. Navigate to `/admin/patients/patient-1`.
- **Assertions:**
  - Patient profile is visible.
  - Booking history table is visible.
  - Payment history table is visible.

#### Test: Manage Payments Page Loads
- **Starting State:** Logged in as STAFF (PAYMENTS READ), on `/admin/payments`.
- **Steps:**
  1. Navigate to `/admin/payments`.
- **Assertions:**
  - Stats cards show total revenue, revenue this month, total refunded.
  - Payments table shows all payments.
  - Filter bar is visible.

#### Test: Payments Filter Works
- **Starting State:** Logged in as STAFF (PAYMENTS READ), on `/admin/payments`.
- **Steps:**
  1. Select a date range.
  2. Select a doctor.
  3. Select a status.
- **Assertions:**
  - Table updates with filtered results.

#### Test: Manage Staff Page Loads
- **Starting State:** Logged in as STAFF (STAFF READ), on `/admin/staff`.
- **Steps:**
  1. Navigate to `/admin/staff`.
- **Assertions:**
  - Staff table shows all staff (excluding seed admin).
  - Add Staff button is visible (if STAFF CREATE permission).

#### Test: Add Staff Flow
- **Starting State:** Logged in as STAFF (STAFF CREATE), on `/admin/staff`.
- **Steps:**
  1. Click "Add Staff".
  2. Fill in name, email, phone.
  3. Assign permissions (e.g., PATIENTS READ).
  4. Click "Save".
- **Assertions:**
  - Success toast appears.
  - Staff member appears in the table.
  - Welcome email is sent to staff (verify via API or mock).

#### Test: Edit Staff Permissions
- **Starting State:** Logged in as STAFF (STAFF UPDATE), on `/admin/staff`.
- **Steps:**
  1. Click "Edit" on a staff member.
  2. Change permissions (e.g., add DOCTORS READ).
  3. Click "Save".
  4. Log in as the staff member.
- **Assertions:**
  - Permissions update successfully.
  - Staff member can now see Manage Doctors in sidebar.

#### Test: Deactivate Staff
- **Starting State:** Logged in as STAFF (STAFF DELETE), on `/admin/staff`.
- **Steps:**
  1. Click "Deactivate" on a staff member (not seed admin).
  2. Confirm in the modal.
- **Assertions:**
  - Success toast appears.
  - Staff member's status updates to Inactive.
  - Staff member cannot log in (verify in Phase 1 flow).

#### Test: Cannot Deactivate Seed Admin
- **Starting State:** Logged in as STAFF (STAFF DELETE), on `/admin/staff`.
- **Steps:**
  1. Attempt to deactivate the seed admin (email matches SEED_ADMIN_EMAIL).
- **Assertions:**
  - Error message "Cannot deactivate the platform administrator" appears.
  - Seed admin remains active.

#### Test: Settings Page Loads
- **Starting State:** Logged in as STAFF (SETTINGS READ), on `/admin/settings`.
- **Steps:**
  1. Navigate to `/admin/settings`.
- **Assertions:**
  - All settings sections are visible.
  - Payment keys are masked (e.g., `****abcd`).

#### Test: Update Settings
- **Starting State:** Logged in as STAFF (SETTINGS UPDATE), on `/admin/settings`.
- **Steps:**
  1. Update platform name.
  2. Click "Save" in Platform Info section.
- **Assertions:**
  - Success toast appears.
  - Platform name updates in the UI.

#### Test: Payment Keys Masked
- **Starting State:** Logged in as STAFF (SETTINGS READ), on `/admin/settings`.
- **Steps:**
  1. Check payment gateway section.
- **Assertions:**
  - API Key and Secret fields show masked values (e.g., `****abcd`).
  - "Update Keys" toggle is visible.

---

## Manual Verification Checklist

Complete every item below before marking Phase 6 as done:

1. **Authentication & Authorization:**
   - [ ] Non-staff roles redirected from `/admin` routes.
   - [ ] Staff with no permissions can only see Overview and Logout.

2. **Sidebar:**
   - [ ] Sidebar shows only links the user has READ permission for.
   - [ ] Overview is always visible.
   - [ ] Logout is always visible.

3. **Overview:**
   - [ ] Stats are accurate (verify against DB counts).
   - [ ] Recent bookings table shows correct data.

4. **Master Calendar / Appointments:**
   - [ ] Shows all bookings across all doctors.
   - [ ] Bookings are color-coded by doctor.
   - [ ] Doctor filter works correctly.
   - [ ] Status filter works correctly.
   - [ ] Clicking a booking opens detail modal.
   - [ ] Cancel button in modal works (if APPOINTMENTS DELETE permission).
   - [ ] Pending Bookings tab lists PENDING bookings (doctorId null).
   - [ ] Assign Doctor modal lists active doctors and shows their existing bookings for the date.
   - [ ] Assigning a doctor confirms the booking (status CONFIRMED) and moves it to the master calendar.
   - [ ] Assigning an inactive doctor or a doctor already booked at that time shows an error.

5. **Scheduling & Blocked Dates (Settings):**
   - [ ] Schedule section shows a row per day of week with enable toggle, start/end time, session duration.
   - [ ] Saving the schedule updates what is shown as available on `/book`.
   - [ ] Blocked Dates section lists upcoming blocked dates with reason and remove button.
   - [ ] Blocking a future date removes that date from `/book`.

6. **Doctors:**
   - [ ] Add Doctor creates account and sends welcome email.
   - [ ] New doctor can log in with emailed credentials.
   - [ ] Edit Doctor updates profile correctly.
   - [ ] Doctor detail page shows profile, calendar, and availability.
   - [ ] Availability management works (add/edit/remove).
   - [ ] Blocked slots management works (add/remove).

7. **Patients:**
   - [ ] Patients table shows all patients.
   - [ ] Search works correctly.
   - [ ] Patient detail page shows profile, booking history, and payment history.

8. **Payments:**
   - [ ] Stats cards show correct totals.
   - [ ] Filters work correctly (date range, doctor, status).
   - [ ] Table shows all payments with correct data.

9. **Staff:**
   - [ ] Staff table shows all staff (excluding seed admin).
   - [ ] Add Staff creates account with correct permissions.
   - [ ] Edit Staff updates permissions correctly.
   - [ ] Staff member with only PATIENTS READ cannot access `/admin/doctors`.
   - [ ] Editing staff permissions replaces old permissions completely.
   - [ ] Deactivating staff prevents their login.
   - [ ] Seed admin cannot be deactivated.

10. **Settings:**
    - [ ] All sections load with correct data.
    - [ ] Payment keys are always masked in API responses.
    - [ ] Updating settings without changing keys does not overwrite existing keys.
    - [ ] Individual save buttons work for each section.

11. **UI/UX:**
    - [ ] All pages are mobile-responsive (375px viewport).
    - [ ] Loading states are shown during API calls.
    - [ ] Error messages are user-friendly.
    - [ ] Success toasts appear for actions.
    - [ ] Permission builder modal is scrollable on mobile.

12. **Security:**
    - [ ] Staff without PATIENTS READ cannot call GET /api/admin/patients.
    - [ ] Staff without DOCTORS READ cannot see Manage Doctors in sidebar.
    - [ ] Permission check queries the database on every request.

---

## Completion Criteria

Mark each item PASS or FAIL with a note before handing off to Phase 7:

```
[ ] All API tests pass (0 failures) — run `npm run test:api`
[ ] All Playwright tests pass (0 failures) — run `npm run test:e2e`
[ ] No TypeScript errors — `npx tsc --noEmit` shows 0 errors
[ ] Manual verification checklist completed
[ ] No console errors in the browser on any admin page
[ ] Non-staff roles redirected from /admin routes
[ ] Staff with no APPOINTMENTS READ permission cannot see All Appointments in sidebar
[ ] Overview stats are accurate
[ ] Master calendar shows all bookings, color-coded by doctor
[ ] Doctor filter works correctly on master calendar
[ ] Admin can cancel any booking without 24hr restriction
[ ] Admin can view PENDING bookings and assign a doctor (status -> CONFIRMED, emails sent)
[ ] Admin can configure the global schedule; it drives patient booking availability on /book
[ ] Admin can block dates; blocked dates are unavailable to patients on /book
[ ] Add Doctor creates account and sends welcome email
[ ] New doctor can log in with emailed credentials
[ ] Add Staff creates account with correct permissions
[ ] Staff member with only PATIENTS READ cannot access /admin/doctors
[ ] Editing staff permissions replaces old permissions completely
[ ] Deactivating staff prevents their login
[ ] Payment keys are always masked in API responses
[ ] Updating settings without changing keys does not overwrite existing keys
[ ] Doctor availability management works from admin panel
[ ] Seed admin account cannot be deactivated
[ ] Permission check queries the database on every request
[ ] All pages are mobile-responsive
```

**The phase is complete only when all 28 items above are marked PASS.**

If any item is FAIL, fix it before moving to Phase 7. Document what failed and what was done to fix it in a `notes.md` file inside the `phase-6/` folder.
