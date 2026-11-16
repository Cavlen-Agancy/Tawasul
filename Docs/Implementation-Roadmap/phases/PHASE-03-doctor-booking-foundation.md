# Phase 3 — Doctor-Based Booking Foundation

**Requirement:** A (part 1) — Complete Booking System Redesign: doctor selection, doctor-specific availability, automatic doctor association.  
**Decision status:** B3 (cross-date same-doctor rescheduling, 24h patient limit) is **DECIDED — OWNER APPROVED**. A4/A5 (legacy, no confirmed reassignment) and B1/B2 (availability source/default template) are DECIDED.  
**Implementation status (2026-11-09):** Doctor-based booking code and tests are implemented. Automated tests were not executed in this task; see `Docs/phase-reports/phase-3-doctor-booking.md`.
**Priority rationale:** Business Impact 5, UX Severity 5, Technical Risk 5, Security Risk 4. This is the source-of-truth change; it must be completed before payment auto-confirmation.

## 1. Business Objective

Patients choose a doctor and book a time that belongs to that doctor. Every new booking is linked to the chosen doctor automatically. Doctor and admin calendars receive the booking without manual assignment. This phase establishes the doctor-specific availability and linkage; Phase 4 removes the old approval/payment semantics.

## 2. Scope

Included:

- `AdminSchedule` becomes the clinic default template.
- Backfill `Doctor.Availability` for existing doctors with no rows.
- Copy active default schedule into new doctors at creation.
- Doctor-specific availability endpoints for patients.
- Public active-doctor listing for homepage/booking.
- New booking requires `doctorId`; booking creation associates the doctor.
- `/book` supports doctor selection, session type, and correct payment/no-payment branch.
- Homepage exposes active doctors with a booking link.
- Patient dashboard booking entry points consolidate into `/book` to avoid two divergent booking implementations.
- Reschedule/time-change paths use the booked doctor's availability; cross-date same-doctor rescheduling per B3 (owner approved).
- Admin assignment remains only as a transitional/legacy mechanism; normal new bookings already carry a doctor.
- Confirmed-booking reassignment is not supported; admin recovery is cancel + rebook.
- Admin and doctor calendars show the new doctor-linked bookings; doctors see only `CONFIRMED`/`CANCELLED`, not unpaid holds.

Out of scope:

- Automatic confirmation on payment success (Phase 4).
- Removing admin approval UI (Phase 4).
- Payment holds/races (Phase 4; Phase 3 still uses the existing non-transactional create check).
- Submission of blog (Phase 5).
- Session re-entry (Phase 1).
- Email verification.

## 3. Prerequisites

- Phase 2 merged (doctor UI cleanup) to avoid conflicting doctor layout edits.
- Phase 1 may be merged independently.
- Database backup/snapshot prepared for the availability backfill.
- Accept that Phase 3 alone leaves bookings in the old `PENDING`/manual-confirm state; Phase 3 and Phase 4 should ship in one production release.

## 4. Current Facts Governing the Design

- `Booking.doctorId` already exists and is nullable. **CONFIRMED.**
- `Doctor.Availability` unique per doctor/day and `Doctor.BlockedSlot` already exist; admin CRUD already exists. **CONFIRMED.**
- `server/utils/availability.ts` already implements doctor-aware slots but is not used by booking handlers and omits `GlobalBlockedDate`. **CONFIRMED.**
- `AdminSchedule` is unique per day, seeded all week, and currently drives patient slots. **CONFIRMED.**
- New doctor creation does not create `Availability` rows. **CONFIRMED.**
- Public doctors API does not exist. **MISSING.**
- `/book` has no doctor selector and defaults to `ONLINE`; the patient dashboard has a duplicate inline booking flow with `IN_CLINIC` support. **CONFIRMED.**

## 5. Implementation Tasks

### Task 1: Make `server/utils/availability.ts` the doctor-aware source of truth

**Files:**
- Modify: `server/utils/availability.ts`
- Modify: `tests/utils/availability.test.ts`
- Modify: `server/utils/admin-availability.ts` (deprecate/reduce)
- Modify: booking API handlers (Tasks 3–4)

Changes:

- Update `getAvailableSlots(date: string, doctorId: string)`:
  - filter `Availability` by `doctorId` and `doctor.isActive` and `doctor.user.isActive`;
  - check `GlobalBlockedDate` (currently missing);
  - preserve holiday blocking;
  - filter `BlockedSlot` by doctor/date;
  - filter existing bookings by `doctorId` and status `CONFIRMED` (Phase 3 semantics; Phase 4 expands to active holds);
  - return the existing `Slot` shape including `doctorId`, `doctorName`, `startTime`, `endTime`, `service`.
- Update `getAvailableDates(month: number, year: number, doctorId: string)`:
  - same filters;
  - check `GlobalBlockedDate` for the month;
  - preserve UTC date handling (`parseDateUTC`, `formatDateUTC`);
  - exclude past dates consistently with slot results.
- Keep `timeToMinutes`, `parseDateUTC`, `formatDateUTC`, `formatDateISO`, `parseISODate`, `formatBookingDateLabel`.
- Move `serviceFor()` (currently in `admin-availability.ts`) into `availability.ts` or a small shared helper; service should be the doctor's first specialization or the existing default.
- Stop using `getAdminAvailableSlots`/`getAdminAvailableDates` for patient booking. After all callers move, either:
  - remove `server/utils/admin-availability.ts`, or
  - keep it only as a thin compatibility wrapper clearly marked deprecated and unused.
- Do not leave two competing implementations exporting the same names.

**Tests:**

- doctor A's availability does not produce slots for doctor B.
- inactive doctor/user produces no slots.
- `BlockedSlot` removes only that doctor/time.
- `GlobalBlockedDate` removes all doctors' slots on that date for **new** bookings; existing confirmed bookings are not silently cancelled.
- holiday removes all slots.
- existing `CONFIRMED` booking removes only that doctor/time.
- doctor-specific date list excludes dates with no slot.
- 30/45/60-minute durations remain correct.
- today/past rules remain correct.
- timezone regression tests continue to use `@db.Date` UTC helpers.

### Task 2: Backfill and onboarding

**Files:**
- Add a Prisma migration under `prisma/migrations/<timestamp>_doctor_availability_backfill/migration.sql` (proposed; do not author in planning).
- Modify: `modules/admin/server/api/admin/doctors/index.post.ts`
- Modify: `prisma/seed.ts` only if seed behavior needs a default-clinic note.
- Tests: `tests/api/admin/doctors-crud.test.ts` and a new backfill verification test if practical.

Backfill design:

- For every active `DOCTOR` user with a `Doctor` profile and no `Availability` rows, insert one row per active `AdminSchedule` day.
- Use `NOT EXISTS` to remain idempotent.
- Use PostgreSQL 16 `gen_random_uuid()::text` for the `id` if SQL must generate it; verify the resulting string is acceptable to Prisma (String id).
- Preserve existing custom availability rows.
- Do not delete or modify `AdminSchedule`.
- Document how to verify counts before/after: number of active doctors with zero availability must become zero.

Onboarding design:

- In `doctors/index.post.ts`, after creating User+Doctor, clone all active `AdminSchedule` rows into `Availability` in the same transaction (or a nested create).
- If no active `AdminSchedule` exists, create the doctor without availability, return a warning field/log, and do not block doctor creation. Admin configures availability explicitly.
- `AdminSchedule` edits do not update existing doctors. Existing custom availability is never overwritten.
- Ensure the welcome email and response behavior are unchanged.
- Add an API test that creating a doctor via the admin endpoint creates 7 availability rows when 7 active default days exist, and that editing the default schedule does not modify existing rows.

Acceptance:

- Existing active doctors with no custom schedule can be booked using the cloned default.
- Existing doctors with custom availability keep it exactly.
- New doctors are immediately bookable using the default schedule.
- Backfill is additive and rerunnable safely.

### Task 3: Change booking availability endpoints to doctor-specific

**Files:**
- Modify: `modules/booking/server/api/booking/available-dates.get.ts`
- Modify: `modules/booking/server/api/booking/available-slots.get.ts`
- Modify: `server/utils/validation.ts`
- Modify: `tests/api/booking/available-dates.get.test.ts`
- Modify: `tests/api/booking/available-slots.get.test.ts`
- Modify: `tests/api/booking/date-handling.test.ts`

Changes:

- Add `doctorAvailabilityQuerySchema = z.object({ month, year, doctorId: z.string().min(1) })`.
- Extend `availableSlotsQuerySchema` with `doctorId: z.string().min(1)`.
- Both handlers must:
  - validate `doctorId`;
  - resolve an active doctor (`Doctor.isActive`, `User.isActive`);
  - return `404` or `400` for unknown/inactive doctor;
  - call the doctor-aware availability function.
- Response shapes can stay `{ dates }` and `{ slots }`, but each slot must correspond to the requested doctor.

Acceptance:

- Omitting `doctorId` returns 400.
- Inactive/unknown doctor returns 404 (or the agreed documented error).
- Two doctors with different schedules return different dates/slots.
- Global blocked dates apply to both.
- Doctor-specific blocked slots apply only to one.

### Task 4: Require and persist a doctor in booking creation

**Files:**
- Modify: `modules/booking/server/api/booking/create.post.ts`
- Modify: `server/utils/validation.ts`
- Modify: `tests/api/booking/create.post.test.ts`
- Modify: `tests/api/booking/helpers.ts`

Changes:

- `createBookingSchema` adds `doctorId: z.string().min(1)`.
- Handler:
  - requires PATIENT;
  - validates `doctorId`;
  - looks up active `Doctor` including `User.isActive` and `Doctor.isActive`; reject invalid/inactive;
  - calls `getAvailableSlots(date, doctorId)`;
  - finds the exact `startTime`;
  - computes duration/price from the doctor's slot/session configuration (not `AdminSchedule` directly);
  - creates `Booking` with `doctorId` set, status `PENDING` (Phase 3 transitional), session type default `ONLINE`;
  - for ONLINE, creates `Payment{PENDING}`;
  - for IN_CLINIC, creates no Payment and returns amount 0;
  - returns `sessionType` in the response for client branching.
- Preserve the existing service text/price/currency contract where possible.
- Do not add an approval/assignment step in this handler.
- Keep Phase 4's hold/transaction work out of this phase; add a comment/TODO only if the team tracks it. Do not claim race safety yet.

Acceptance:

- Missing doctorId → 400.
- Inactive/unknown doctor → 400/404 consistently.
- Doctor B's slot cannot be booked with Doctor A's ID.
- Created booking always has `doctorId` and the correct doctor-specific duration/end time.
- `IN_CLINIC` creates no payment.
- Online creates pending payment.
- Existing patient ownership remains.

### Task 5: Add public active-doctors endpoint

**Files:**
- Add: `server/api/public/doctors.get.ts`
- Add: `tests/api/public/doctors.get.test.ts` (new)
- Modify: `lib/api.ts` only if a shared client helper is useful.

Response shape (safe public fields only):

```ts
{
  doctors: [{
    id: string;          // Doctor.id
    name: string;        // User.name
    photo: string | null;
    slug: string;
    bio: string | null;
    specializations: string[];
  }]
}
```

Rules:

- Only `Doctor.isActive = true` and `User.isActive = true`.
- Never expose email, phone, permissions, or password fields.
- Sort by name or a deterministic order.
- No pagination needed for the current doctor count; add `limit` only if UI needs it.
- Cache headers optional; do not cache sensitive data.

Acceptance:

- Inactive doctors excluded.
- No private fields.
- Endpoint works unauthenticated.

### Task 6: Redesign `/book` around doctor selection

**Files:**
- Modify: `modules/booking/pages/book.vue`
- Modify: `modules/booking/composables/useBooking.ts`
- Modify: `modules/booking/composables/types.ts`
- Modify: `modules/booking/pages/booking/success.vue`
- Modify: `modules/booking/pages/booking/failed.vue` (copy/doctor display only)
- Modify: `lib/site.ts` if query links need centralization.
- Tests: `tests/e2e/booking.spec.ts`.

State/logic changes:

- `useBooking` adds:
  - `doctors: Ref<PublicDoctor[]>`
  - `selectedDoctorId: Ref<string | null>`
  - `selectedDoctor` computed
  - `bookingSessionType: Ref<'ONLINE' | 'IN_CLINIC'>`
  - `fetchDoctors()`
  - `setDoctor(id)`
  - `setSessionType(type)`
- `fetchAvailableDates(month, year, doctorId)` and `fetchAvailableSlots(date, doctorId)` pass the query parameter.
- `createAndPay`:
  - builds body `{ doctorId, date, startTime, sessionType }`;
  - if `IN_CLINIC`: do not call `/api/payment/initiate`; set success state and navigate to `/booking/success?bookingId=...` (Phase 4 will make it confirmed);
  - if `ONLINE`: call payment initiate and redirect only when `paymentUrl` exists;
  - handle Stripe `clientSecret`/missing URL with a clear error (Phase 4 fixes Checkout URL; do not silently claim confirmation).
- `reset` clears doctor/session type appropriately.

UI changes:

- Step 1 includes:
  - active doctor cards/selector (name, specialization, photo);
  - session type toggle (Online / In-clinic);
  - calendar disabled until a doctor is selected;
  - doctor query prefill `?doctorId=...`;
  - mode query prefill `?mode=online|in-person`;
  - date/time query prefill after doctor is selected.
- Step 2 review shows selected doctor, date/time, duration, session type, and price (or “No online payment” for in-clinic).
- Step 3 payment only for online; in-clinic shows a confirmation/redirect state.
- Preserve existing English copy style of `/book` or align with the rest of the patient UI; do not mix new Arabic-only strings unexpectedly.

Acceptance:

- Patient cannot reach a slot list without a doctor.
- Switching doctor clears stale dates/slots/time.
- Booking request always includes the selected doctor.
- In-clinic never opens a payment gateway.
- Online still goes to payment.
- Success/failed pages display the chosen doctor when present.

### Task 7: Homepage doctor selection

**Files:**
- Add: `components/home/HomeExperts.vue` (new)
- Modify: `pages/index.vue`
- Modify: `lib/home-content.ts` (optional nav item)
- Modify: `layouts/default.vue` only if a nav link is added.

Changes:

- Fetch `/api/public/doctors` on the homepage (SSR-friendly `useFetch`/`useAsyncData` or client fetch with loading/empty/error states; follow existing Nuxt patterns).
- Render active doctors as cards with photo, name, specializations, and a Book CTA linking to `/book?doctorId=<id>`.
- If no doctors exist, render a neutral placeholder (no fake names).
- Add the section to the homepage after services/about or before training; preserve visual language.
- Add an optional nav anchor (“الأطباء” → `#experts`) only if it fits existing nav; do not create a dead link.
- Do not hard-code doctor names or specializations.

Acceptance:

- Homepage shows only active doctors from the DB.
- CTA preselects the doctor in `/book`.
- Empty/error state does not break the page.

### Task 8: Consolidate patient booking entry points

**Files:**
- Modify: `pages/dashboard/appointments.vue`
- Modify: `modules/patient/composables/usePatientDashboard.ts`
- Modify: `modules/patient/composables/types.ts` if needed
- Modify: `tests/e2e/patient-dashboard.spec.ts`

Recommended approach:

- Remove the inline booking-flow panel from the dashboard.
- “Book a Session” and date-cell clicks navigate to `/book` (with `?date=...` and optional `?time=...` when a slot was clicked).
- Keep the dashboard calendar showing the patient's own appointments and statuses.
- Remove doctor-agnostic available-time dots/slots from the dashboard or replace them with a “Choose a doctor to see times” CTA.
- Remove unused booking-flow state/functions from `usePatientDashboard` (`bookingFlow*`, `openBookingFlow`, `submitBookingFlow`, `retryBookingPayment`, etc.) after confirming no other page imports them.
- Keep profile, payments, cancellation, and reschedule behavior intact, except the doctor-aware reschedule changes in Task 9.
- The reschedule UI must use the new same-doctor cross-date endpoint (Task 9); do not fall back silently to the old same-day patch.

Rationale: maintaiing two booking UIs would require duplicating doctor selection, per-doctor availability, session-type branching, and payment handling. `/book` already exists and is the natural single entry point.

Acceptance:

- Dashboard “Book a Session” opens `/book` with the selected date preserved.
- Dashboard no longer offers a second, divergent booking flow.
- Patient appointments calendar remains functional.
- No stale `bookingFlow` state remains in the composable or page.

### Task 9: Implement same-doctor cross-date rescheduling (B3 owner approved)

**Files:**
- Add: `modules/patient/server/api/patient/appointments/[bookingId]/reschedule.patch.ts` (or the route path matching the existing UI call)
- Add: `modules/admin/server/api/admin/bookings/[id]/reschedule.patch.ts` (admin exception)
- Modify: `modules/booking/server/api/booking/[id].patch.ts` (shared validation or compatibility alias)
- Modify: `modules/patient/composables/usePatientDashboard.ts` (reschedule call)
- Modify: `pages/dashboard/appointments.vue` (patient reschedule UI)
- Modify: `pages/admin/appointments.vue` (admin reschedule control)
- Tests: `tests/api/booking/[id].patch.test.ts`, new patient/admin reschedule tests

Policy:

- **Patient:** own `CONFIRMED` booking only; at least 24 hours before the **original `startTime`**; same doctor; same session type; target date/time may be on any future date; no payment change; new confirmation/reschedule notification to patient and doctor.
- **Admin:** any non-cancelled confirmed booking; `APPOINTMENTS:UPDATE`; same doctor; target must be available; no 24-hour limit but not after the session has started; no doctor change; notification.
- **Doctor:** no reschedule endpoint/UI.
- **No doctor change:** moving to another doctor is not allowed; cancel + rebook under A5.
- **PENDING/unpaid** bookings are not reschedulable; finish payment or cancel.
- **Payment:** paid online stays `Payment=SUCCESS`/`Booking=CONFIRMED`; in-clinic stays confirmed with no payment.
- **Original slot:** released atomically after a successful move.
- **Validation:** target must satisfy doctor availability, BlockedSlot, GlobalBlockedDate, holiday, active hold/confirmed occupancy, and session type.
- **Concurrency:** lock the booking row and the target doctor/date/time slot; revalidate inside the lock; conditional update; second attempt gets 409.
- **Failure:** no partial update; original booking/slot/payment remain unchanged.
- **24h enforcement:** server-side against the original appointment start, not client-side only.
- **Endpoint behavior:** implement the missing endpoint the UI already calls; do not silently fall back to same-day when a cross-date request fails.
- **Audit:** log actor, booking, original slot, target slot, timestamp for admin reschedules; patient events are logged with the same shape.

Acceptance:

- Patient cannot reschedule someone else's booking.
- Patient cannot reschedule within 24h of the original start.
- Patient cannot reschedule a PENDING/CANCELLED booking.
- Cross-date move to the same doctor's free slot succeeds.
- Another doctor's free slot is rejected.
- Original slot is released; target is reserved.
- Two simultaneous attempts to the same target produce one success and one 409.
- Payment/status remains unchanged.
- Admin reschedules with permission; doctor cannot.
- Notifications sent once.
- Failure leaves the original booking intact.

**Owner approval:** B3 must be approved before this task is implemented/released.

### Task 10: Admin/doctor calendars and manual assignment transition

**Files:**
- Modify: `pages/admin/appointments.vue`
- Modify: `modules/admin/composables/useAdminDashboard.ts`
- Modify: `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts`
- Modify: `modules/admin/server/api/admin/bookings/pending.get.ts`
- Modify: `modules/doctor/pages/doctor/calendar.vue` only if display fields change
- Tests: `tests/api/admin/bookings-manage.test.ts`

Changes:

- Admin calendar already lists all bookings; verify `doctorName` and status display for new doctor-linked rows.
- Doctor calendar already filters by doctor; Phase 2 changes it to `CONFIRMED`/`CANCELLED` only. Do not show unpaid pending holds.
- Transitional assignment:
  - A new booking already carries a doctor but remains `PENDING` until Phase 4. During Phase 3 staging, admin may confirm **the same selected doctor** (no dropdown change).
  - If `booking.doctorId` is set, the endpoint must reject a different doctor; there is no reassignment.
  - If `booking.doctorId` is null (legacy), keep the existing assignment behavior only for legacy rows. No automatic assignment.
- Do not remove the legacy assign API yet; Phase 4 will hide/restrict the normal queue.
- Update admin pending list label/copy to distinguish “legacy unassigned” from “new doctor-selected pending pending payment” if the UI shows both.

Acceptance:

- New booking appears in admin calendar with the chosen doctor.
- New booking appears in the chosen doctor's calendar after confirmation; unpaid PENDING is not shown to the doctor.
- Admin cannot change a new booking to another doctor.
- No confirmed-booking reassignment endpoint/UI exists.
- Legacy unassigned rows remain resolvable by explicit admin action.

## 6. Expected Database Changes

### Schema

- Add indexes on `Booking`:
  - `@@index([doctorId, date, status])`
  - `@@index([date, status])`
- No required-field change to `Booking.doctorId` in this phase.
- No change to `Availability`/`BlockedSlot`/`AdminSchedule` columns.
- No blog changes in this phase.

### Data migration

- One-time backfill of `Availability` for active doctors with zero rows.
- New doctor onboarding copy.
- No deletion.
- Verify counts in staging; take a snapshot before apply.
- Rollback: leave additive availability rows; they are valid. If the app rolls back to global availability, extra doctor rows are ignored by the old code.

## 7. Expected API Changes

See `01-architecture-and-data-impact.md` §5.1–5.2. The key breaking change is that `available-dates`, `available-slots`, and `create` now require `doctorId`.

## 8. UI/UX Considerations

- Doctor selection must be obvious and accessible from the homepage and `/book`.
- Disable the calendar until a doctor is chosen; show a clear empty state.
- Order: doctor → session type → date → time → review. Do not let the patient pick a time that is then invalidated by a doctor switch.
- Show doctor photo/name/specialization in the review and success screens.
- Explain in-clinic “no online payment” clearly; do not show a payment button.
- Preserve loading/empty/error states and RTL if the page is Arabic; `/book` currently uses English copy, so follow the existing page language unless a broader localization task is approved.
- On mobile, doctor cards must be scrollable/selectable without overlapping the calendar.

## 9. Acceptance Criteria

1. Patient chooses a doctor before seeing times.
2. Times are generated only from that doctor's effective availability and block rules.
3. Booking is created with the selected doctor and correct duration/end time.
4. In-clinic creates no payment.
5. Online creates a pending payment.
6. Booking appears in admin calendar and the selected doctor's calendar after confirmation; unpaid pending is not a doctor appointment.
7. Normal booking no longer depends on global `AdminSchedule` alone.
8. Existing custom doctor availability is preserved; default schedule edits do not rewrite it.
9. New doctors get default availability.
10. Public doctors endpoint returns active doctors only.
11. No doctor can see another doctor's appointments.
12. Patient reschedule is cross-date, same doctor, >=24h before original start; admin confirmed reschedule allowed; doctor none; payment unchanged; concurrent conflict prevented (B3 owner approved).
13. No confirmed-booking reassignment; legacy-only assignment.
14. Phase 3's transitional pending/approval behavior is documented and removed by Phase 4 in the same release.

## 10. Required Tests

### Unit

- `tests/utils/availability.test.ts`: doctor filter, global blocked dates, holidays, blocked slots, confirmed bookings, dates list, timezone.
- New unit tests for default-schedule cloning if extracted into a helper.

### API

- `tests/api/booking/available-dates.get.test.ts`: requires doctorId, per-doctor differences, invalid/inactive doctor.
- `tests/api/booking/available-slots.get.test.ts`: same.
- `tests/api/booking/create.post.test.ts`: requires doctorId, persists doctor, rejects wrong doctor slot, in-clinic no payment, online payment.
- `tests/api/booking/[id].patch.test.ts` + new patient/admin reschedule tests: cross-date same-doctor success, cross-doctor rejection, 24h enforcement, PENDING/cancelled rejection, target conflict/409, payment unchanged, original slot released, admin permission, doctor denial.
- `tests/api/admin/doctors-crud.test.ts`: new doctor receives default availability; schedule edit does not rewrite existing availability.
- `tests/api/admin/bookings-manage.test.ts`: legacy-only assignment; no confirmed reassignment; same-doctor confirm only.
- New `tests/api/public/doctors.get.test.ts`: active only, no private fields.
- Backfill migration verification (count query) in staging or a dedicated test harness.

### E2E

- `tests/e2e/booking.spec.ts`: select doctor, assert slot list, pay/mock, assert DB `doctorId` equals selected doctor, assert the booking appears in doctor/admin calendars.
- `tests/e2e/patient-dashboard.spec.ts`: Book a Session routes to `/book`; dashboard no longer exposes a duplicate flow; reschedule behavior is deliberate.
- Doctor login: new booking appears only for the selected doctor.

## 11. Risks and Dependencies

- **Highest risk:** switching the availability source can make all doctors unbookable if backfill/onboarding is incomplete. Verify counts and expose an admin empty-state warning.
- **Data risk:** existing `PENDING` unassigned bookings remain. Do not make `doctorId` required at DB level.
- **Logic risk:** `GlobalBlockedDate` missing from `server/utils/availability.ts` must be fixed before switching sources.
- **UX risk:** consolidating the dashboard booking flow into `/book` changes navigation; communicate it and update E2E.
- **Policy risk:** cross-date reschedule is owner-approved (B3); implementation verification is still required before release.
- **Dependency:** Phase 4 owns payment confirmation, holds, and race control.
- **Rollback:** additive availability rows are safe; application rollback can return to global availability if needed. Indexes can be dropped but are harmless.

## 12. Definition of Done

- All new bookings require and persist a doctor.
- Doctor-specific slots are the only patient-facing source; AdminSchedule is default-only and does not propagate.
- Backfill and onboarding are verified in staging.
- Homepage and `/book` support doctor selection.
- Admin/doctor calendars display the relationship; doctor sees only confirmed/cancelled.
- Cross-date same-doctor reschedule works with 24h/ownership/concurrency rules (B3 approval recorded).
- No confirmed reassignment; legacy-only remediation remains.
- Transitional pending/approval semantics are documented and scheduled for Phase 4 removal.
- Tests updated in the same change; no phase completion claim until approved verification runs.
