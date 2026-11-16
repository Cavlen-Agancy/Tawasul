# Phase 4 — Payment-Driven Confirmation

## Objective
Automatically confirm online bookings only after a verified successful payment; confirm in-clinic bookings immediately without payment; make webhook processing idempotent and safe.

## Implemented
- Booking schema adds `holdExpiresAt` with a `(status, holdExpiresAt)` index.
- Online creation sets a 5–60 minute server-side hold (default 20) and creates a pending payment.
- In-clinic creation is `CONFIRMED` immediately, creates no payment, and sends confirmation emails.
- Availability treats CONFIRMED bookings and pending bookings with active holds as occupied; legacy null holds remain conservative blockers.
- `handleSuccessfulPayment` validates amount/currency against the server payment row, locks by booking, refuses to resurrect cancelled bookings, requires an active hold and doctor, rechecks slot conflicts, and confirms idempotently.
- Duplicate success webhooks do not resend confirmation email.
- Payment success/failure payload extraction supports Paymob and Stripe shapes and rejects successful events without amount/currency.
- Dev mock payment completion validates the stored payment before confirming.
- Patient cancellation refunds only `SUCCESS` payments.
- Admin assignment is restricted to legacy doctorless PENDING bookings.
- Booking success page reflects confirmed vs pending and polls briefly for webhook confirmation.
- Confirmation email is sent only after verified success.

## Files
- `prisma/schema.prisma`
- `prisma/migrations/0003_doctor_booking_foundation/migration.sql`
- `modules/booking/server/api/booking/create.post.ts`
- `modules/payment/server/api/payment/webhook.post.ts`
- `modules/payment/server/api/payment/initiate.post.ts`
- `modules/payment/server/api/payment/dev/complete.get.ts`
- `server/utils/booking-status.ts`
- `server/utils/availability.ts`
- `modules/booking/server/api/booking/[id]/cancel.patch.ts`
- `modules/booking/pages/booking/success.vue`
- `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts`
- `tests/api/payment/webhook.post.test.ts`
- `.env.example` (booking hold documentation)

## Tests
- Prepared command:
  - `npm run test -- tests/api/payment/webhook.post.test.ts`
- Execution: **NOT RUN** (task restrictions prohibit builds/full tests without approval).

## Status
- Implementation: **COMPLETE at code level**
- Automated verification: **NOT RUN**
- Manual verification: required (see checklist)

## Remaining Risks
- Real gateway webhook signature semantics (especially Paymob field concatenation) are not verified against a live gateway.
- Late/expired hold reconciliation and refund handling are not tested.
- Stripe Checkout client-flow is not verified.

---

## Verification Results — 2026-11-09
- Official Paymob field-order HMAC implemented.
- Webhook tests pass: valid success, invalid signature, wrong amount, wrong currency, unknown booking, duplicate delivery, concurrent duplicate delivery, failed payment, amount locking, Stripe valid/invalid signatures.
- Focused suite: **36/36 passed**.
- Full Vitest: **46 files / 312 tests passed**.
- Automated browser online booking used the local mock payment path and confirmed the booking; in-clinic booking confirmed without payment.
- Real Paymob/Stripe sandbox behavior and hold-expiry/late-payment reconciliation remain unverified.
