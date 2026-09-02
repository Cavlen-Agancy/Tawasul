# Phase 3 — Booking & Payment Module
## overview.md

---

## Goal

Phase 3 builds the complete booking flow for the Tawasul Academy platform. After this phase, a logged-in patient can view available slots on a calendar, select a time, review a summary, pay online, and receive a confirmation email. The slot is blocked immediately after payment, and both the patient and doctor receive confirmation emails. The patient does **not** choose a doctor; the admin assigns doctors to availability slots, and the system automatically assigns the doctor who owns the selected slot.

---

## Scope

- **Availability Logic**: `server/utils/availability.ts` with `getAvailableSlots(date)` and `getAvailableDates(month, year)`.
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
- `server/utils/email.ts` — `sendEmail`, `bookingConfirmationTemplate`.
- `server/utils/auth.ts` — `requireAuth`.
- All `Booking`, `Payment`, `Availability`, `BlockedSlot`, `Settings` model fields in `schema.prisma`.

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
    └── availability.ts         (create)
```

---

## Key Conventions

- **API Routes**: Use Nitro file-based routing. Each endpoint is a separate file.
- **Validation**: Use Zod for request body/query validation. Return 400 with `{ message: string }` on failure.
- **Auth Protection**: Call `requireAuth(event, ['PATIENT'])` as the first line in patient-only endpoints.
- **Availability**: Use `getAvailableSlots` and `getAvailableDates` from `server/utils/availability.ts` for all slot calculations. **Never** calculate slots inline in route handlers.
- **Payment**: Use the gateway specified in `PAYMENT_GATEWAY` env var. Support both Paymob and Stripe.
- **Webhooks**: Always return 200 to the gateway first, then process internally. Log errors separately.
- **Error Handling**: Return user-friendly error messages. Never expose sensitive data (e.g., payment gateway errors).
- **FullCalendar**: Use the `datesSet` callback to fetch available dates/slots. Debounce to avoid double-fetches.

---

## Notes for the AI

- The `getAvailableSlots` function is the **single source of truth** for slot availability. Re-run it on the server in `POST /api/booking/create` to ensure the slot wasn't taken by another user.
- For Paymob: Use the **intention API with a redirect flow** (not iframe).
- For Stripe: Use **Stripe Checkout Sessions** (not PaymentIntents directly).
- The booking flow is **linear**: Choose Time → Review → Pay. Use a step indicator to show progress.
- The patient does **not** choose a doctor. The doctor is determined by the slot's `doctorId`.
- After payment success, the webhook updates the `Booking` status to `CONFIRMED` and sends emails.
- Refunds for MVP are **manual** — just mark as `REFUNDED` in the DB and note this to the admin.
