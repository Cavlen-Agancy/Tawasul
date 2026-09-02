# Phase 3 — Booking & Payment Module

## Goal
Build the complete booking flow. After this phase, a logged-in patient can view available slots on a calendar, select a time, review a summary, pay online, and receive a confirmation email. The slot is blocked immediately after payment.

---

## Stack Used in This Phase
- Nitro API endpoints
- Prisma (Booking, Payment, Availability, BlockedSlot, Settings models)
- FullCalendar (slot display)
- shadcn-vue (booking steps UI)
- Resend (confirmation emails)
- Paymob or Stripe (payment gateway)
- Zod (validation)

---

## Overview

The booking flow:
1. Patient visits `/book`
2. Sees a calendar with all available slots across all active doctors
3. Selects a slot
4. Reviews booking summary
5. Pays online
6. Auto-confirmed after payment webhook
7. Receives confirmation email

The patient does not choose a doctor. The admin assigns doctors to availability slots. When a patient books a slot, the system assigns the doctor who owns that slot.

---

## Step 1 — Availability Logic

Create `server/utils/availability.ts`.

### `getAvailableSlots(date: string): Promise<Slot[]>`

A Slot is: `{ doctorId, doctorName, startTime, endTime, service }`

Logic:
1. Parse the date, get day of week (0–6).
2. Fetch all Availability records matching that dayOfWeek where doctor isActive is true.
3. Batch fetch all confirmed Bookings for that date.
4. Batch fetch all BlockedSlots for that date.
5. For each Availability record, generate time slots by splitting the window into sessionDuration chunks.
6. Remove slots that overlap with any confirmed Booking or BlockedSlot for that doctor.
7. Remove slots in the past if date is today.
8. Return all remaining slots sorted by startTime.

### `getAvailableDates(month: number, year: number): Promise<string[]>`

Logic:
1. Batch fetch all Availability records for active doctors.
2. Batch fetch all Bookings and BlockedSlots for the given month.
3. For each day in the month, check if at least one slot is available.
4. Return array of date strings with available slots (e.g. `["2024-03-04", "2024-03-05"]`).

---

## Step 2 — API Endpoints

All inside `modules/booking/server/api/booking/` and `modules/payment/server/api/payment/`.

---

### GET /api/booking/available-dates

Query: `month` (1–12), `year` (4 digits)

Logic:
1. No auth required — public endpoint.
2. Call `getAvailableDates(month, year)`.
3. Return `{ dates: string[] }`.

---

### GET /api/booking/available-slots

Query: `date` (YYYY-MM-DD)

Logic:
1. No auth required.
2. Validate date format.
3. Call `getAvailableSlots(date)`.
4. Return `{ slots: Slot[] }`.

---

### POST /api/booking/create

Auth: PATIENT only.

Body (Zod):
- `date` — YYYY-MM-DD string
- `startTime` — "HH:MM" string
- `doctorId` — string

Logic:
1. Call `requireAuth(event, ['PATIENT'])`.
2. Re-validate the slot is still available by calling `getAvailableSlots(date)` and checking the doctorId + startTime combination exists. If not → 400 "This slot is no longer available".
3. Fetch doctor's Availability to calculate endTime based on sessionDuration.
4. Fetch session price from Settings.
5. Create Booking with status PENDING.
6. Create linked Payment with status PENDING and the correct amount.
7. Return `{ bookingId, amount, currency }`.

---

### POST /api/payment/initiate

Auth: PATIENT only.

Body (Zod):
- `bookingId` — string

Logic:
1. Call `requireAuth(event, ['PATIENT'])`.
2. Fetch Booking by id, verify it belongs to the logged-in patient and status is PENDING.
3. Call payment gateway to create a payment session:
   - Pass amount from linked Payment record.
   - Pass bookingId as metadata.
   - Success redirect: `APP_URL/booking/success?bookingId=ID`
   - Failure redirect: `APP_URL/booking/failed?bookingId=ID`
4. Return `{ paymentUrl }` for Paymob or `{ clientSecret }` for Stripe.

---

### POST /api/payment/webhook

No auth — verified by signature.

Logic:
1. Verify webhook signature using gateway secret. Return 400 immediately if invalid.
2. Read payment status and bookingId from payload.
3. Always return 200 to the gateway first — then process internally.
4. If payment SUCCESS:
   - Update Payment status to SUCCESS.
   - Update Booking status to CONFIRMED.
   - Send booking confirmation email to patient using `bookingConfirmationTemplate`.
   - Send notification email to doctor using `bookingConfirmationTemplate`.
5. If payment FAILED:
   - Update Payment status to FAILED.
   - Leave Booking as PENDING.

---

### GET /api/booking/:id

Auth: PATIENT (own booking) or STAFF with APPOINTMENTS READ permission.

Logic:
1. Fetch Booking by id.
2. Verify ownership or permission.
3. Return full booking details: patient name, doctor name, date, startTime, endTime, service, status, payment status.

---

### PATCH /api/booking/:id/cancel

Auth: PATIENT (own booking, 24hr rule) or STAFF with APPOINTMENTS DELETE permission.

Logic:
1. Fetch Booking by id.
2. Verify ownership or permission.
3. If PATIENT: check 24hr rule. Return 400 if less than 24 hours before session.
4. If STAFF: no 24hr restriction.
5. Update Booking status to CANCELLED.
6. Update Payment status to REFUNDED.
7. Send cancellation email to patient using `bookingCancellationTemplate`.
8. Return 200.

---

## Step 3 — Frontend Pages

All inside `modules/booking/pages/`.

---

### `/book` — Booking Page

Apply `auth` middleware — redirect to login if not authenticated.

Multi-step flow with a step indicator at the top (Step 1: Choose Time, Step 2: Review, Step 3: Pay).

**Step 1 — Choose Time**

FullCalendar instance:
- `initialView`: `dayGridMonth`
- On load: call `GET /api/booking/available-dates` for current month.
- Highlight available dates with `#E91E8C`. Gray out unavailable dates. Make unavailable dates non-clickable.
- On month change (`datesSet` callback): fetch available dates for new month.
- On date click (available date only): call `GET /api/booking/available-slots?date=DATE`.
- Display returned slots as shadcn-vue Button chips below the calendar.
- On slot select: highlight selected slot, show Continue button.

**Step 2 — Review**

shadcn-vue Card showing:
- Date (formatted: "Monday, 4 March 2024")
- Time (formatted: "10:00 AM – 11:00 AM")
- Doctor name
- Service
- Price (from Settings)

Back button + Confirm and Pay button.

**Step 3 — Payment**

On Confirm and Pay:
1. Call POST /api/booking/create with date, startTime, doctorId.
2. Call POST /api/payment/initiate with returned bookingId.
3. Redirect to payment gateway URL.
4. Show loading state: "Preparing your payment..."
5. On API error: show error message, allow retry.

---

### `/booking/success` — Confirmation Page

On load:
1. Read `bookingId` from query.
2. Call GET /api/booking/:id.
3. Show success state: checkmark icon (magenta), "Booking Confirmed" headline, booking summary.
4. "Go to My Appointments" button → `/dashboard/appointments`.

---

### `/booking/failed` — Payment Failed Page

Show:
- "Payment was not completed" message
- Booking summary
- "Try Again" button — re-initiates payment for same booking
- "Choose a Different Time" button → `/book`

---

## Step 4 — Booking Composable

Create `modules/booking/composables/useBooking.ts`:

State:
- `step` — 1, 2, or 3
- `selectedDate` — string
- `selectedSlot` — Slot object
- `availableDates` — string[]
- `availableSlots` — Slot[]
- `bookingId` — string
- `isLoading` — boolean
- `error` — string

Methods:
- `fetchAvailableDates(month, year)`
- `fetchAvailableSlots(date)`
- `selectSlot(slot)` — sets selectedSlot, advances to step 2
- `createAndPay()` — calls create then initiate, redirects to gateway

---

## Checks — Phase 3 Complete

- [ ] Available dates load on the calendar and non-available dates are grayed out
- [ ] Clicking an available date shows correct time slots
- [ ] Already-booked slots do not appear
- [ ] Blocked slots do not appear
- [ ] Past slots on today's date do not appear
- [ ] Booking with an unavailable slot returns 400
- [ ] After payment success, booking status is CONFIRMED in the database
- [ ] Patient receives confirmation email after successful payment
- [ ] Doctor receives notification email after successful payment
- [ ] Confirmation page shows correct booking details
- [ ] Failed payment page allows retry
- [ ] Patient can cancel a booking more than 24 hours before
- [ ] Patient cannot cancel less than 24 hours before
- [ ] Webhook signature validation rejects tampered requests
- [ ] Unauthenticated users are redirected to login from /book

---

## Notes for the AI

- `getAvailableSlots` is the single source of truth. Never calculate slots inline in a route handler.
- Always return 200 from the webhook endpoint even if internal processing fails — log errors separately.
- The slot validation in POST /api/booking/create must re-run on the server — the frontend calendar is display only.
- For Paymob: use the intention API with a redirect flow.
- For Stripe: use Stripe Checkout Sessions.
- Refunds for MVP are manual — just mark as REFUNDED in the DB and note this to the admin.
