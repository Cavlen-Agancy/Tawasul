# Phase 3 — Booking & Payment Module
## flow.md

---

## Feature 1 — Admin Availability Logic

**Action:** Create `server/utils/admin-availability.ts` with admin-controlled slot calculation functions. Do **not** modify `server/utils/availability.ts`.

This utility is the **single source of truth** for what dates and slots are available to patients. It reads from the `AdminSchedule` model, **not** from the doctor `Availability` model. AdminSlots do NOT carry a `doctorId` — the doctor is assigned later by the admin (Phase 6).

---

### `getAdminAvailableDates(month: number, year: number): Promise<string[]>`

**Purpose:** Calculate all dates in a month that have at least one available slot based on the admin-controlled schedule.

**Input:**
- `month`: Number (1–12).
- `year`: Number (e.g., 2024).

**Output:**
- Array of date strings in `YYYY-MM-DD` format (e.g., `["2024-03-04", "2024-03-05"]`).

**Server Logic:**
1. Fetch all active `AdminSchedule` records: `prisma.adminSchedule.findMany({ where: { isActive: true } })`.
2. If no records exist, return `[]`.
3. Fetch all `GlobalBlockedDate` records for the given month.
4. Fetch all **confirmed** `Booking` records for the given month (to calculate which slots are fully booked on a given day).
5. For each day in the month:
   a. Get the `dayOfWeek` (0–6) for that date.
   b. Find all `AdminSchedule` records matching that `dayOfWeek`.
   c. If none found, skip this date (not available).
   d. Check if the date is in `GlobalBlockedDate` — if yes, skip.
   e. Generate all possible time slots by splitting each schedule window into `sessionDuration` chunks.
   f. Count how many slots are already taken by CONFIRMED bookings on this date.
   g. If at least one slot remains, add this date to the result array.
6. Return the array of date strings that have at least one available slot.

**Edge Cases:**
- No `AdminSchedule` records exist: Return `[]`.
- All dates in the month are blocked or fully booked: Return `[]`.

---

### `getAdminAvailableSlots(date: string): Promise<AdminSlot[]>`

**Purpose:** Calculate all available time slots for a given date based on the admin-controlled schedule.

An `AdminSlot` is:
```typescript
{
  startTime: string;      // "10:00"
  endTime: string;        // "11:00"
  sessionDuration: number;
}
```

**Note:** AdminSlots do NOT have a `doctorId`. The doctor is assigned later by the admin.

**Input:**
- `date`: String in `YYYY-MM-DD` format (e.g., `"2024-03-04"`).

**Server Logic:**
1. Parse the date, get `dayOfWeek` (0–6).
2. If the date is in the past, return `[]`.
3. Fetch all active `AdminSchedule` records matching `dayOfWeek`.
4. If none found, return `[]`.
5. Check if the date is in `GlobalBlockedDate` — if yes, return `[]`.
6. Fetch all CONFIRMED `Booking` records for this date (to block already-taken slots).
7. For each `AdminSchedule` record, generate time slots by splitting the window into `sessionDuration` chunks.
8. Remove slots that overlap with any CONFIRMED booking on this date.
9. If the date is today, remove slots where `startTime` is in the past.
10. Return the remaining slots sorted by `startTime` ascending.

**Edge Cases:**
- No `AdminSchedule` records for the `dayOfWeek`: Return `[]`.
- Date is in `GlobalBlockedDate`: Return `[]`.
- All slots are booked: Return `[]`.
- Date is in the past: Return `[]`.

---

## Feature 2 — API Endpoints

---

### GET /api/booking/available-dates

**User Action:** User navigates to `/book` or changes month in the calendar.

**Frontend Behavior:**
- On page load: Call this endpoint for the current month.
- On month change: Call this endpoint for the new month.
- Highlight available dates on the calendar with brand primary color (`#E91E8C`).
- Gray out unavailable dates and make them non-clickable.

**API Call:**
- **Method:** GET
- **Path:** `/api/booking/available-dates`
- **Query Params:**
  ```typescript
  {
    month: number (1–12),
    year: number (e.g., 2024)
  }
  ```
- **Auth:** None (public endpoint).
- **Response (Success):**
  ```typescript
  {
    dates: string[] // e.g., ["2024-03-04", "2024-03-05"]
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Validate `month` (1–12) and `year` (4 digits).
2. Call `getAdminAvailableDates(month, year)`.
3. Return `{ dates }`.

**Edge Cases:**
- Invalid month/year: Return 400 with `{ message: "Invalid month or year" }`.
- No available dates: Return `{ dates: [] }`.

---

### GET /api/booking/available-slots

**User Action:** User clicks an available date on the calendar.

**Frontend Behavior:**
- Call this endpoint with the selected date.
- Display returned slots as shadcn-vue Button chips below the calendar.
- On slot select: Highlight selected slot, show "Continue" button.

**API Call:**
- **Method:** GET
- **Path:** `/api/booking/available-slots`
- **Query Params:**
  ```typescript
  {
    date: string // YYYY-MM-DD
  }
  ```
- **Auth:** None (public endpoint).
- **Response (Success):**
  ```typescript
  {
    slots: AdminSlot[] // Array of { startTime, endTime, sessionDuration }
  }
  ```
  - **Status:** 200

**Server Logic:**
1. Validate `date` format (YYYY-MM-DD).
2. Call `getAdminAvailableSlots(date)`.
3. Return `{ slots }`.

**Edge Cases:**
- Invalid date format: Return 400 with `{ message: "Invalid date format" }`.
- No available slots: Return `{ slots: [] }`.

---

### POST /api/booking/create

**User Action:** User clicks "Confirm and Pay" on the booking summary step.

**Frontend Behavior:**
- Call this endpoint with selected date, startTime.
- On success: Proceed to payment initiation.
- On error: Show error message, allow retry.

**API Call:**
- **Method:** POST
- **Path:** `/api/booking/create`
- **Auth:** PATIENT only (via `requireAuth(event, ['PATIENT'])`).
- **Body:**
  ```typescript
  {
    date: string,      // YYYY-MM-DD
    startTime: string  // "10:00"
  }
  ```
  - **Note:** No `doctorId` is required. The booking is created with `doctorId: null` and remains PENDING until an admin assigns a doctor (Phase 6).
- **Response (Success):**
  ```typescript
  {
    bookingId: string,
    amount: number,    // e.g., 500.00
    currency: string   // e.g., "EGP"
  }
  ```
  - **Status:** 201
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400 or 401

**Server Logic:**
1. Call `requireAuth(event, ['PATIENT'])`.
2. Re-validate the slot is still available by calling `getAdminAvailableSlots(date)` and checking if the `startTime` exists in the returned slots. If not → return 400 with `{ message: "This slot is no longer available" }`.
3. Calculate `endTime` based on the matching `AdminSchedule`'s `sessionDuration`.
4. Fetch `sessionPricePerHour` and `currency` from `Settings` singleton.
   - Calculate `amount` = `(sessionDuration / 60) * sessionPricePerHour`.
5. Create a new `Booking` with:
   - `userId`: Logged-in patient's ID.
   - `doctorId`: null (doctor assigned later by admin).
   - `date`: From request body.
   - `startTime`: From request body.
   - `endTime`: Calculated from `startTime` + `sessionDuration`.
   - `service`: Default from Settings.
   - `status: PENDING`.
6. Create a linked `Payment` with:
   - `bookingId`: ID of the created booking.
   - `amount`: Calculated amount.
   - `currency`: From Settings.
   - `status: PENDING`.
7. Return `{ bookingId, amount, currency }`.

**Edge Cases:**
- Slot no longer available: Return 400.
- Settings record missing: Use default values (`sessionPricePerHour: 0`, `currency: "EGP"`).

---

### POST /api/payment/initiate

**User Action:** Frontend calls this after `POST /api/booking/create` to start the payment flow.

**Frontend Behavior:**
- Call this endpoint with the `bookingId` from the previous step.
- On success: Redirect to the payment gateway URL (Paymob) or load Stripe Checkout (Stripe).
- On error: Show error message, allow retry.

**API Call:**
- **Method:** POST
- **Path:** `/api/payment/initiate`
- **Auth:** PATIENT only (via `requireAuth(event, ['PATIENT'])`).
- **Body:**
  ```typescript
  {
    bookingId: string
  }
  ```
- **Response (Success - Paymob):**
  ```typescript
  {
    paymentUrl: string // Redirect URL for Paymob iframe/redirect
  }
  ```
  - **Status:** 200
- **Response (Success - Stripe):**
  ```typescript
  {
    clientSecret: string // Stripe Checkout client secret
  }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400 or 401

**Server Logic (Paymob):**
1. Call `requireAuth(event, ['PATIENT'])`.
2. Fetch `Booking` by `bookingId`. Verify:
   - It exists.
   - `userId` matches the logged-in patient.
   - `status` is `PENDING`.
3. Fetch linked `Payment` record to get the `amount` and `currency`.
4. Call Paymob API to create a payment request:
   - Use `PAYMOB_API_KEY` and `PAYMOB_INTEGRATION_ID` from env.
   - Pass `amount` (in cents for Paymob) and `currency`.
   - Pass `bookingId` as metadata.
   - Set success redirect URL: `${APP_URL}/booking/success?bookingId=${bookingId}`.
   - Set failure redirect URL: `${APP_URL}/booking/failed?bookingId=${bookingId}`.
5. Return `{ paymentUrl }` (the Paymob iframe/redirect URL).

**Server Logic (Stripe):**
1. Call `requireAuth(event, ['PATIENT'])`.
2. Fetch `Booking` by `bookingId` (same validation as Paymob).
3. Fetch linked `Payment` record to get the `amount` and `currency`.
4. Create a Stripe Checkout Session:
   - Use `STRIPE_SECRET_KEY` from env.
   - Pass `amount` (in cents), `currency`, and `bookingId` as metadata.
   - Set success URL: `${APP_URL}/booking/success?bookingId=${bookingId}`.
   - Set cancel URL: `${APP_URL}/booking/failed?bookingId=${bookingId}`.
5. Return `{ clientSecret: session.client_secret }`.

**Edge Cases:**
- Booking not found: Return 400.
- Booking belongs to another user: Return 403.
- Booking already confirmed: Return 400.
- Payment gateway not configured: Return 500 with `{ message: "Payment gateway not configured" }`.

---

### POST /api/payment/webhook

**User Action:** Payment gateway sends a webhook after payment completion/failure.

**Frontend Behavior:**
- No direct frontend interaction. Handled server-side.

**API Call:**
- **Method:** POST
- **Path:** `/api/payment/webhook`
- **Auth:** None (verified by signature).
- **Headers:**
  - Paymob: `hmac` signature.
  - Stripe: `stripe-signature`.
- **Body:** Gateway-specific payload.
- **Response (Success):**
  ```typescript
  { message: "Webhook received" }
  ```
  - **Status:** 200

**Server Logic:**
1. **Verify Signature:**
   - For Paymob: Verify the `hmac` header using `PAYMOB_HMAC_SECRET`. If invalid → return 400.
   - For Stripe: Verify the `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`. If invalid → return 400.
2. **Always return 200 first** (to acknowledge the webhook), then process internally.
3. **Parse Payload:**
   - Extract `bookingId` from metadata.
   - Extract payment `status` (e.g., "SUCCESS", "FAILED").
4. **If Payment SUCCESS:**
   a. Update `Payment` status to `SUCCESS`.
   b. Keep `Booking` status as `PENDING` (confirmation happens when the admin assigns a doctor in Phase 6).
   c. Fetch `Booking` and linked `User` (patient) records.
   d. Send booking acknowledgment email to patient using `bookingReceivedTemplate` with:
      - `patientName`, `date`, `time`.
      - Subject: "Your booking request has been received — Tawasul Academy".
      - Content: "We have received your booking request for [date] at [time]. Our team will review and confirm your session shortly. You will receive a confirmation email with your session details once confirmed."
5. **If Payment FAILED:**
   a. Update `Payment` status to `FAILED`.
   b. Leave `Booking` status as `PENDING`.
6. **Log Errors:** If any step fails, log the error but do not return an error response (already returned 200).

**Edge Cases:**
- Invalid signature: Return 400.
- Booking not found: Log error, return 200.
- Email sending fails: Log error, return 200.
- Duplicate webhook: Handle idempotently (check if `Payment` status is already updated).

---

### GET /api/booking/:id

**User Action:** User views booking confirmation page or dashboard (in later phases).

**Frontend Behavior:**
- Called on `/booking/success` page load to fetch booking details.

**API Call:**
- **Method:** GET
- **Path:** `/api/booking/:id`
- **Auth:** PATIENT (own booking) or STAFF with APPOINTMENTS READ permission.
- **Response (Success):**
  ```typescript
  {
    id: string,
    patientName: string,
    doctorId: string | null,
    date: string,       // YYYY-MM-DD
    startTime: string,  // "10:00"
    endTime: string,    // "11:00"
    service: string,
    status: BookingStatus,
    paymentStatus: PaymentStatus,
    amount: number,
    currency: string
  }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 401 or 403

**Server Logic:**
1. Fetch `Booking` by `id`.
2. Verify ownership or permission:
   - If PATIENT: `userId` must match logged-in user.
   - If STAFF: Must have `APPOINTMENTS READ` permission.
3. Fetch linked `User` (patient) and `Doctor` records.
4. Return booking details with patient and doctor names.

**Edge Cases:**
- Booking not found: Return 404.
- Unauthorized access: Return 403.

---

### PATCH /api/booking/:id/cancel

**User Action:** User cancels a booking from their dashboard (in later phases).

**Frontend Behavior:**
- Not used in this phase (dashboard built in Phase 4).

**API Call:**
- **Method:** PATCH
- **Path:** `/api/booking/:id/cancel`
- **Auth:** PATIENT (own booking, 24hr rule) or STAFF with APPOINTMENTS DELETE permission.
- **Response (Success):**
  ```typescript
  { message: "Booking cancelled successfully" }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400 or 403

**Server Logic:**
1. Fetch `Booking` by `id`.
2. Verify ownership or permission:
   - If PATIENT: `userId` must match logged-in user.
   - If STAFF: Must have `APPOINTMENTS DELETE` permission.
3. If PATIENT: Check 24hr rule. If less than 24 hours before `date` + `startTime` → return 400 with `{ message: "Cannot cancel booking less than 24 hours before session" }`.
4. If STAFF: No 24hr restriction.
5. Update `Booking` status to `CANCELLED`.
6. Update linked `Payment` status to `REFUNDED`.
7. Send cancellation email to patient using `bookingCancellationTemplate` with:
   - `patientName`, `doctorName` (optional, empty if no doctor assigned yet), `date`, `time`.
8. Return 200.

**Edge Cases:**
- Booking already cancelled: Return 400.
- Booking already confirmed and session passed: Return 400.
- 24hr rule violation (patient): Return 400.

---

## Feature 3 — Frontend Pages

---

### `/book` — Booking Page

**Layout:** `default`
**Middleware:** `auth` (redirect to `/login` if not authenticated).

**Behavior:**
- **Step Indicator:** Show current step (Step 1: Choose Time, Step 2: Review, Step 3: Pay).
- **Step 1 — Choose Time:**
  - Render FullCalendar with:
    - `initialView: 'dayGridMonth'`.
    - On load: Call `GET /api/booking/available-dates` for current month.
    - Highlight available dates with `#E91E8C`.
    - Gray out unavailable dates (use `display: none` or `opacity-50` + `pointer-events-none`).
    - On month change (`datesSet` callback): Fetch available dates for new month.
    - On date click (available date only): Call `GET /api/booking/available-slots?date=DATE`.
  - Display returned slots as shadcn-vue Button chips below the calendar. Each slot shows only the time (e.g., "10:00 AM – 11:00 AM"); no doctor name is shown.
  - On slot select: Store selected slot, advance to Step 2.
- **Step 2 — Review:**
  - Show shadcn-vue Card with:
    - Date (formatted: "Monday, 4 March 2024").
    - Time (formatted: "10:00 AM – 11:00 AM").
    - Session Duration.
    - Price (from `amount` in `POST /api/booking/create` response).
    - **No doctor name** (doctor is not assigned yet).
  - Buttons:
    - "Back" (return to Step 1).
    - "Confirm and Pay" (call `POST /api/booking/create`, then `POST /api/payment/initiate`).
- **Step 3 — Payment:**
  - On "Confirm and Pay":
    1. Call `POST /api/booking/create` with `date`, `startTime`.
    2. Call `POST /api/payment/initiate` with returned `bookingId`.
    3. For Paymob: Redirect to `paymentUrl`.
    4. For Stripe: Load Stripe Checkout with `clientSecret`.
    5. Show loading state: "Preparing your payment..."
  - On API error: Show error message, allow retry.

**Edge Cases:**
- No available dates in current month: Show message "No available slots this month."
- No available slots for selected date: Show message "No available times for this date."
- Slot selected but no longer available: Show error when calling `POST /api/booking/create`.

---

### `/booking/success` — Confirmation Page

**Layout:** `default`
**Middleware:** None (public page, but requires `bookingId` query param).

**Behavior:**
- On load:
  1. Read `bookingId` from query param.
  2. Call `GET /api/booking/:id`.
  3. If 404 or 403: Show error message + link to `/book`.
  4. If success: Show success state:
     - shadcn-vue Icon (checkmark, magenta).
     - Headline: "Booking Request Received".
     - Booking summary (date, time, session duration, price).
     - Note: "Your booking request has been received. We will review and confirm your session shortly."
     - "Go to My Appointments" button → `/dashboard/appointments` (links to Phase 4).

**Edge Cases:**
- Invalid `bookingId`: Show error.
- Booking not found: Show error.
- User not logged in: Still show confirmation (public page).

---

### `/booking/failed` — Payment Failed Page

**Layout:** `default`
**Middleware:** None (public page).

**Behavior:**
- Read `bookingId` from query param.
- Call `GET /api/booking/:id` to fetch booking details (if available).
- Show:
  - "Payment was not completed" message.
  - Booking summary (if booking exists).
  - "Try Again" button: Re-initiates payment for the same booking (call `POST /api/payment/initiate` again).
  - "Choose a Different Time" button → `/book`.

**Edge Cases:**
- No `bookingId`: Show generic error.
- Booking not found: Show generic error.

---

## Feature 4 — Booking Composable

**File:** `modules/booking/composables/useBooking.ts`

**State:**
```typescript
const step = useState<number>('booking-step', () => 1)
const selectedDate = useState<string | null>('booking-selected-date', () => null)
const selectedSlot = useState<AdminSlot | null>('booking-selected-slot', () => null)
const availableDates = useState<string[]>('booking-available-dates', () => [])
const availableSlots = useState<AdminSlot[]>('booking-available-slots', () => [])
const bookingId = useState<string | null>('booking-id', () => null)
const isLoading = useState<boolean>('booking-loading', () => false)
const error = useState<string | null>('booking-error', () => null)
```

**Methods:**
- `fetchAvailableDates(month: number, year: number)`: Calls `GET /api/booking/available-dates`.
- `fetchAvailableSlots(date: string)`: Calls `GET /api/booking/available-slots`.
- `selectSlot(slot: AdminSlot)`: Sets `selectedSlot`, advances to step 2.
- `createAndPay()`: Calls `POST /api/booking/create` (body has `date` and `startTime` only, no `doctorId`) then `POST /api/payment/initiate`, redirects to gateway.
- `reset()`: Resets all state to initial values.

---

## Edge Cases Summary

- Slot taken by another user between selection and payment: Re-validate in `POST /api/booking/create`.
- Payment gateway not configured: Return 500 in `POST /api/payment/initiate`.
- Webhook signature invalid: Return 400.
- Webhook processing fails: Log error but return 200.
- Booking confirmation page accessed without `bookingId`: Show error.
- Payment failed page accessed without `bookingId`: Show generic error.
- FullCalendar `datesSet` fires twice on init: Debounce by 100ms.
- No available dates in a month: Show user-friendly message.
