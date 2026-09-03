# Tawasul Academy — Architecture Fix Prompt
## Booking System: Doctor-Controlled → Admin-Controlled

---

## Context

You are working on the Tawasul Academy platform. A diagnostic report has revealed a critical architecture mismatch in the booking system. The current code assumes doctors control their own availability, but the intended business model requires the admin to control all availability globally, and the patient does not choose a doctor at booking time.

You will fix this in two sequential tracks:

**Track 1 — Fix the Planning Files** (phase documentation)
**Track 2 — Fix the Code** (actual implementation)

Do not start Track 2 until Track 1 is complete.

---

## The Problem in One Sentence

The `Availability` model is tied to `doctorId`, so the booking calendar only shows available slots when doctors have configured their own availability. Since no doctors have configured availability (and that is not the intended workflow), the calendar shows all days as unavailable.

---

## The Intended Architecture

```
Admin configures global schedule (AdminSchedule model)
        ↓
Patient visits /book — sees available dates on calendar
(no doctor selection — patient does not know or choose the doctor)
        ↓
Patient selects a slot and pays
        ↓
Booking created with status PENDING (no doctorId yet)
        ↓
Admin reviews the booking in the admin dashboard
        ↓
Admin assigns a doctor to the booking
        ↓
Booking status changes to CONFIRMED
        ↓
Patient and doctor both receive confirmation emails
        ↓
Session proceeds as normal
```

---

## Track 1 — Fix the Planning Files

### Files to Read First

Before making any changes, read these files completely:

1. `phases/phase-3-booking/overview.md`
2. `phases/phase-3-booking/flow.md`
3. `phases/phase-3-booking/expected-output.md`
4. `phases/phase-3-booking/testing.md`
5. `phases/phase-6-admin-dashboard/overview.md`
6. `phases/phase-6-admin-dashboard/flow.md`
7. `phases/phase-6-admin-dashboard/expected-output.md`
8. `phases/phase-6-admin-dashboard/testing.md`
9. `prisma/schema.prisma`
10. `tawasul_mvp_v2.md`

---

### Changes to Make in Phase 3 Files

#### `phases/phase-3-booking/overview.md`

**In the Goal section**, replace any mention of "doctor availability" or "doctor-controlled slots" with the admin-controlled model. The goal must state clearly:

> The booking calendar shows slots configured by the admin through a global schedule. The patient does not select a doctor. The booking is created without a doctorId and remains PENDING until the admin assigns a doctor and confirms it.

**In the Scope section**, replace:

Old:
```
- Availability Logic: server/utils/availability.ts with getAvailableSlots(date) and getAvailableDates(month, year)
```

New:
```
- Admin Availability Logic: server/utils/admin-availability.ts with getAdminAvailableSlots(date) and getAdminAvailableDates(month, year)
- These functions read from the AdminSchedule model (global, admin-controlled) not from the Availability model (doctor-controlled)
```

**In the Dependencies section**, remove any mention of doctors needing to configure availability before the booking flow works.

**In the Stack Used section**, no changes needed.

**In the Folder Structure section**, update:

Remove:
```
server/
└── utils/
    └── availability.ts
```

Add:
```
server/
└── utils/
    └── admin-availability.ts    (replaces availability.ts for booking flow)
```

**In the Key Conventions section**, add:

```
- Booking without doctor: The create booking endpoint does NOT require doctorId. It is null until admin assigns a doctor.
- Availability source: All availability calculations use AdminSchedule model, never the Availability model. The Availability model remains in the schema for doctor calendar display (Phase 5) but is not used in the booking flow.
- Booking status flow: PENDING (after payment) → CONFIRMED (after admin assigns doctor). The IN_REVIEW status is reserved for future use.
```

---

#### `phases/phase-3-booking/flow.md`

**Replace the entire "Availability Logic" feature section** with a new section:

```
## Feature 1 — Admin Availability Logic

File: server/utils/admin-availability.ts

This utility is the single source of truth for what dates and slots are available to patients. It reads from the AdminSchedule model, not from the doctor Availability model.

### `getAdminAvailableDates(month: number, year: number): Promise<string[]>`

Logic:
1. Fetch all active AdminSchedule records: prisma.adminSchedule.findMany({ where: { isActive: true } })
2. If no records exist, return [].
3. Fetch all GlobalBlockedDate records for the given month.
4. Fetch all CONFIRMED Bookings for the given month (to calculate which slots are fully booked on a given day).
5. For each day in the month:
   a. Get the dayOfWeek (0-6) for that date.
   b. Find all AdminSchedule records matching that dayOfWeek.
   c. If none found, skip this date (not available).
   d. Check if the date is in GlobalBlockedDate — if yes, skip.
   e. Generate all possible time slots by splitting each schedule window into sessionDuration chunks.
   f. Count how many slots are already taken by CONFIRMED bookings on this date.
   g. If at least one slot remains, add this date to the result array.
6. Return array of date strings (YYYY-MM-DD format) that have at least one available slot.

### `getAdminAvailableSlots(date: string): Promise<AdminSlot[]>`

An AdminSlot is: { startTime: string, endTime: string, sessionDuration: number }

Note: AdminSlots do NOT have a doctorId. The doctor is assigned later by the admin.

Logic:
1. Parse the date, get dayOfWeek (0-6).
2. If the date is in the past, return [].
3. Fetch all active AdminSchedule records matching dayOfWeek.
4. If none found, return [].
5. Check if the date is in GlobalBlockedDate — if yes, return [].
6. Fetch all CONFIRMED Bookings for this date (to block already-taken slots).
7. For each AdminSchedule record, generate time slots by splitting the window into sessionDuration chunks.
8. Remove slots that overlap with any CONFIRMED booking on this date.
9. If date is today, remove slots where startTime is in the past.
10. Return remaining slots sorted by startTime ascending.
```

**Update the `POST /api/booking/create` section:**

Replace the request body:
```
Old:
{
  date: string,
  startTime: string,
  doctorId: string      ← REMOVE THIS
}

New:
{
  date: string,
  startTime: string
}
```

Replace the server logic:

Remove steps that reference doctorId validation or doctor lookup.

New server logic:
1. Call `requireAuth(event, ['PATIENT'])`.
2. Validate body with Zod: `date` (YYYY-MM-DD), `startTime` ("HH:MM").
3. Re-validate the slot is still available by calling `getAdminAvailableSlots(date)` and checking the startTime exists in the result. If not → 400 "This slot is no longer available."
4. Calculate endTime based on the matching AdminSchedule's sessionDuration.
5. Fetch session price from Settings.
6. Create Booking with: `userId` from auth context, `doctorId: null`, `date`, `startTime`, `endTime`, `status: PENDING`.
7. Create linked Payment with status PENDING and the correct amount.
8. Return `{ bookingId, amount, currency }`.

**Update the frontend booking flow section:**

In the slot selection step, remove all references to doctor name or doctor selection. The patient sees only: date, time, duration, price.

In the booking summary step (Step 2), remove "Doctor name" from the summary card. Replace with:
```
- Date: Monday, 4 March 2024
- Time: 10:00 AM – 11:00 AM
- Session Duration: 60 minutes
- Price: [from Settings]
```

**Update the confirmation email section:**

The booking confirmation email is NOT sent immediately after payment. It is sent after the admin assigns a doctor and confirms the booking. After payment, send a "booking received" acknowledgment email instead:

```
Trigger: payment webhook success
Email: bookingReceivedTemplate(patientName, date, time)
Subject: "Your booking request has been received — Tawasul Academy"
Content: "We have received your booking request for [date] at [time]. Our team will review and confirm your session shortly. You will receive a confirmation email with your session details once confirmed."
```

Add a new email template to `server/utils/email.ts`:
```
bookingReceivedTemplate(patientName: string, date: string, time: string): string
```

---

#### `phases/phase-3-booking/expected-output.md`

**Update the API Endpoints Delivered table:**

Change the create booking row:
```
Old: POST /api/booking/create — requires doctorId in body
New: POST /api/booking/create — no doctorId required, booking created with doctorId: null
```

**Update the Server Utilities Delivered table:**

Replace:
```
server/utils/availability.ts — getAvailableSlots, getAvailableDates
```

With:
```
server/utils/admin-availability.ts — getAdminAvailableSlots(date), getAdminAvailableDates(month, year)
```

Add a note:
```
Note: server/utils/availability.ts (doctor-controlled) remains in the codebase for use by the Doctor Dashboard calendar (Phase 5). It is NOT used in the patient booking flow.
```

**Update the Emails Sent table:**

Replace booking confirmation email with:
```
| Payment webhook success | Patient | bookingReceivedTemplate | patientName, date, time |
| Admin confirms booking (Phase 6) | Patient + Doctor | bookingConfirmationTemplate | patientName, doctorName, date, time, service |
```

---

#### `phases/phase-3-booking/testing.md`

**Update the unit tests section for availability:**

Replace `getAvailableSlots` and `getAvailableDates` tests with tests for the new `getAdminAvailableSlots` and `getAdminAvailableDates` functions. The test cases are structurally the same but mock `prisma.adminSchedule.findMany` and `prisma.globalBlockedDate.findMany` instead of `prisma.availability.findMany`.

Key test cases to add:
```
getAdminAvailableDates:
- Returns empty array when no AdminSchedule records exist
- Returns empty array when all days are in GlobalBlockedDate
- Returns correct dates when AdminSchedule records exist for certain days
- Does not return dates that are fully booked

getAdminAvailableSlots:
- Returns empty array when no AdminSchedule records exist for the dayOfWeek
- Returns empty array when date is in GlobalBlockedDate
- Excludes slots that overlap with CONFIRMED bookings
- Excludes past slots when date is today
- Returns slots sorted by startTime
```

**Update the API tests for booking create:**

Change the test for `POST /api/booking/create`:
```
Old test: "Create booking with valid slot" — body includes doctorId
New test: "Create booking with valid slot" — body has only date and startTime, response bookingId refers to booking with doctorId: null
```

Add test:
```
"Booking created without doctorId" — verify the created Booking record in DB has doctorId: null
```

---

### Changes to Make in Phase 6 Files

#### `phases/phase-6-admin-dashboard/overview.md`

**In the Scope section**, add these new items:

```
- AdminSchedule Management: CRUD endpoints for global schedule configuration
- GlobalBlockedDate Management: CRUD endpoints for blocking specific dates
- Booking Review Workflow: Endpoints for admin to view pending bookings, assign doctors, and confirm
- Booking assignment: Admin assigns a doctor to a PENDING booking and changes status to CONFIRMED
```

**In the Folder Structure section**, add to the admin server API folder:

```
modules/admin/server/api/admin/
├── schedule/
│   ├── index.get.ts          (GET /api/admin/schedule — list all AdminSchedule records)
│   ├── index.post.ts         (POST /api/admin/schedule — create AdminSchedule record)
│   ├── [id].patch.ts         (PATCH /api/admin/schedule/:id — update)
│   └── [id].delete.ts        (DELETE /api/admin/schedule/:id — delete)
├── blocked-dates/
│   ├── index.get.ts          (GET /api/admin/blocked-dates — list all GlobalBlockedDate records)
│   ├── index.post.ts         (POST /api/admin/blocked-dates — create)
│   └── [id].delete.ts        (DELETE /api/admin/blocked-dates/:id — delete)
└── bookings/
    ├── pending.get.ts         (GET /api/admin/bookings/pending — list PENDING bookings)
    ├── [id]/
    │   ├── assign.patch.ts    (PATCH /api/admin/bookings/:id/assign — assign doctor)
    │   └── cancel.patch.ts    (already exists)
```

---

#### `phases/phase-6-admin-dashboard/flow.md`

**Add new Feature sections:**

---

**Feature: AdminSchedule Management**

Endpoints: GET, POST, PATCH, DELETE /api/admin/schedule
Permission: SETTINGS UPDATE (reuse existing permission or add SCHEDULE permission)

GET /api/admin/schedule:
- Returns all AdminSchedule records
- Response: `{ schedules: [{ id, dayOfWeek, startTime, endTime, sessionDuration, isActive }] }`

POST /api/admin/schedule:
- Body: `{ dayOfWeek: number (0-6), startTime: string, endTime: string, sessionDuration: number (30|45|60) }`
- Validates dayOfWeek is 0-6, startTime is before endTime, sessionDuration is valid
- Creates AdminSchedule record
- Returns created record

PATCH /api/admin/schedule/:id:
- Body: `{ startTime?, endTime?, sessionDuration?, isActive? }` — all optional
- Updates the record
- Returns updated record

DELETE /api/admin/schedule/:id:
- Deletes the record
- Returns 200

Frontend — Settings page, new "Schedule" section:
- Show a row per day of week (Sunday through Saturday)
- Each row: toggle to enable/disable, start time picker, end time picker, session duration selector (30/45/60 min)
- "Save Schedule" button — calls POST/PATCH as needed
- Preview below: "Based on this schedule, X slots are available per week"

---

**Feature: GlobalBlockedDate Management**

Endpoints: GET, POST, DELETE /api/admin/blocked-dates
Permission: SETTINGS UPDATE

GET: Returns all future GlobalBlockedDate records sorted by date ascending.
POST: Body `{ date: string (YYYY-MM-DD), reason?: string }`. Validates date is in the future. Creates record.
DELETE: Deletes by id.

Frontend — Settings page, new "Blocked Dates" section:
- List of upcoming blocked dates with date, reason, and remove button
- "Block a Date" button opens a modal with date picker and optional reason field

---

**Feature: Pending Booking Review**

Endpoint: GET /api/admin/bookings/pending
Permission: APPOINTMENTS READ

Returns all bookings with status PENDING, sorted by date ascending.
For each booking: id, patientName, patientEmail, patientPhone, date, startTime, endTime, status, createdAt.
Note: doctorId is null for all pending bookings — doctor assignment has not happened yet.

---

**Feature: Doctor Assignment**

Endpoint: PATCH /api/admin/bookings/:id/assign
Permission: APPOINTMENTS UPDATE

Body: `{ doctorId: string }`

Server logic:
1. Call `requirePermission(event, 'APPOINTMENTS', 'UPDATE')`.
2. Fetch Booking by id. Verify status is PENDING. If not → 400 "Only PENDING bookings can be assigned."
3. Fetch Doctor by doctorId. Verify doctor exists and isActive is true. If not → 400 "Doctor not found or inactive."
4. Check that the doctor does not already have a CONFIRMED booking that overlaps with this booking's date and time.
   - If overlap found → 400 "Doctor already has a booking at this time."
5. Update Booking: `{ doctorId, status: CONFIRMED }`.
6. Send booking confirmation email to patient using `bookingConfirmationTemplate`.
7. Send booking notification email to doctor using `bookingConfirmationTemplate`.
8. Return 200 with updated booking.

Frontend — Admin Appointments page, new "Pending Bookings" tab:
- Table of pending bookings with columns: Patient, Date, Time, Requested On, Actions
- "Assign Doctor" button on each row opens a modal:
  - Dropdown of active doctors
  - Shows doctor's existing bookings for that date (to avoid conflicts)
  - "Confirm Assignment" button
- After assignment: booking moves from Pending tab to Confirmed bookings on the master calendar

---

#### `phases/phase-6-admin-dashboard/expected-output.md`

**Add to API Endpoints Delivered table:**

```
| GET    | /api/admin/schedule              | STAFF | SETTINGS UPDATE | List all AdminSchedule records |
| POST   | /api/admin/schedule              | STAFF | SETTINGS UPDATE | Create an AdminSchedule record |
| PATCH  | /api/admin/schedule/:id          | STAFF | SETTINGS UPDATE | Update an AdminSchedule record |
| DELETE | /api/admin/schedule/:id          | STAFF | SETTINGS UPDATE | Delete an AdminSchedule record |
| GET    | /api/admin/blocked-dates         | STAFF | SETTINGS UPDATE | List all GlobalBlockedDate records |
| POST   | /api/admin/blocked-dates         | STAFF | SETTINGS UPDATE | Create a GlobalBlockedDate record |
| DELETE | /api/admin/blocked-dates/:id     | STAFF | SETTINGS UPDATE | Delete a GlobalBlockedDate record |
| GET    | /api/admin/bookings/pending      | STAFF | APPOINTMENTS READ | List all PENDING bookings |
| PATCH  | /api/admin/bookings/:id/assign   | STAFF | APPOINTMENTS UPDATE | Assign doctor and confirm booking |
```

**Add to Database Changes section:**

```
New models added in this phase:

AdminSchedule:
- id: String (cuid)
- dayOfWeek: Int (0-6)
- startTime: String ("09:00")
- endTime: String ("17:00")
- sessionDuration: Int (minutes)
- isActive: Boolean (default true)
- createdAt: DateTime
- updatedAt: DateTime

GlobalBlockedDate:
- id: String (cuid)
- date: DateTime (@db.Date)
- reason: String? (optional)
- createdAt: DateTime

Changes to existing models:
- Booking.doctorId: Changed from required String to optional String? (nullable)
- BookingStatus enum: Added IN_REVIEW (reserved for future use)
```

**Add to Emails Sent table:**

```
| Admin assigns doctor and confirms booking | Patient | bookingConfirmationTemplate | patientName, doctorName, date, time, service |
| Admin assigns doctor and confirms booking | Doctor  | bookingConfirmationTemplate | patientName, doctorName, date, time, service |
```

---

#### `phases/phase-6-admin-dashboard/testing.md`

**Add API test cases for new endpoints:**

```
GET /api/admin/schedule:
- Returns all AdminSchedule records
- Returns empty array when none exist
- Returns 403 without SETTINGS UPDATE permission

POST /api/admin/schedule:
- Creates record with valid data
- Returns 400 for invalid dayOfWeek (< 0 or > 6)
- Returns 400 when startTime >= endTime
- Returns 400 for invalid sessionDuration (not 30, 45, or 60)
- Returns 403 without permission

PATCH /api/admin/bookings/:id/assign:
- Assigns doctor and changes status to CONFIRMED
- Returns 400 if booking is not PENDING
- Returns 400 if doctor is inactive
- Returns 400 if doctor has conflicting booking at same date/time
- Returns 403 without APPOINTMENTS UPDATE permission
- Sends confirmation email to patient on success
- Sends notification email to doctor on success

GET /api/admin/bookings/pending:
- Returns only PENDING bookings
- Returns empty array when none exist
- Bookings have doctorId: null
- Returns 403 without APPOINTMENTS READ permission
```

**Add Playwright E2E test scenarios:**

```
Test: Admin Schedule Setup
- Log in as admin, go to Settings → Schedule tab
- Enable Monday with 09:00–17:00, 60 min sessions
- Save
- Visit /book as patient — verify Monday dates are now available

Test: Admin Blocks a Date
- Log in as admin, go to Settings → Blocked Dates
- Block tomorrow's date
- Visit /book as patient — verify tomorrow is not available

Test: Admin Assigns Doctor to Pending Booking
- Patient books a session (payment succeeds, booking is PENDING)
- Log in as admin, go to Appointments → Pending tab
- Click "Assign Doctor" on the booking
- Select an active doctor from the dropdown
- Click "Confirm Assignment"
- Verify booking moves to master calendar as CONFIRMED
- Verify patient receives confirmation email
- Verify doctor receives notification email
```

---

### Changes to Make in schema.prisma (Documentation Only — Track 1)

Add a note to the top of `tawasul_mvp_v2.md` under a new section "Architecture Updates":

```
## Architecture Updates — Booking System

Date: [current date]
Reason: The original design assumed doctors control their own availability. The correct business model requires admin-controlled global availability with doctor assignment happening after patient booking.

### Schema Changes Required
1. Add AdminSchedule model (global schedule, admin-controlled)
2. Add GlobalBlockedDate model (admin-controlled date blocks)
3. Make Booking.doctorId nullable (String?)
4. Add IN_REVIEW to BookingStatus enum

### Flow Change
Old: Patient selects doctor → books slot from doctor's availability → CONFIRMED immediately after payment
New: Patient selects slot from global schedule → PENDING after payment → Admin assigns doctor → CONFIRMED

### Affected Phases
- Phase 3 (Booking): New availability utility, updated create endpoint
- Phase 6 (Admin): New schedule management, blocked dates, booking assignment workflow
```

---

## Track 2 — Fix the Code

**Do not start this track until Track 1 is complete and all phase files are updated.**

### Step 1 — Update prisma/schema.prisma

Make the following changes to the schema:

**Add to BookingStatus enum:**
```prisma
enum BookingStatus {
  PENDING
  IN_REVIEW    // ← ADD THIS (reserved for future use)
  CONFIRMED
  CANCELLED
}
```

**Update Booking model — make doctorId nullable:**
```prisma
model Booking {
  // ...
  doctorId  String?    // ← Change from String to String?
  // ...
  doctor    Doctor?    @relation(...)   // ← Change from Doctor to Doctor?
}
```

**Add AdminSchedule model:**
```prisma
model AdminSchedule {
  id              String   @id @default(cuid())
  dayOfWeek       Int      // 0 = Sunday, 6 = Saturday
  startTime       String   // "09:00"
  endTime         String   // "17:00"
  sessionDuration Int      // minutes: 30, 45, or 60
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("admin_schedules")
}
```

**Add GlobalBlockedDate model:**
```prisma
model GlobalBlockedDate {
  id        String   @id @default(cuid())
  date      DateTime @db.Date
  reason    String?
  createdAt DateTime @default(now())

  @@map("global_blocked_dates")
}
```

After editing the schema, run:
```
npx prisma db push
```

Verify: all 4 changes applied without errors. No existing data should be lost.

---

### Step 2 — Create server/utils/admin-availability.ts

Create this file from scratch. Do not modify `server/utils/availability.ts`.

The file must export two functions:

**`getAdminAvailableDates(month: number, year: number): Promise<string[]>`**

Implement exactly as described in Track 1 Phase 3 flow.md changes above.

**`getAdminAvailableSlots(date: string): Promise<AdminSlot[]>`**

Where AdminSlot is:
```typescript
interface AdminSlot {
  startTime: string   // "10:00"
  endTime: string     // "11:00"
  sessionDuration: number
}
```

Implement exactly as described in Track 1 Phase 3 flow.md changes above.

Important rules:
- Never import from `availability.ts`
- Never reference `doctorId` in these functions
- Always use `prisma.adminSchedule` not `prisma.availability`
- Always use `prisma.globalBlockedDate` not `prisma.blockedSlot`

---

### Step 3 — Update Booking API Endpoints

**`modules/booking/server/api/booking/available-dates.get.ts`**

Replace the call to `getAvailableDates` with `getAdminAvailableDates` from `server/utils/admin-availability.ts`.

No other changes to this file.

**`modules/booking/server/api/booking/available-slots.get.ts`**

Replace the call to `getAvailableSlots` with `getAdminAvailableSlots` from `server/utils/admin-availability.ts`.

Update the response shape — slots no longer have `doctorId`:
```typescript
// Old slot shape
{ doctorId: string, doctorName: string, startTime: string, endTime: string }

// New slot shape
{ startTime: string, endTime: string, sessionDuration: number }
```

**`modules/booking/server/api/booking/create.post.ts`**

Update the Zod schema — remove `doctorId`:
```typescript
// Old
const schema = z.object({
  date: z.string(),
  startTime: z.string(),
  doctorId: z.string()    // ← REMOVE
})

// New
const schema = z.object({
  date: z.string(),
  startTime: z.string()
})
```

Update availability validation — use `getAdminAvailableSlots` instead of `getAvailableSlots`.

Update booking creation — set `doctorId: null`:
```typescript
// Old
await prisma.booking.create({
  data: { userId, doctorId, date, startTime, endTime, status: 'PENDING' }
})

// New
await prisma.booking.create({
  data: { userId, doctorId: null, date, startTime, endTime, status: 'PENDING' }
})
```

Update the payment webhook handler (`modules/payment/server/api/payment/webhook.post.ts`):

After payment success, instead of sending `bookingConfirmationTemplate`, send `bookingReceivedTemplate`:
```typescript
// Old
await sendEmail({ bookingConfirmationTemplate(patientName, doctorName, date, time, service) })

// New
await sendEmail({ bookingReceivedTemplate(patientName, date, time) })
```

Add `bookingReceivedTemplate` to `server/utils/email.ts` if not already there.

---

### Step 4 — Update Frontend (useBooking composable)

**`modules/booking/composables/useBooking.ts`**

Remove `doctorId` from all state, slot objects, and method parameters.

Update the `selectSlot` method — it now takes an `AdminSlot` not a `DoctorSlot`.

Update the `createAndPay` method — do not send `doctorId` in the request body.

Update the booking summary state — remove doctor name from the summary object.

---

### Step 5 — Update Frontend (booking page)

**`pages/book.vue` (or wherever the booking page lives)**

In Step 1 (Choose Time):
- Remove doctor name from slot display chips
- Each slot shows only time: "10:00 AM – 11:00 AM"

In Step 2 (Review Summary):
- Remove "Doctor" row from the summary card
- Summary shows: Date, Time, Duration, Price

In Step 3 (Pay):
- No changes needed

---

### Step 6 — Add Admin Endpoints

Create the following new files:

**`modules/admin/server/api/admin/schedule/index.get.ts`**
- `requirePermission(event, 'SETTINGS', 'UPDATE')`
- Return all AdminSchedule records sorted by dayOfWeek

**`modules/admin/server/api/admin/schedule/index.post.ts`**
- `requirePermission(event, 'SETTINGS', 'UPDATE')`
- Validate: dayOfWeek (0-6), startTime < endTime, sessionDuration in [30, 45, 60]
- Create and return AdminSchedule record

**`modules/admin/server/api/admin/schedule/[id].patch.ts`**
- `requirePermission(event, 'SETTINGS', 'UPDATE')`
- Update and return AdminSchedule record

**`modules/admin/server/api/admin/schedule/[id].delete.ts`**
- `requirePermission(event, 'SETTINGS', 'UPDATE')`
- Delete AdminSchedule record, return 200

**`modules/admin/server/api/admin/blocked-dates/index.get.ts`**
- `requirePermission(event, 'SETTINGS', 'UPDATE')`
- Return all future GlobalBlockedDate records sorted by date ascending

**`modules/admin/server/api/admin/blocked-dates/index.post.ts`**
- `requirePermission(event, 'SETTINGS', 'UPDATE')`
- Validate date is in the future
- Create and return GlobalBlockedDate record

**`modules/admin/server/api/admin/blocked-dates/[id].delete.ts`**
- `requirePermission(event, 'SETTINGS', 'UPDATE')`
- Delete GlobalBlockedDate record, return 200

**`modules/admin/server/api/admin/bookings/pending.get.ts`**
- `requirePermission(event, 'APPOINTMENTS', 'READ')`
- Return all Bookings where status is PENDING
- Include: patient name, patient email, patient phone, date, startTime, endTime, createdAt
- Sort by date ascending (oldest first)

**`modules/admin/server/api/admin/bookings/[id]/assign.patch.ts`**
- `requirePermission(event, 'APPOINTMENTS', 'UPDATE')`
- Body: `{ doctorId: string }`
- Validate booking is PENDING
- Validate doctor exists and isActive
- Check no conflicting confirmed booking for this doctor at this date/time
- Update booking: `{ doctorId, status: 'CONFIRMED' }`
- Send bookingConfirmationTemplate to patient
- Send bookingConfirmationTemplate to doctor
- Return updated booking

---

### Step 7 — Update Admin Frontend

**`pages/admin/settings.vue`**

Add two new sections to the Settings page:

**Schedule section:**
- Title: "Session Schedule"
- A row for each day of week (Sunday–Saturday)
- Each row: day name, toggle (enable/disable), start time input, end time input, session duration selector
- "Save Schedule" button
- Preview text below: "X available slots per week based on this schedule"
- On load: fetch GET /api/admin/schedule and pre-fill rows
- On save: for each enabled day, call POST or PATCH; for disabled days, call DELETE if record exists

**Blocked Dates section:**
- Title: "Blocked Dates"
- List of upcoming blocked dates with: date, reason (if any), remove button
- "Block a Date" button → opens modal with date picker and optional reason input
- Remove button calls DELETE /api/admin/blocked-dates/:id

**`pages/admin/appointments.vue`**

Add a "Pending Bookings" tab alongside the master calendar tab.

Pending Bookings tab:
- Table columns: Patient Name, Date, Time, Requested On, Actions
- Actions: "Assign Doctor" button
- "Assign Doctor" opens a HeroUI Modal:
  - Dropdown of active doctors
  - Below the dropdown, show the selected doctor's existing bookings for that date (fetch from GET /api/admin/doctors/:id)
  - "Confirm Assignment" button calls PATCH /api/admin/bookings/:id/assign
  - On success: show success toast, remove row from pending table

---

### Step 8 — Run Tests

After all code changes:

```bash
# TypeScript check
npx tsc --noEmit

# API tests
npx vitest run tests/api

# E2E tests
npx playwright test
```

Fix any failures before considering this fix complete.

---

### Step 9 — Manual Verification

Complete this checklist before closing out the fix:

**Admin side:**
- [ ] Admin can add schedule for Monday 09:00–17:00, 60 min sessions
- [ ] Admin can block a specific date
- [ ] Admin can see pending bookings in the Appointments → Pending tab
- [ ] Admin can assign a doctor to a pending booking
- [ ] After assignment, patient receives confirmation email with doctor name
- [ ] After assignment, doctor receives notification email

**Patient side:**
- [ ] Visit /book — calendar shows available dates based on AdminSchedule
- [ ] Blocked dates are not available on the calendar
- [ ] Selecting a date shows time slots (no doctor name in slots)
- [ ] Booking summary shows date, time, duration, price — no doctor
- [ ] After payment, patient receives "booking received" email (not confirmation)
- [ ] Booking appears in patient dashboard with status PENDING
- [ ] After admin assigns doctor, booking status changes to CONFIRMED in patient dashboard

**Data integrity:**
- [ ] Existing CONFIRMED bookings with doctorId are not affected by the schema change
- [ ] `npx prisma db push` runs without errors
- [ ] No existing test data is lost

---

## Summary of All Changes

| File | Type | Change |
|---|---|---|
| `prisma/schema.prisma` | Schema | Add AdminSchedule, GlobalBlockedDate, make Booking.doctorId nullable, add IN_REVIEW to enum |
| `server/utils/admin-availability.ts` | New file | Admin-controlled availability functions |
| `server/utils/email.ts` | Update | Add bookingReceivedTemplate |
| `modules/booking/server/api/booking/available-dates.get.ts` | Update | Use getAdminAvailableDates |
| `modules/booking/server/api/booking/available-slots.get.ts` | Update | Use getAdminAvailableSlots, remove doctorId from response |
| `modules/booking/server/api/booking/create.post.ts` | Update | Remove doctorId requirement, set doctorId: null |
| `modules/payment/server/api/payment/webhook.post.ts` | Update | Send bookingReceivedTemplate instead of bookingConfirmationTemplate |
| `modules/booking/composables/useBooking.ts` | Update | Remove doctorId from state and methods |
| `pages/book.vue` | Update | Remove doctor name from slot chips and summary |
| `modules/admin/server/api/admin/schedule/*` | New files (4) | AdminSchedule CRUD |
| `modules/admin/server/api/admin/blocked-dates/*` | New files (3) | GlobalBlockedDate CRUD |
| `modules/admin/server/api/admin/bookings/pending.get.ts` | New file | List pending bookings |
| `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts` | New file | Assign doctor and confirm booking |
| `pages/admin/settings.vue` | Update | Add Schedule and Blocked Dates sections |
| `pages/admin/appointments.vue` | Update | Add Pending Bookings tab with assignment UI |
| `phases/phase-3-booking/*.md` | Docs | Update all 4 files |
| `phases/phase-6-admin-dashboard/*.md` | Docs | Update all 4 files |
| `tawasul_mvp_v2.md` | Docs | Add Architecture Updates section |
