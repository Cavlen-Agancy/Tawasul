# Phase 3 — Booking & Payment Module
## overview.md

---

## Goal

Phase 3 builds the complete booking flow for the Tawasul Academy platform. After this phase, a logged-in patient can view available slots on a calendar, select a time, review a summary, pay online, and receive an acknowledgment email. The booking calendar shows slots configured by the admin through a global schedule. The patient does **not** select a doctor. The booking is created without a `doctorId` and remains PENDING until the admin assigns a doctor and confirms it.

---

## Scope

- **Admin Availability Logic**: `server/utils/admin-availability.ts` with `getAdminAvailableSlots(date)` and `getAdminAvailableDates(month, year)`.
  - These functions read from the `AdminSchedule` model (global, admin-controlled) not from the `Availability` model (doctor-controlled).
- **API Endpoints**: 6 endpoints for fetching available dates/slots, creating bookings, initiating payments, handling webhooks, fetching booking details, and canceling bookings.
- **Frontend Pages**: 3 pages (`/book`, `/booking/success`, `/booking/failed`).
- **Booking Composable**: `useBooking.ts` with state and methods for the booking flow.
- **Payment Integration**: Paymob or Stripe (configured via `PAYMENT_GATEWAY` env var).
- **Email Notifications**: Booking confirmation emails to patient and doctor.

---

## Out of Scope

- Doctor or admin booking management (Phase 6).
- Patient dashboard (Phase 4).
- Doctor dashboard (Phase 5).
- Refund API integration (manual refunds via gateway dashboard for MVP).
- Session room creation (handled in Phase 4 for patients, Phase 5 for doctors).

---

## Dependencies

**Must exist from Phase 0:**
- `server/utils/prisma.ts` — singleton Prisma client.
- `server/utils/email.ts` — `sendEmail`, `bookingReceivedTemplate` (booking acknowledgment), `bookingCancellationTemplate`.
- `server/utils/auth.ts` — `requireAuth`.
- All `Booking`, `Payment`, `AdminSchedule`, `GlobalBlockedDate`, `Settings` model fields in `schema.prisma`.

**Must exist from Phase 1:**
- `middleware/auth.ts` — protect routes.
- `middleware/patient-only.ts` — restrict to patients.
- `useAuth` composable — check auth state.

**Must exist from Phase 2:**
- `layouts/default.vue` — public layout (booking pages use this).

**Environment Variables:**
- `PAYMENT_GATEWAY` ("paymob" or "stripe").
- Paymob: `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_HMAC_SECRET`.
- Stripe: `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `APP_URL` — for success/failure redirect URLs.
- `JITSI_DOMAIN` — for future session room creation (not used in this phase).

---

## Stack Used

```
nuxt: ^3.x
shadcn-vue: latest
@nuxtjs/tailwindcss: latest
zod: ^3.x
fullcalendar: ^6.x
paymob-js: ^1.x (if using Paymob)
@stripe/stripe-js: ^2.x (if using Stripe)
```

---

## Folder Structure

```
modules/booking/
├── composables/
│   └── useBooking.ts          (create)
├── pages/
│   ├── book.vue               (create)
│   ├── booking/
│   │   ├── success.vue        (create)
│   │   └── failed.vue         (create)
│   └── components/            (empty for now)
└── server/
    └── api/
        └── booking/
            ├── available-dates.get.ts     (create)
            ├── available-slots.get.ts     (create)
            ├── create.post.ts             (create)
            └── [id].get.ts                (create)

modules/payment/
├── server/
│   └── api/
│       └── payment/
│           ├── initiate.post.ts       (create)
│           └── webhook.post.ts         (create)
└── pages/                     (empty for now)

server/
└── utils/
    └── admin-availability.ts    (replaces availability.ts for booking flow)
```

---

## Key Conventions

- **API Routes**: Use Nitro file-based routing. Each endpoint is a separate file.
- **Validation**: Use Zod for request body/query validation. Return 400 with `{ message: string }` on failure.
- **Auth Protection**: Call `requireAuth(event, ['PATIENT'])` as the first line in patient-only endpoints.
- **Availability**: Use `getAdminAvailableSlots` and `getAdminAvailableDates` from `server/utils/admin-availability.ts` for all slot calculations. **Never** calculate slots inline in route handlers.
- **Payment**: Use the gateway specified in `PAYMENT_GATEWAY` env var. Support both Paymob and Stripe.
- **Webhooks**: Always return 200 to the gateway first, then process internally. Log errors separately.
- **Error Handling**: Return user-friendly error messages. Never expose sensitive data (e.g., payment gateway errors).
- **FullCalendar**: Use the `datesSet` callback to fetch available dates/slots. Debounce to avoid double-fetches.
- **Booking without doctor**: The create booking endpoint does NOT require `doctorId`. It is null until admin assigns a doctor.
- **Availability source**: All availability calculations use the `AdminSchedule` model, never the `Availability` model. The `Availability` model remains in the schema for doctor calendar display (Phase 5) but is not used in the booking flow.
- **Booking status flow**: `PENDING` (after payment) → `CONFIRMED` (after admin assigns doctor). The `IN_REVIEW` status is reserved for future use.

---

## Notes for the AI

- The `getAdminAvailableSlots` function is the **single source of truth** for slot availability. Re-run it on the server in `POST /api/booking/create` to ensure the slot wasn't taken by another user.
- For Paymob: Use the **intention API with a redirect flow** (not iframe).
- For Stripe: Use **Stripe Checkout Sessions** (not PaymentIntents directly).
- The booking flow is **linear**: Choose Time → Review → Pay. Use a step indicator to show progress.
- The patient does **not** choose a doctor. The booking is created with `doctorId: null` and remains `PENDING`.
- After payment success, the webhook keeps the `Booking` status as `PENDING` and sends a "booking received" acknowledgment email to the patient. Confirmation emails to patient and doctor are sent later by the admin when the doctor is assigned (Phase 6).
- Refunds for MVP are **manual** — just mark as `REFUNDED` in the DB and note this to the admin.
