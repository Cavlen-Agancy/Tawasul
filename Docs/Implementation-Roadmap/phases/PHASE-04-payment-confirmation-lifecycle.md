# Phase 4 — Payment-Driven Confirmation & Booking Lifecycle

**Requirement:** A (part 2) — no approval process, online confirmed only after successful payment, in-clinic registered without payment, failure/incomplete never confirmed, double-booking and webhook safety.  
**Decision status:** A2/A4/A5 are DECIDED. **A1 (20-minute hold) and A3 (late success/refund) are DECIDED — OWNER APPROVED.** Release still requires implementation verification, but no further business approval is pending.  
**Implementation status (2026-11-09):** Payment-driven confirmation code and tests are implemented. Automated tests were not executed in this task; see `Docs/phase-reports/phase-4-payment-confirmation.md`.
**Priority rationale:** Business Impact 5, Security Risk 5, UX Severity 4, Technical Risk 5. Depends on Phase 3.

## 1. Business Objective

Remove manual admin/doctor approval from the normal booking path. A patient-selected doctor booking becomes confirmed by the system:

- online: only after the payment provider reports success;
- in-clinic: immediately at creation, with no online payment.

Failed, abandoned, or incomplete online payments must never produce a confirmed appointment. The system must be safe against duplicate webhooks and concurrent slot selection, and must preserve historical payments.

## 2. Scope

Included:

- Online booking hold/expiry.
- Automatic confirmation in the verified payment success handler.
- In-clinic immediate confirmation and confirmation emails.
- Failed/abandoned payment behavior.
- Idempotent duplicate webhook handling.
- Serialized slot reservation to prevent double booking.
- Late/delayed webhook policy.
- Remove normal admin pending/assign flow from UI; retain a legacy-only remediation path.
- Patient success page confirmation/polling.
- Patient cancellation refund rule fix (SUCCESS only).
- Stripe Checkout URL fix if Stripe remains a supported gateway.
- Tests and E2E for the full lifecycle.

Out of scope:

- Refund API integration (manual gateway refunds remain).
- Recurring bookings, reschedule redesign, notifications.
- Blog.
- Email verification.
- Session re-entry (already Phase 1).

## 3. Prerequisites and Decision Gates

- Phase 3 merged and staging-verified.
- **A1 owner-approved:** 20-minute online hold, configurable 5–60 minutes via `BOOKING_HOLD_MINUTES`.
- **A3 owner-approved:** late successful payment policy and manual refund/reconciliation.
- **A2/A4/A5 DECIDED:** expiry releases slot without auto-cancel/cleanup; legacy rows preserved; no confirmed reassignment.
- Payment gateway test credentials available for verification, or explicit approval to test only with the dev mock.
- Database snapshot/backup before production migration.

A1 and A3 are owner-approved. The plan below is the approved implementation; release still depends on verification.

## 4. Current Facts

- Successful payment leaves the booking `PENDING`. **CONFIRMED** in `server/utils/booking-status.ts`.
- Failed payment leaves the booking `PENDING`. **CONFIRMED.**
- Booking creation is not transactional and does not lock the slot. **CONFIRMED.**
- Availability counts only `CONFIRMED` bookings. **CONFIRMED.**
- Admin assignment is the only code that confirms a booking. **CONFIRMED.**
- Admin cancel refunds only `SUCCESS`; patient cancel refunds any non-`REFUNDED` payment. **CONFIRMED.**
- Stripe returns `clientSecret`; `/book` cannot redirect to a Stripe Checkout URL. **CONFIRMED.**
- `Payment.bookingId` is unique; `Payment` and `Booking` are 1:1. **CONFIRMED.**

## 5. Target Lifecycle

```
IN_CLINIC
  POST /api/booking/create
    -> Booking{status: CONFIRMED, doctorId, no Payment}
    -> confirmation email to patient + doctor

ONLINE
  POST /api/booking/create
    -> Booking{status: PENDING, doctorId, holdExpiresAt}
    -> Payment{status: PENDING}
  POST /api/payment/initiate
    -> gateway URL / mock
  webhook success (verified)
    -> Payment{SUCCESS}
    -> Booking{PENDING -> CONFIRMED} (conditional, transaction, idempotent)
    -> confirmation email to patient + doctor once
  webhook failure (verified)
    -> Payment{FAILED}
    -> Booking stays PENDING until hold expiry, or patient retries/cancels
  hold expiry
    -> availability stops treating the hold as active
  patient/admin cancel
    -> Booking{CANCELLED}
    -> Payment SUCCESS -> REFUNDED only
```

## 6. Implementation Tasks

### Task 1: Add booking hold schema and configuration

**Files:**
- Modify: `prisma/schema.prisma`
- Add migration: `prisma/migrations/<timestamp>_booking_hold/migration.sql` (proposed; not authored here)
- Modify: `nuxt.config.ts` runtimeConfig: `bookingHoldMinutes`
- Modify: `.env.example` (document `BOOKING_HOLD_MINUTES`, no secret value)
- Tests: migration/behavior tests.

Schema:

```prisma
model Booking {
  ...
  holdExpiresAt DateTime?
  ...
  @@index([status, holdExpiresAt])
}
```

Behavior:

- `bookingHoldMinutes` default **20**, read from `process.env.BOOKING_HOLD_MINUTES`, allowed range **5–60**. Values outside the range are rejected/clamped with a startup warning; never trust a client value.
- Online create sets `holdExpiresAt = now + bookingHoldMinutes`.
- In-clinic leaves it null (confirmed immediately).
- Legacy `PENDING` rows keep `holdExpiresAt = NULL` (A4). A null hold means the legacy row remains blocking/visible until an admin resolves it; it is not automatically assigned, confirmed, or deleted. New online holds expire normally.
- No automatic cleanup/timer cancels expired or legacy `PENDING` rows. Expiry only makes the slot bookable; the booking remains `PENDING` and admin-visible.
- Paid rows are never auto-cancelled; any admin cleanup must conditionally exclude `Payment.SUCCESS`, `CONFIRMED`, and `CANCELLED`.

Migration:

- Add nullable column and index only.
- Do not update legacy rows automatically.
- Rollback is additive; old code ignores the column.

### Task 2: Make slot occupancy explicit

**Files:**
- Modify: `server/utils/availability.ts`
- Modify: `modules/booking/server/api/booking/create.post.ts`
- Tests: `tests/utils/availability.test.ts`, `tests/api/booking/create.post.test.ts`, `tests/api/booking/available-*.test.ts`

Define an occupied slot as:

- `CONFIRMED` booking for the same doctor/date overlapping the slot;
- `PENDING` booking for the same doctor/date overlapping the slot where:
  - `holdExpiresAt` is null (legacy conservative rule), or
  - `holdExpiresAt > now`.
- `CANCELLED` rows and expired holds are not occupied. A `PENDING` booking with `Payment=FAILED` still occupies while its hold is active, so the patient can retry before expiry.

Add a helper such as `isBookingHoldActive(booking, now)` and use it in:
- available dates
- available slots
- create revalidation
- reschedule revalidation

Acceptance:

- Two active holds for the same doctor/time cannot both be shown as available.
- Expired holds free the slot.
- Confirmed bookings always block.

### Task 3: Serialize booking creation to prevent double booking

**Files:**
- Modify: `modules/booking/server/api/booking/create.post.ts`
- Modify: `server/utils/availability.ts` to accept an optional Prisma transaction client
- Add: `server/utils/slot-lock.ts` (new) or equivalent small helper
- Tests: new concurrency test under `tests/api/booking/`

Design:

1. Parse/validate the request and resolve the active doctor.
2. Open an interactive Prisma transaction.
3. Acquire a PostgreSQL transaction advisory lock keyed by a stable string:
   - `doctorId + '|' + date + '|' + startTime` (or a hash of it).
4. Re-run the doctor-specific availability check **inside the transaction** (using the transaction client).
5. Reject `400 "This slot is no longer available"` if absent.
6. Create the booking and payment in the same transaction.
7. Commit.

Do not rely on a pre-transaction availability read. Do not add an in-memory lock; it does not work across processes.

Acceptance:

- Concurrent create calls for the same doctor/date/start produce exactly one booking.
- Concurrent create calls for different doctors or different times do not block each other unnecessarily.
- The success response still returns `{ bookingId, amount, currency, sessionType }`.

### Task 4: In-clinic immediate confirmation

**Files:**
- Modify: `modules/booking/server/api/booking/create.post.ts`
- Modify: `server/utils/email.ts` if a template needs the doctor/time
- Tests: `tests/api/booking/create.post.test.ts`

Changes:

- For `IN_CLINIC`, create `Booking{ status: 'CONFIRMED', doctorId }` and no `Payment`.
- Send confirmation emails to patient and doctor after the transaction commits; email failure must not roll back the booking.
- Return `{ bookingId, amount: 0, currency: 'EGP', sessionType: 'IN_CLINIC' }`.
- No admin/doctor approval.

Acceptance:

- In-clinic booking visible immediately in admin and doctor calendars.
- No payment row.
- Confirmation email attempted; failure logged, booking retained.

### Task 5: Transactional, idempotent payment success

**Files:**
- Modify: `server/utils/booking-status.ts`
- Modify: `modules/payment/server/api/payment/webhook.post.ts` only if it needs to expose processing errors/status
- Modify: `server/utils/email.ts`
- Tests: `tests/api/payment/webhook.post.test.ts`

Implementation:

1. Verify the gateway signature first (unchanged; fail closed).
2. Resolve `bookingId` from verified payload.
3. Open a transaction and lock the booking row with `SELECT ... FOR UPDATE` or an equivalent safe conditional update.
4. If payment is already `SUCCESS` and booking is already `CONFIRMED`, return without side effects.
5. If booking is `CANCELLED`, record payment success but do not confirm; it enters the manual reconciliation/refund state. Do not resurrect a cancelled booking.
6. If booking is `PENDING` with a doctor and the hold is active:
   - re-check that no other `CONFIRMED` booking or active hold (excluding this booking) occupies the slot;
   - conditionally update `Booking.status` to `CONFIRMED`;
   - update `Payment.status` to `SUCCESS` (only from `PENDING`/`FAILED`);
   - send confirmation emails only when the booking transition affected the row once.
7. If the hold has expired, use Task 7's late-success branch instead of assuming confirmation.
8. If booking has no doctor (legacy), do not auto-confirm; leave it for legacy remediation.
9. Commit before returning `200`. If an internal DB error occurs, return a non-2xx (or follow the agreed retry policy) so the gateway retries; do not silently swallow a paid-but-unconfirmed state. This changes the current “always 200 after signature” behavior and must be explicit in the implementation.

Email idempotency:

- Send confirmation only on the `PENDING -> CONFIRMED` transition.
- Duplicate callbacks must not send a second confirmation.
- Current “booking received” email should be removed or replaced with the final confirmation, depending on product copy.

Acceptance:

- Success webhook confirms an active online booking.
- Duplicate success webhooks make no duplicate state/email.
- Missing/invalid signature still 400.
- Missing doctor/invalid booking does not confirm.
- Booking already cancelled is not resurrected.
- Payment records remain for history.

### Task 6: Failure and expiry behavior

**Files:**
- Modify: `server/utils/booking-status.ts`
- Modify: `modules/payment/server/api/payment/initiate.post.ts`
- Modify: `modules/booking/pages/booking/failed.vue`
- Tests: payment + booking tests

Changes:

- On verified failure: set `Payment.status = FAILED`; do not confirm; leave booking `PENDING` until hold expires so the patient can retry (as current UX implies).
- `initiate` must reject:
  - `CONFIRMED` booking;
  - `CANCELLED` booking;
  - expired hold (`holdExpiresAt <= now`) with a clear “payment window expired, please book again” response;
  - no payment row (in-clinic).
- Expiry rule: an expired `PENDING` hold is not bookable and is not automatically confirmed. The booking **remains PENDING**. There is no automatic cancellation/cleanup job or timer in this release. A verified late success follows Task 7, not this automatic expiry path.
- The admin reconciliation query must expose expired PENDING rows. Any admin cancellation must be explicit and conditional: `status = PENDING`, `holdExpiresAt <= now`, and **no `Payment.SUCCESS`**; never auto-cancel a paid row.
- No `EXPIRED` status is added; expiry is derived from `holdExpiresAt`.
- `failed.vue` should explain retry vs expiry.

Acceptance:

- Failed payment never confirms.
- Retry works before expiry.
- Retry after expiry fails clearly; patient must create a new booking.
- Abandoned payment does not block the slot after hold expiry.

### Task 7: Late successful payment (A3 owner approved)

**Files:**
- Modify: `server/utils/booking-status.ts`
- Tests: new late-webhook tests.

Final branch table (owner-approved):

| Booking state when verified success arrives | Action |
|---|---|
| Already `CONFIRMED`, payment `SUCCESS` | Idempotent no-op; no duplicate email |
| `PENDING`, hold active | Confirm under lock; idempotent; send confirmation once |
| `PENDING`, hold expired, original slot free | Recheck under lock; confirm; send confirmation once |
| `PENDING`, hold expired, slot occupied | Do **not** confirm; keep `Payment = SUCCESS`; set booking `CANCELLED`; manual refund/reconciliation |
| Already `CANCELLED` | Do not re-confirm; keep payment `SUCCESS`; manual refund/reconciliation |
| No doctor / legacy | Do not auto-confirm; legacy admin remediation |

Rules:

- Never create a second confirmed booking for the slot.
- Never auto-refund. Payment remains `SUCCESS` until an operator completes the provider refund and updates it to `REFUNDED`.
- The reconciliation query must show all `Payment.SUCCESS AND Booking.status != CONFIRMED` rows.
- A late success must never overwrite another patient's confirmed booking/hold.
- Duplicate late webhooks are idempotent.

### Task 8: Patient success and failure UI

**Files:**
- Modify: `modules/booking/pages/booking/success.vue`
- Modify: `modules/booking/pages/booking/failed.vue`
- Modify: `modules/booking/composables/useBooking.ts`
- Modify: `modules/booking/composables/types.ts`
- Tests: E2E updated.

Success page:

- Remove “Booking Request Received / we will review and confirm shortly.”
- Show “Booking confirmed” only when `status === 'CONFIRMED'`.
- If the redirect arrives before the webhook, show “Confirming your payment…” and poll `GET /api/booking/:id` (e.g., every 2s for up to 30s).
- If still pending after the poll window, show “Payment is being processed; your booking is not confirmed yet” with a retry/refresh action.
- If the late-payment branch leaves the booking `CANCELLED` after a successful payment, show “Payment received; the appointment could not be confirmed and our team will contact you for refund/rebooking.” Do not show “confirmed.”
- Include selected doctor, date/time, session type, amount/currency.

Failed page:

- Explain that the booking is not confirmed.
- Allow retry only while the hold is active.
- Do not imply the booking is confirmed.

### Task 9: Fix refund semantics and cancellation

**Files:**
- Modify: `modules/booking/server/api/booking/[id]/cancel.patch.ts`
- Tests: `tests/api/booking/[id].cancel.patch.test.ts`

Changes:

- Patient and admin cancellation update only `Payment.status === 'SUCCESS'` to `REFUNDED`.
- `PENDING`/`FAILED` payments remain as-is.
- Never mark a failed/pending payment as refunded.
- Release the slot by setting `Booking.status = 'CANCELLED'`.
- Keep the 24-hour patient rule; admin remains unrestricted.
- Do not implement gateway refund API; document manual refund.

### Task 10: Remove normal admin approval UI; retain legacy remediation

**Files:**
- Modify: `pages/admin/appointments.vue`
- Modify: `modules/admin/composables/useAdminDashboard.ts`
- Modify: `modules/admin/server/api/admin/bookings/pending.get.ts`
- Modify: `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts`
- Tests: `tests/api/admin/bookings-manage.test.ts`, `tests/e2e/admin-panel.spec.ts`

Changes:

- Normal admin dashboard no longer presents a “pending approval” queue for new bookings.
- `pending.get` returns only legacy `doctorId: null` bookings (or is removed from normal UI).
- `assign` works only for legacy unassigned `PENDING` rows; reject assigned bookings.
- **No confirmed-booking reassignment** endpoint/UI. Admin recovery for a doctor change is cancel + rebook.
- Add a clearly labeled “Legacy unassigned bookings” section or admin maintenance filter, not part of the normal flow.
- Admin calendar remains the operational read model for all bookings.
- Admin overview copy should no longer say “pending review” for normal online bookings.

Acceptance:

- A normal new online booking never needs admin action after payment success.
- A normal in-clinic booking never needs admin action.
- Legacy unassigned rows remain visible/resolvable.
- No admin/doctor approval appears in the main flow.
- No API can change the doctor on a confirmed booking.

### Task 11: Fix Stripe Checkout redirect if Stripe is supported

**Files:**
- Modify: `server/utils/payment.ts`
- Modify: `modules/booking/composables/useBooking.ts` and/or dashboard flow
- Tests: payment unit test / E2E if Stripe test keys are available.

Changes:

- Return `paymentUrl: session.url` from Stripe Checkout when available.
- Keep `clientSecret` only if a client-side confirmation flow is intentionally implemented; the current UI does not implement one.
- Update UI to redirect to `paymentUrl` for both gateways.
- Do not claim Stripe works until verified with test keys.

Stripe is secondary to Paymob; if the product chooses Paymob-only for this release, mark Stripe as unsupported in configuration and keep the fallback error explicit.

### Task 12: Data reconciliation and operations

**Files:**
- Add documentation: `Docs/Implementation-Roadmap/operations/payment-reconciliation.md` (optional proposed path) or a section in `03-risks-and-open-questions.md`.
- Add an admin read-only query/endpoint only if necessary.

Include queries for:

- paid-but-not-confirmed bookings;
- PENDING bookings with expired holds;
- PENDING bookings with successful payment;
- bookings with no doctor (legacy);
- duplicate webhook log entries.

These queries must not mutate data without approval.

## 7. Expected Database Changes

- `Booking.holdExpiresAt DateTime?`.
- Index `@@index([status, holdExpiresAt])`.
- No change to `Payment` schema; reconciliation uses existing payment/booking status.
- No deletion of payments or bookings.
- Migration is additive.
- Legacy rows keep null holds; they remain blocking/admin-visible until explicit resolution. No auto status change.

## 8. Expected API Changes

- Create returns session type; in-clinic is confirmed immediately.
- Payment initiate rejects expired/cancelled/confirmed bookings.
- Webhook path returns non-2xx on internal processing failure after signature verification so the gateway can retry; handlers must remain idempotent.
- Admin pending/assign responses are legacy-only.
- No public response schema break for booking detail; `status` now reaches `CONFIRMED` automatically.

## 9. UI/UX Considerations

- Never show “confirmed” before server status is `CONFIRMED`.
- Payment redirect can return before the webhook; use a confirming state and polling.
- If payment fails, the slot is not guaranteed forever; show the hold expiry/retry message.
- In-clinic success should not mention payment.
- Admin calendar should clearly show doctor-selected bookings and no “unassigned” state for new rows.
- Email copy must match the new no-approval flow.
- Accessibility: loading/polling state must be announced; error states must be actionable.

## 10. Acceptance Criteria

1. Online booking is `CONFIRMED` only after a verified successful payment.
2. In-clinic booking is `CONFIRMED` at creation with no payment.
3. Failed payment is never confirmed.
4. Default hold is 20 minutes (5–60 configurable); expiry frees the slot but leaves the booking PENDING; no automatic cleanup/cancellation.
5. Expiry never cancels a booking whose Payment is SUCCESS.
6. Late success with free slot confirms; occupied slot does not double-book and moves to manual refund/reconciliation; already cancelled remains cancelled.
7. Duplicate success/late webhooks are idempotent.
8. Concurrent creation for the same doctor/time produces exactly one booking.
9. Confirmation emails are sent once per confirmed booking, to patient and doctor.
10. Admin has no normal approval step and no confirmed reassignment.
11. Admin and doctor calendars automatically show the booking; doctor sees confirmed/cancelled only.
12. Historical bookings/payments are preserved.
13. Patient cancel refund status applies only to successful payments.
14. Stripe either works end-to-end or is explicitly disabled/unsupported.

## 11. Required Tests

### Unit

- Slot occupancy helper: active/expired PENDING, CONFIRMED, CANCELLED.
- Payment state transition helper: idempotent success, failure, late success.
- Email idempotency condition.

### API

- `tests/api/booking/create.post.test.ts`:
  - in-clinic confirmed/no payment;
  - online pending/payment/hold;
  - hold default 20 + configurable 5–60;
  - concurrent create test;
  - expired hold becomes non-blocking without auto-cancel.
- `tests/api/payment/webhook.post.test.ts`:
  - success confirms while hold active;
  - duplicate success no duplicate effects;
  - failure does not confirm;
  - missing doctor does not confirm;
  - late success + free slot confirms;
  - late success + occupied slot does not double-book, booking cancelled, payment remains SUCCESS;
  - late success + already cancelled does not confirm;
  - no automatic refund;
  - invalid signature unchanged.
- `tests/api/payment/initiate.post.test.ts`:
  - expired/cancelled/confirmed rejected;
  - retry before expiry.
- `tests/api/booking/[id].cancel.patch.test.ts`:
  - only SUCCESS refunded;
  - slot released.
- `tests/api/admin/bookings-manage.test.ts`:
  - legacy assign only;
  - no confirmed reassignment;
  - normal queue behavior.
- `tests/utils/email.test.ts` if template changes.

### E2E

- Booking with mock payment → success page shows confirmed → admin calendar and selected doctor calendar show it.
- In-clinic → success without payment → calendar.
- Failed payment → not confirmed; retry path/expiry message.
- Admin has no pending approval action for new bookings.
- Patient sees only their booking; doctor sees only theirs.

## 12. Risks and Dependencies

- **Critical:** A1 hold duration and A3 late-payment/refund policy are owner-approval items; wrong defaults can double-book or force manual refunds.
- **Critical:** Payment webhook must be transactional; a partially updated payment/booking is unacceptable.
- **Risk:** Changing the webhook from “always 200” to non-2xx may cause gateway retries; ensure handlers are idempotent before making this switch.
- **Risk:** Current real gateway payload/signature compatibility is unverified; test with staging keys before production.
- **Risk:** Notification emails are best-effort; booking state must not depend on email success.
- **Dependency:** Phase 3 doctor-linked bookings and doctor-specific availability.
- **Rollback:** additive schema; do not roll back payment data manually. Restore from snapshot if incorrect confirmations occur.

## 13. Definition of Done

- Schema/migration applied in staging and verified.
- A1, A3, B3, and C1 are owner-approved; A2/A4/A5 remain DECIDED.
- Full payment lifecycle tests pass when approved.
- No normal admin approval or confirmed reassignment remains.
- Expiry does not auto-cancel or auto-refund; late success branch is complete.
- Emails and UI copy reflect automatic confirmation.
- Reconciliation queries documented.
- Phase 3 + Phase 4 deployed together.
