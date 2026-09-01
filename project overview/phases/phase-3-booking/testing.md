# Phase 3 — Booking & Payment Module
## testing.md

---

## Testing Strategy

Phase 3 introduces complex logic for availability, booking, and payment. Testing includes:

- **Unit Tests (Vitest)** — YES. Test `getAvailableSlots` and `getAvailableDates` in `server/utils/availability.ts`.
- **API Tests (Vitest + supertest)** — YES. Test all 7 API endpoints.
- **End-to-End Tests (Playwright)** — YES. Test complete booking flow (requires mocking payment gateway).

---

## Unit Tests

---

### Test File: `tests/utils/availability.test.ts`

Mock Prisma using `vitest-mock-extended`:
```typescript
import { mockDeep } from 'vitest-mock-extended'
import { PrismaClient } from '@prisma/client'

vi.mock('../../server/utils/prisma', () => ({ prisma: mockDeep<PrismaClient>() }))
```

**`getAvailableSlots`**

| Test Case | Setup | Expected |
|---|---|---|
| Returns slots for a date with availability | Mock `prisma.availability.findMany` to return 1 active doctor with availability for day 0 (Sunday). Mock `prisma.booking.findMany` and `prisma.blockedSlot.findMany` to return empty arrays. | Returns array of slots with correct `startTime` and `endTime` based on `sessionDuration`. |
| Excludes booked slots | Mock `prisma.booking.findMany` to return a confirmed booking for the doctor on the date at 10:00. | Returns slots excluding the 10:00 slot. |
| Excludes blocked slots | Mock `prisma.blockedSlot.findMany` to return a blocked slot for the doctor on the date at 11:00. | Returns slots excluding the 11:00 slot. |
| Excludes past slots for today | Call with today's date and mock a slot at 08:00 (past). | Returns slots excluding the 08:00 slot. |
| Returns empty array for date with no availability | Mock `prisma.availability.findMany` to return empty array. | Returns `[]`. |
| Returns empty array for past date | Call with a date in the past. | Returns `[]`. |
| Sorts slots by startTime | Mock multiple slots at different times. | Slots are sorted by `startTime` ascending. |

**`getAvailableDates`**

| Test Case | Setup | Expected |
|---|---|---|
| Returns dates with available slots | Mock `prisma.availability.findMany` to return availability for day 0 and day 1. Mock no bookings or blocked slots. | Returns array of dates in the month that match day 0 or 1. |
| Excludes dates with all slots booked | Mock `prisma.booking.findMany` to return confirmed bookings for all slots on day 0. | Returns dates excluding those with all slots booked. |
| Returns empty array for month with no availability | Mock `prisma.availability.findMany` to return empty array. | Returns `[]`. |

---

## API Tests

---

### Test File: `tests/api/booking/available-dates.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch available dates for current month | Query: `?month=3&year=2024` | 200 | `{ dates: [...] }` (array of available dates) |
| Fetch with invalid month | Query: `?month=13&year=2024` | 400 | `{ message: "Invalid month or year" }` |
| Fetch with invalid year | Query: `?month=3&year=20` | 400 | `{ message: "Invalid month or year" }` |
| No available dates | DB has no availability | 200 | `{ dates: [] }` |

---

### Test File: `tests/api/booking/available-slots.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch slots for date with availability | Query: `?date=2024-03-04` | 200 | `{ slots: [...] }` (array of available slots) |
| Fetch with invalid date format | Query: `?date=04-03-2024` | 400 | `{ message: "Invalid date format" }` |
| No available slots | DB has no slots for date | 200 | `{ slots: [] }` |

---

### Test File: `tests/api/booking/create.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Create booking with valid slot | Auth: PATIENT, Body: `{ date: "2024-03-04", startTime: "10:00", doctorId: "doc-1" }` | 201 | `{ bookingId, amount, currency }` |
| Create booking with unavailable slot | Auth: PATIENT, Body: `{ date: "2024-03-04", startTime: "10:00", doctorId: "doc-1" }` (slot taken) | 400 | `{ message: "This slot is no longer available" }` |
| Create booking with invalid date | Auth: PATIENT, Body: `{ date: "invalid", startTime: "10:00", doctorId: "doc-1" }` | 400 | `{ message: "Invalid date format" }` |
| Create booking unauthenticated | No auth, Body: `{ date: "2024-03-04", startTime: "10:00", doctorId: "doc-1" }` | 401 | `{ message: "Unauthorized" }` |
| Create booking as DOCTOR | Auth: DOCTOR, Body: `{ date: "2024-03-04", startTime: "10:00", doctorId: "doc-1" }` | 403 | `{ message: "Forbidden" }` |

---

### Test File: `tests/api/booking/[id].get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch own booking | Auth: PATIENT (owner), Path: `/api/booking/book-1` | 200 | `{ id, patientName, doctorName, date, startTime, endTime, service, status, paymentStatus, amount, currency }` |
| Fetch another user's booking | Auth: PATIENT (not owner), Path: `/api/booking/book-1` | 403 | `{ message: "Forbidden" }` |
| Fetch as STAFF with permission | Auth: STAFF (APPOINTMENTS READ), Path: `/api/booking/book-1` | 200 | Booking details |
| Fetch unauthenticated | No auth, Path: `/api/booking/book-1` | 401 | `{ message: "Unauthorized" }` |
| Booking not found | Auth: PATIENT, Path: `/api/booking/nonexistent` | 404 | `{ message: "Booking not found" }` |

---

### Test File: `tests/api/booking/[id]/cancel.patch.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Cancel own booking (24hr+ before) | Auth: PATIENT (owner), Path: `/api/booking/book-1/cancel` | 200 | `{ message: "Booking cancelled successfully" }` |
| Cancel own booking (<24hr) | Auth: PATIENT (owner), Path: `/api/booking/book-1/cancel` (session in <24hr) | 400 | `{ message: "Cannot cancel booking less than 24 hours before session" }` |
| Cancel as STAFF | Auth: STAFF (APPOINTMENTS DELETE), Path: `/api/booking/book-1/cancel` | 200 | `{ message: "Booking cancelled successfully" }` |
| Cancel another user's booking | Auth: PATIENT (not owner), Path: `/api/booking/book-1/cancel` | 403 | `{ message: "Forbidden" }` |

---

### Test File: `tests/api/payment/initiate.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Initiate Paymob payment | Auth: PATIENT, Body: `{ bookingId: "book-1" }`, `PAYMENT_GATEWAY=paymob` | 200 | `{ paymentUrl: "https://paymob..." }` |
| Initiate Stripe payment | Auth: PATIENT, Body: `{ bookingId: "book-1" }`, `PAYMENT_GATEWAY=stripe` | 200 | `{ clientSecret: "pi_..._secret_..." }` |
| Initiate with invalid bookingId | Auth: PATIENT, Body: `{ bookingId: "nonexistent" }` | 400 | `{ message: "Booking not found" }` |
| Initiate another user's booking | Auth: PATIENT (not owner), Body: `{ bookingId: "book-1" }` | 403 | `{ message: "Forbidden" }` |
| Initiate with confirmed booking | Auth: PATIENT, Body: `{ bookingId: "book-1" }` (status CONFIRMED) | 400 | `{ message: "Booking already confirmed" }` |
| Initiate with no gateway configured | `PAYMENT_GATEWAY` not set | 500 | `{ message: "Payment gateway not configured" }` |

---

### Test File: `tests/api/payment/webhook.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Behavior |
|---|---|---|---|
| Paymob success webhook | Headers: `{ hmac: VALID_SIGNATURE }`, Body: `{ ...paymob payload..., bookingId: "book-1" }` | 200 | `Payment` status = SUCCESS, `Booking` status = CONFIRMED, emails sent |
| Paymob failed webhook | Headers: `{ hmac: VALID_SIGNATURE }`, Body: `{ ...paymob payload..., status: "FAILED", bookingId: "book-1" }` | 200 | `Payment` status = FAILED, `Booking` status = PENDING |
| Paymob invalid signature | Headers: `{ hmac: INVALID_SIGNATURE }` | 400 | `{ message: "Invalid signature" }` |
| Stripe success webhook | Headers: `{ stripe-signature: VALID_SIGNATURE }`, Body: `{ ...stripe payload..., bookingId: "book-1" }` | 200 | `Payment` status = SUCCESS, `Booking` status = CONFIRMED, emails sent |
| Stripe failed webhook | Headers: `{ stripe-signature: VALID_SIGNATURE }`, Body: `{ ...stripe payload..., status: "failed", bookingId: "book-1" }` | 200 | `Payment` status = FAILED, `Booking` status = PENDING |
| Stripe invalid signature | Headers: `{ stripe-signature: INVALID_SIGNATURE }` | 400 | `{ message: "Invalid signature" }` |

---

## End-to-End Tests (Playwright)

**Note:** Payment gateway testing requires mocking or using test mode. For Paymob/Stripe, use their test API keys and cards.

---

### Test File: `tests/e2e/booking.spec.ts`

#### Test: Booking Flow (Mocked Payment)
- **Starting State:** Logged in as patient, on `/book`.
- **Steps:**
  1. Wait for calendar to load available dates.
  2. Click an available date.
  3. Click an available slot.
  4. Click "Confirm and Pay".
  5. Mock the payment gateway response (or use Stripe test mode).
  6. Complete payment.
- **Assertions:**
  - Redirected to `/booking/success?bookingId=...`.
  - Success message and booking summary are visible.
  - Booking status in DB is `CONFIRMED`.
  - Payment status in DB is `SUCCESS`.

#### Test: Booking Flow with Slot Taken
- **Starting State:** Logged in as patient, on `/book`.
- **Steps:**
  1. Select a date and slot.
  2. Have another user book the same slot (via API).
  3. Click "Confirm and Pay".
- **Assertions:**
  - Error message "This slot is no longer available" is visible.

#### Test: Available Dates Load on Calendar
- **Starting State:** Logged in as patient, on `/book`.
- **Steps:**
  1. Wait for calendar to load.
- **Assertions:**
  - Available dates are highlighted in magenta.
  - Unavailable dates are grayed out.

#### Test: Slot Selection Works
- **Starting State:** Logged in as patient, on `/book`.
- **Steps:**
  1. Click an available date.
  2. Click an available slot.
- **Assertions:**
  - Slot is highlighted.
  - "Continue" button is enabled.

#### Test: Review Step Shows Correct Data
- **Starting State:** Logged in as patient, on `/book` with a slot selected.
- **Steps:**
  1. Click "Continue" to advance to Step 2.
- **Assertions:**
  - Date, time, doctor name, service, and price are visible.
  - "Back" and "Confirm and Pay" buttons are visible.

#### Test: Confirmation Page Shows Booking Details
- **Starting State:** Booking exists with `bookingId=book-1`, on `/booking/success?bookingId=book-1`.
- **Steps:**
  1. Navigate to `/booking/success?bookingId=book-1`.
- **Assertions:**
  - Success message is visible.
  - Booking details (date, time, doctor) are visible.

#### Test: Failed Payment Page Shows Retry Option
- **Starting State:** Booking exists with `bookingId=book-1`, on `/booking/failed?bookingId=book-1`.
- **Steps:**
  1. Navigate to `/booking/failed?bookingId=book-1`.
- **Assertions:**
  - "Payment was not completed" message is visible.
  - "Try Again" button is visible.
  - "Choose a Different Time" button is visible.

#### Test: Unauthenticated User Redirected from /book
- **Starting State:** Logged out, on `/book`.
- **Steps:**
  1. Navigate to `/book`.
- **Assertions:**
  - Redirected to `/login`.

---

## Manual Verification Checklist

Complete every item below before marking Phase 3 as done:

1. **Availability:**
   - [ ] Available dates load on `/book` calendar.
   - [ ] Non-available dates are grayed out and non-clickable.
   - [ ] Clicking an available date shows correct time slots.
   - [ ] Already-booked slots do not appear.
   - [ ] Blocked slots do not appear.
   - [ ] Past slots on today's date do not appear.

2. **Booking Flow:**
   - [ ] Selecting a date and slot advances to review step.
   - [ ] Review step shows correct booking summary.
   - [ ] "Confirm and Pay" creates booking and initiates payment.
   - [ ] Payment gateway (Paymob/Stripe) loads correctly.

3. **Payment:**
   - [ ] Test payment with test card completes successfully.
   - [ ] After payment, booking status is `CONFIRMED` in DB.
   - [ ] Patient receives confirmation email.
   - [ ] Doctor receives notification email.

4. **Confirmation/Failure Pages:**
   - [ ] Confirmation page shows correct booking details.
   - [ ] Failed payment page allows retry.
   - [ ] Failed payment page allows choosing a different time.

5. **Webhooks:**
   - [ ] Webhook signature validation works.
   - [ ] Webhook updates booking and payment status.
   - [ ] Webhook sends emails to patient and doctor.
   - [ ] Webhook returns 200 even if internal processing fails.

6. **Edge Cases:**
   - [ ] Booking with an unavailable slot returns 400.
   - [ ] Double-booking is prevented.
   - [ ] 24hr cancellation rule is enforced (test in Phase 4).
   - [ ] Unauthenticated users are redirected to `/login` from `/book`.

7. **UI/UX:**
   - [ ] Calendar is responsive on mobile (375px viewport).
   - [ ] Slot selection is usable on mobile.
   - [ ] Loading states are shown during API calls.
   - [ ] Error messages are user-friendly.

---

## Completion Criteria

Mark each item PASS or FAIL with a note before handing off to Phase 4:

```
[ ] All unit tests pass (0 failures) — run `npm run test:unit`
[ ] All API tests pass (0 failures) — run `npm run test:api`
[ ] All Playwright tests pass (0 failures) — run `npm run test:e2e`
[ ] Manual verification checklist completed
[ ] No TypeScript errors — `npx tsc --noEmit` shows 0 errors
[ ] No console errors in the browser on `/book`
[ ] Available dates load on calendar and non-available dates are grayed out
[ ] Clicking an available date shows correct time slots
[ ] Already-booked slots do not appear
[ ] Blocked slots do not appear
[ ] Past slots on today's date do not appear
[ ] Booking with an unavailable slot returns 400
[ ] After payment success, booking status is CONFIRMED in the database
[ ] Patient receives confirmation email after successful payment
[ ] Doctor receives notification email after successful payment
[ ] Confirmation page shows correct booking details
[ ] Failed payment page allows retry
[ ] Webhook signature validation rejects tampered requests
[ ] Unauthenticated users are redirected to login from /book
```

**The phase is complete only when all 17 items above are marked PASS.**

If any item is FAIL, fix it before moving to Phase 4. Document what failed and what was done to fix it in a `notes.md` file inside the `phase-3/` folder.
