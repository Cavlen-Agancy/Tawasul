# Phase 3 — Booking & Payment Module
## expected-output.md

---

## API Endpoints Delivered

| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/booking/available-dates` | No | Fetch dates with available slots for a month. |
| GET | `/api/booking/available-slots` | No | Fetch available time slots for a specific date. |
| POST | `/api/booking/create` | PATIENT | Create a new booking (PENDING status). |
| GET | `/api/booking/:id` | PATIENT or STAFF | Fetch booking details by ID. |
| PATCH | `/api/booking/:id/cancel` | PATIENT or STAFF | Cancel a booking (24hr rule for patients). |
| POST | `/api/payment/initiate` | PATIENT | Initiate payment for a booking. |
| POST | `/api/payment/webhook` | No | Handle payment gateway webhook. |

---

## Pages Delivered

| Route | Layout Used | Middleware Applied | Description |
|---|---|---|---|
| `/book` | `default` | `auth` | Booking page with calendar, slot selection, and payment flow. |
| `/booking/success` | `default` | None | Confirmation page shown after successful payment. |
| `/booking/failed` | `default` | None | Payment failed page with retry option. |

---

## Components Delivered

None. All booking pages use shadcn-vue and FullCalendar directly.

---

## Composables Delivered

| File | State | Methods |
|---|---|---|
| `modules/booking/composables/useBooking.ts` | `step`, `selectedDate`, `selectedSlot`, `availableDates`, `availableSlots`, `bookingId`, `isLoading`, `error` | `fetchAvailableDates(month, year)`, `fetchAvailableSlots(date)`, `selectSlot(slot)`, `createAndPay()`, `reset()` |

---

## Server Utilities Delivered

| File | Functions Exported |
|---|---|
| `server/utils/admin-availability.ts` | `getAdminAvailableSlots(date: string): Promise<AdminSlot[]>`, `getAdminAvailableDates(month: number, year: number): Promise<string[]>` |

**Reused from Phase 0:**
- `server/utils/prisma.ts` — `prisma` singleton.
- `server/utils/email.ts` — `sendEmail`, `bookingReceivedTemplate` (booking acknowledgment), `bookingCancellationTemplate`.
- `server/utils/auth.ts` — `requireAuth`.

**Reused from Phase 1:**
- `middleware/auth.ts` — Protect routes.
- `middleware/patient-only.ts` — Restrict to patients.

---

## Database Changes

No schema changes in this phase. Uses existing models:
- `Booking`
- `Payment`
- `AdminSchedule`
- `GlobalBlockedDate`
- `Settings`

---

## Emails Sent

| Trigger Event | Recipient | Template Used | Key Variables |
|---|---|---|---|
| Payment success (webhook) | Patient | `bookingReceivedTemplate` | `patientName`, `date`, `time` |
| Booking cancelled | Patient | `bookingCancellationTemplate` | `patientName`, `date`, `time` |

> **Note:** Booking confirmation emails (doctor assignment + patient confirmation) are sent by the admin in Phase 6, not in this phase.

---

## Environment Variables Used

| Variable | Where Used |
|---|---|
| `PAYMENT_GATEWAY` | `POST /api/payment/initiate` to choose Paymob or Stripe. |
| `APP_URL` | `POST /api/payment/initiate` for success/failure redirect URLs. |
| `PAYMOB_API_KEY` | Paymob payment initiation in `POST /api/payment/initiate`. |
| `PAYMOB_INTEGRATION_ID` | Paymob payment initiation. |
| `PAYMOB_HMAC_SECRET` | Paymob webhook signature verification in `POST /api/payment/webhook`. |
| `STRIPE_SECRET_KEY` | Stripe payment initiation and webhook verification. |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Checkout (frontend, via `public` runtime config). |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification. |
| `RESEND_API_KEY` | `sendEmail` in webhook handler. |
| `RESEND_FROM_EMAIL` | `sendEmail` in webhook handler. |
| `RESEND_FROM_NAME` | `sendEmail` in webhook handler. |

---

## Third-Party Integrations

| Service | Purpose | Configuration |
|---|---|---|
| FullCalendar | Calendar UI for slot selection | Installed via npm, configured in `/book` page. |
| Paymob | Payment gateway (Egypt) | Configured via env vars, used in `POST /api/payment/initiate` and `POST /api/payment/webhook`. |
| Stripe | Payment gateway (global) | Configured via env vars, used in `POST /api/payment/initiate` and `POST /api/payment/webhook`. |

---

## What the Next Phase (Phase 4) Will Receive

- Complete booking flow working end-to-end:
  - Available dates/slots load on `/book`.
  - Slot selection and booking creation work.
  - Payment initiation redirects to gateway.
  - Webhook updates payment status and sends booking acknowledgment email.
  - Confirmation and failure pages show correct data.
- `useBooking` composable for managing booking state.
- `server/utils/admin-availability.ts` for admin-controlled slot calculations.
- All booking and payment API endpoints.
- Booking request acknowledgment email sent to patient upon payment.
- FullCalendar integrated and configured.
- Payment gateway (Paymob or Stripe) integrated.
