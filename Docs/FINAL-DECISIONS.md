# Tawasul Academy — Final Architecture & Business Decisions

**Status:** Decision resolution only. No application code, schema, migration, environment file, build, test, container, browser, database, or Git command was changed or executed.  
**Scope:** resolves every open decision in the implementation roadmap (Phases 1–6) using the verified current system analysis and the actual codebase.  
**Registration:** unchanged. Email verification is not introduced or planned.  
**Constraint:** decisions preserve historical booking/payment records and existing working functionality wherever possible.

## Decision Summary

| ID | Decision | Status | Owner approval |
|---|---|---|---|
| A1 | Online payment hold = 20 minutes, configurable | **DECIDED — OWNER APPROVED** | Yes |
| A2 | Expiry releases the slot; booking remains PENDING until safe resolution; no automatic cancellation of paid bookings | **DECIDED** | No |
| A3 | Late success confirms only if the original slot is still free; otherwise payment stays SUCCESS and the booking is cancelled for manual refund | **DECIDED — OWNER APPROVED** | Yes |
| A4 | Legacy unassigned bookings remain read-only/resolvable by admins; no automatic changes or deletion | **DECIDED** | No |
| A5 | New bookings require a doctor; DB stays nullable for history; no confirmed-booking reassignment | **DECIDED** | No |
| B1 | Doctor Availability is the patient-facing source; AdminSchedule is the default template; global closures and holidays apply to all | **DECIDED** | No |
| B2 | AdminSchedule edits affect only new/backfilled doctors; existing custom schedules are never overwritten | **DECIDED** | No |
| B3 | Patients reschedule own confirmed bookings up to 24h before start, same doctor, any date; admins any confirmed booking; doctors cannot; no doctor change | **DECIDED — OWNER APPROVED** | Yes |
| C1 | Calendar + own booking detail + own session notes + session access; remove Patients/Profile/peer notes | **DECIDED — OWNER APPROVED** | Yes |
| C2 | Strict ownership rules for bookings, patient info, notes, session join, and LiveKit admit | **DECIDED** | No |
| D1 | First publish sets `publishedAt`; later edits/unpublish/republish preserve it | **DECIDED** | No |
| D2 | Unicode-aware generated slugs with unique suffixes; published slugs immutable | **DECIDED** | No |
| D3 | Public access only for PUBLISHED; SSR/server filtering; no shared cache in first release; unpublished/deleted = 404 | **DECIDED** | No |

**Totals:** 13 decisions reviewed; 13 DECIDED — OWNER APPROVED; 0 BLOCKED.

> **Approval status:** A1, A3, B3, and C1 have been **approved by the business owner**. The roadmap and phase documents may now treat them as final decisions. This does not change the requirement to verify each implementation phase before release.

---

## A. Booking & Payment

## A1 — Payment Hold Duration

**Status: DECIDED — OWNER APPROVED.**

### Final decision

Use **20 minutes** as the default online payment hold. Store it as `BOOKING_HOLD_MINUTES` in runtime configuration, with a safe allowed range of **5–60 minutes**. Changing the value affects only new bookings; existing bookings keep the `holdExpiresAt` written at creation.

### Business reasoning

- 20 minutes is enough for a card/Paymob redirect, OTP, retry, and slow mobile connections without holding a doctor's slot for an hour.
- The current Paymob payment-key expiration is 3600 seconds, which is far too long for a clinic slot and must not dictate the booking hold.
- Shorter than 15 minutes risks avoidable expiry and support burden; longer than 30 minutes reduces doctor utilization and blocks other patients.
- The value is business policy, not a code constant.

### Technical reasoning

- `Booking.holdExpiresAt` is set at online booking creation.
- Availability treats the slot as held only while the hold is active (plus confirmed bookings).
- The value must be read from runtime config, validated server-side, and never trusted from the client.
- Changing the environment value requires a container restart; it must not retroactively rewrite existing holds.

### Impact

- **Database:** `Booking.holdExpiresAt` (Phase 4); no per-booking duration field.
- **API:** create sets the hold; initiate rejects after expiry; booking detail can expose `holdExpiresAt` and a derived expired flag.
- **Frontend:** show the remaining hold/payment window on `/book` and failed-payment state.
- **Existing data:** no change.

### Security implications

- The client must not extend a hold or submit its own duration.
- Payment success must still be verified by webhook/signature, independent of hold time.
- A short hold must not create a path to confirm without payment.

### Acceptance criteria

1. An online booking gets `holdExpiresAt = createdAt + 20 minutes` by default.
2. The value can be changed via configuration without code changes and is bounded to 5–60 minutes.
3. Availability stops counting the hold at `holdExpiresAt`.
4. Existing holds are not retroactively changed when the configuration changes.
5. The UI never claims the slot is held after expiry.
6. Tests cover default, min/max, and configuration override.

**Owner approval:** recorded — the 20-minute business policy is approved.

---

## A2 — Expired Payment Hold

**Status: DECIDED.**

### Final decision

When an online hold expires:

1. The slot is immediately available again for new bookings.
2. The booking is **not automatically cancelled** by a blind timer. It remains `PENDING` but is treated as an expired payment attempt; its status is never silently changed to `CONFIRMED` by expiry. A verified late success follows A3's explicit branch (confirm only if the slot is free; otherwise reconcile).
3. **No automatic cleanup job or timer is part of Phases 1–6.** The expired `PENDING` row stays in the database and is visible to administrators through a reconciliation query/filter. It is not an active appointment and does not appear to doctors as a confirmed session.
4. If an administrator later cancels an expired unpaid row, that action must be explicit and transactional and must **exclude any booking whose Payment is `SUCCESS`** and exclude `CONFIRMED`/`CANCELLED` records.
5. Expiry must never cancel, refund, or downgrade a successfully paid booking.

### Business reasoning

- Patients who abandon checkout should not block a doctor indefinitely.
- A successful payment must never be destroyed because a timer fired a second before the webhook.
- Automatic cancellation of paid/legacy records is a data-loss risk and violates the requirement to preserve historical records.

### Technical reasoning

- Availability predicate: slot is occupied by `CONFIRMED` or by `PENDING` with an active `holdExpiresAt`.
- Expired `PENDING` rows are excluded from availability and from doctor-facing appointments.
- There is no automatic cleanup implementation in Phases 1–6. If an authorized admin cleanup is later added, it must use a transaction/row lock and a condition such as:
  `status = 'PENDING' AND holdExpiresAt <= now AND NOT EXISTS (payment.status = 'SUCCESS')`.
- The current code has no hold field and no cleanup; this is new Phase 4 behavior.
- Do not introduce a new `EXPIRED` status in this release; a derived flag (`holdExpired`) is simpler and avoids enum/API churn.

### Impact

- **Database:** `holdExpiresAt`; no status enum change.
- **API:** availability ignores expired holds; admin list can expose `holdExpired`; patient booking detail can show “payment window expired.”
- **Frontend:** expired attempt messaging; no false confirmation.
- **Existing data:** legacy `PENDING` rows with `holdExpiresAt = NULL` remain blocking/admin-visible until explicit resolution (A4 covers unassigned rows; no automatic status change).

### Security implications

- No client can mark a booking paid or extend a hold.
- A cleanup must be server-side and must not be callable by patients.
- Paid bookings are always excluded from expiry cleanup.

### Acceptance criteria

1. At `holdExpiresAt`, the slot is offered to other patients.
2. An expired unpaid booking is not confirmed and does not appear as an active doctor appointment.
3. A booking with `Payment.SUCCESS` is never auto-cancelled or auto-refunded by expiry.
4. No automatic cleanup/timer changes status; any admin cancellation excludes `Payment.SUCCESS` and `CONFIRMED`/`CANCELLED`.
5. Admin can identify expired pending bookings.
6. Tests cover expired unpaid, legacy null hold, paid row protection, and admin cleanup guard.

**Owner approval required:** no — this is the safety implementation of the approved requirement.

---

## A3 — Late Successful Payment

**Status: DECIDED — OWNER APPROVED.**

### Final decision

When a verified success webhook arrives after `holdExpiresAt`:

1. Lock the booking row and re-read its current state.
2. If the booking is already `CONFIRMED` and payment is `SUCCESS`, return idempotently; do nothing.
3. If the booking is `PENDING` and the **original doctor/date/time slot is still free** (no other confirmed booking and no other active hold), confirm it atomically and send the confirmation emails.
4. If the original slot is already occupied by another booking/hold, **do not double-book**. Keep `Payment = SUCCESS`, set the booking to `CANCELLED` as an explicit late-payment reconciliation state, and flag it for manual refund/rebooking. This is not an expiry auto-cancel.
5. If the booking was already `CANCELLED` by the patient/admin, do not re-confirm. Keep `Payment = SUCCESS` and require manual reconciliation/refund.
6. Never create a second booking automatically and never move the patient to a different time/doctor without their consent.
7. Reconciliation must be visible in the admin payments/legacy view; no gateway refund API is added in this release. The operator refunds through the provider dashboard and updates the payment to `REFUNDED` only after the refund is actually completed.

### Business reasoning

- A patient who paid should not be punished for a webhook delay if their slot is still free.
- Double-booking is worse than a refund; the clinic cannot have two patients in one slot.
- Manual refund is consistent with the existing MVP, which has no automated refund API.

### Technical reasoning

- The success handler must run in a transaction and recheck the slot under the same serialization discipline used for creation.
- `Payment` has a 1:1 unique relation to `Booking`; no duplicate payment record is created.
- If the slot is taken, the booking remains a historical cancelled row with a successful payment; this is a reconciliation state, not a confirmed appointment.
- The existing `handleSuccessfulPayment` always swallows errors and leaves the booking pending; this must change in Phase 4.

### Impact

- **Database:** no additional field strictly required; admin query identifies `Payment.SUCCESS` + `Booking.CANCELLED`/non-confirmed.
- **API:** webhook state machine; admin booking/payment views show the reconciliation state.
- **Frontend:** no patient-facing “confirmed” unless the transition succeeds; success page polls and shows manual-review wording if needed.
- **Existing data:** paid-but-unconfirmed legacy bookings are surfaced, not auto-modified.

### Security implications

- Signature verification remains mandatory.
- The slot recheck must be server-side and transactional.
- Do not let a late webhook overwrite another patient's confirmed booking.
- Refund status is updated only by authorized staff/operations.

### Acceptance criteria

1. Late success + free slot → exactly one confirmation and one set of emails.
2. Late success + occupied slot → no double booking; payment remains SUCCESS; booking is cancelled/flagged for refund.
3. Late success + already cancelled booking → no confirmation; refund required.
4. Duplicate late webhooks are idempotent.
5. Admin can find every paid-but-not-confirmed booking.
6. Tests cover all four branches and concurrent creation.

**Owner approval:** recorded — the refund/manual-reconciliation policy is approved.

---

## A4 — Legacy Bookings

**Status: DECIDED.**

### Final decision

- Existing `Booking.doctorId = NULL` records remain in the database unchanged.
- No automatic doctor assignment is performed.
- No automatic deletion, cancellation, status rewrite, payment rewrite, or migration of historical rows is allowed.
- Administrators retain read access through the existing admin booking list/detail surfaces.
- Legacy unassigned `PENDING` bookings may be manually resolved by an authorized administrator using the existing legacy assignment flow or cancellation flow, with explicit human action.
- Legacy paid-but-unconfirmed records are surfaced in a reconciliation view/query.
- Once all legacy rows are resolved, the legacy assignment endpoint may be retired in a later cleanup; it is not part of the normal booking UI.

### Business reasoning

- Historical bookings and payments are business and financial records.
- Automatically assigning a doctor can create false appointments and patient/doctor notifications.
- Admins need visibility to resolve real customer issues.
- The roadmap must not silently rewrite data.

### Technical reasoning

- The database column remains nullable for historical compatibility.
- New API validation enforces non-null `doctorId`.
- The existing `assign` endpoint only supports `PENDING`; it can be constrained to `doctorId = NULL` for legacy use.
- No migration backfills doctors into historical bookings.
- `GET /api/admin/bookings` already returns all records and can support a legacy filter.

### Impact

- **Database:** no change to historical rows; `doctorId` remains nullable.
- **API:** new create rejects null doctor; legacy assign/resolve endpoint remains for unassigned rows only.
- **Frontend:** admin legacy queue/filter; patient sees historical records as currently stored.
- **Existing data:** preserved exactly.

### Security implications

- Only staff with `APPOINTMENTS` permissions can resolve legacy rows.
- No patient can assign/change a doctor.
- Audit/reporting should identify who resolved a legacy booking (if an audit log is added; otherwise operationally documented).

### Acceptance criteria

1. A database query finds legacy unassigned rows without modifying them.
2. Admin can view legacy rows and their payment status.
3. No automatic job changes `doctorId` or status.
4. New bookings cannot be created without a doctor.
5. Legacy assignment rejects already-assigned bookings.
6. Existing payment/booking values are unchanged by deployment.

**Owner approval required:** no — preservation is mandated by the requirements.

---

## A5 — Doctor Assignment

**Status: DECIDED.**

### Final decision

- **All newly created bookings require a valid active `doctorId`.**
- **The database field remains nullable** for historical compatibility and A4.
- **Normal patient booking never requires admin assignment.**
- **Confirmed-booking reassignment is not supported in this roadmap.**
  - If an admin needs to change the doctor after confirmation, the supported recovery is: cancel the existing booking under the approved cancellation/refund policy, then ask the patient to rebook the desired doctor.
  - This avoids an unaudited doctor swap and avoids silently changing the patient's care provider.
- Legacy unassigned bookings (A4) may be assigned by an admin as a one-time historical remediation, not as a normal workflow.
- A future, separately approved release may add audited reassignment; it is not part of Phases 1–6.

### Business reasoning

- The approved requirement explicitly removes manual assignment from the normal flow.
- Doctor identity is part of the patient's care decision; changing it without explicit consent is a trust and safety issue.
- Cancellation/rebooking is transparent and preserves the payment/refund audit trail.
- Avoiding reassignment eliminates the need for a new audit table and complex notification logic in this release.

### Technical reasoning

- `createBookingSchema` requires `doctorId`; the server resolves an active doctor.
- The database remains nullable to preserve A4.
- Legacy `assign` remains restricted to `doctorId = NULL` and `PENDING`.
- No reassign endpoint/UI is added.
- Admin cancel already refunds only successful payments in the target design (current admin code is correct; patient cancel is fixed in Phase 4).

### Impact

- **Database:** no required-column migration; nullable remains.
- **API:** create requires doctor; assign restricted to legacy null.
- **Frontend:** no reassignment control; admin cancel is the recovery path.
- **Existing data:** preserved.

### Security implications

- No client-supplied doctor can bypass active-doctor validation.
- No admin API can swap a doctor on a confirmed booking.
- Legacy assignment is permission-gated and audited operationally.

### Acceptance criteria

1. New create without doctor → 400.
2. New create with inactive/unknown doctor → rejected.
3. `Booking.doctorId` is always populated for new rows.
4. No endpoint allows changing a confirmed booking's doctor.
5. Legacy unassigned rows can be resolved by an authorized admin.
6. Admin cancellation/refund path remains available and permissioned.
7. Tests prove the absence of reassignment.

**Owner approval required:** no — follows the approved requirement; the no-reassignment operational limitation is documented.

---

## B. Availability & Rescheduling

## B1 — Availability Source of Truth

**Status: DECIDED.**

### Final decision

| Rule source | Applies to | Authority |
|---|---|---|
| `AdminSchedule` | Default weekly clinic template for new/backfilled doctors | Template only; not read directly for patient slots after Phase 3 |
| `Doctor.Availability` | That doctor's weekly working hours/session duration | **Authoritative per-doctor schedule** |
| `Doctor.BlockedSlot` | That doctor's date/time exceptions | Doctor-specific exception |
| `GlobalBlockedDate` | All doctors | Clinic-wide closure |
| `holidays.ts` | All doctors | Clinic-wide holiday closure |
| Existing active bookings/holds | Doctor + date/time | Occupancy |

Exact availability rule for a requested doctor/date/time:

1. The doctor and user must be active.
2. The date must not be a public holiday.
3. The date must not be in `GlobalBlockedDate`.
4. The date/day must have an `Availability` row for that doctor.
5. The slot must fit within that row's start/end and session duration.
6. The slot must not overlap a `BlockedSlot` for that doctor/date.
7. The slot must not overlap an active occupancy (confirmed booking or active hold) for that doctor/date.
8. Past/today rules apply consistently.

Additional rules:

- `GlobalBlockedDate` blocks **new** bookings. It does not silently cancel existing confirmed bookings; an admin must handle affected bookings explicitly (cancel/refund/notify). This preserves financial history.
- `BlockedSlot` creation must reject a doctor-specific slot already occupied by a confirmed booking or active hold.
- `AdminSchedule` remains editable as the clinic default; it is not the patient-facing source after cutover.
- Existing doctors with no availability are backfilled from active `AdminSchedule`; existing custom availability is never overwritten.

### Business reasoning

- Patients must book a specific doctor; a shared slot list cannot represent different schedules.
- Global closures and holidays must apply to every doctor.
- Doctor-specific blocks must not affect other doctors.
- Existing custom doctor schedules are valuable and must not be lost.

### Technical reasoning

- `server/utils/availability.ts` already has doctor-aware logic but must be extended to subtract `GlobalBlockedDate` and active holds.
- `AdminSchedule` is unique per day; cloning to `Availability` is straightforward.
- `Availability` is unique per doctor/day; no schema change needed.
- Existing `BlockedSlot` model supports per-doctor exceptions.
- `GlobalBlockedDate` is a unique date.

### Impact

- **Database:** no new columns; additive availability backfill.
- **API:** available dates/slots require `doctorId`; create revalidates doctor-specific availability.
- **Frontend:** patient chooses doctor; admin schedule is labeled default.
- **Existing data:** custom doctor availability preserved; AdminSchedule preserved.

### Security implications

- Doctor availability is public data only in aggregate; no private patient data is exposed.
- A patient cannot request slots for an inactive doctor.
- Blocked-date changes require admin permission.

### Acceptance criteria

1. Doctor A and Doctor B can have different slots.
2. A global blocked date removes all slots.
3. A holiday removes all slots.
4. A doctor block removes only that doctor's slots.
5. A confirmed booking removes only that doctor's slot.
6. An active hold removes only that doctor's slot.
7. Existing confirmed bookings are not silently cancelled by a global block.
8. Tests cover each rule.

**Owner approval required:** no — follows the approved booking design.

---

## B2 — AdminSchedule Changes

**Status: DECIDED.**

### Final decision

Choose **“default for new/backfilled doctors only.”**

- Editing `AdminSchedule` does **not** automatically update existing doctors.
- Existing `Doctor.Availability` rows are never overwritten by a schedule edit.
- New doctors receive a copy of the active default schedule at creation.
- Doctors backfilled during the Phase 3 migration receive a one-time copy.
- If the clinic wants to apply a new default to existing doctors, that must be an explicit, separately confirmed admin action with a preview and conflict review. It is not part of this roadmap.
- The admin UI must label the schedule as “Default schedule for new/backfilled doctors.”

### Business reasoning

- Doctors may have individualized hours, session lengths, and part-time schedules.
- A global edit silently changing every doctor could create unauthorized appointments or destroy configured availability.
- New doctors still need a usable default to avoid an empty calendar.

### Technical reasoning

- No automatic propagation hook.
- New doctor creation clones active `AdminSchedule` rows in the same transaction.
- Existing doctors keep their rows.
- A future bulk-apply feature is separate and must show a diff before applying.

### Impact

- **Database:** no change.
- **API:** doctor creation copies defaults; admin schedule edit only changes template.
- **Frontend:** admin copy explains the default semantics.
- **Existing data:** protected.

### Security implications

- An admin cannot accidentally overwrite all doctor schedules.
- Bulk changes require a future explicit permissioned action.

### Acceptance criteria

1. Editing the default schedule leaves existing doctor availability unchanged.
2. A newly created doctor gets the current active default days.
3. The admin UI communicates the default-only behavior.
4. Tests verify existing custom availability is untouched.
5. No hidden propagation occurs.

**Owner approval required:** no — follows the roadmap's default-template design.

---

## B3 — Rescheduling

**Status: DECIDED — OWNER APPROVED.**

### Final decision

| Actor | Allowed? | Rules |
|---|---|---|
| Patient | Yes | Own `CONFIRMED` booking only; up to 24h before start; same doctor; same session type; any date/time with an available slot; no payment change |
| Admin | Yes | Any non-cancelled confirmed booking; `APPOINTMENTS:UPDATE`; same doctor; target must be available; no 24h limit but not after the session has started; no doctor change |
| Doctor | No | Calendar-only; no reschedule action |
| Move to another doctor | No | Doctor reassignment is not supported in this roadmap (A5) |

Details:

- Patients cannot reschedule unpaid `PENDING` bookings; they must complete payment or cancel and rebook.
- Paid online bookings keep `Payment.SUCCESS` and `Booking.CONFIRMED`; no new charge/refund.
- In-clinic confirmed bookings remain confirmed; no payment.
- The original slot is released atomically when the booking moves.
- Target slot must be validated against the same doctor's availability, block slots, global closures, holidays, and active occupancy.
- Server enforces the 24-hour patient rule; the current missing server check must be added.
- The existing UI expects `/api/patient/appointments/[bookingId]/reschedule`; implement that endpoint rather than relying on the broken fallback.
- Admin reschedule must be an explicit audited operation; if no audit table is added, log actor/time and include it in the response/operations log. The roadmap’s existing event/notification pattern should be used.
- Notify patient and doctor on a successful reschedule (email; in-app notifications are out of scope).
- Simultaneous reschedules:
  - lock the booking row and the target doctor/date/time slot (advisory lock or serializable transaction);
  - revalidate the target under the lock;
  - update the booking atomically;
  - reject the second request with `409` if the target is taken.
- If the original booking changed concurrently (e.g., cancelled), reject with a clear conflict.

### Business reasoning

- Patients need to change appointments; the existing UI already offers it but the cross-date endpoint is missing.
- Keeping the same doctor preserves the care relationship and payment.
- 24 hours matches the existing cancellation policy and protects doctor schedules.
- Admin exception handling is necessary for operational errors/doctor emergencies, but doctor changes should be explicit cancel/rebook.

### Technical reasoning

- Extend the existing booking update semantics; no new payment charge.
- Reuse doctor-specific availability.
- Use the same slot serialization strategy as creation.
- Do not silently fall back from a failed cross-date reschedule to same-day; that hides conflicts.

### Impact

- **Database:** no new field required for same-doctor reschedule.
- **API:** implement missing patient reschedule endpoint; add admin reschedule permission/endpoint or extend existing booking patch with authorization; enforce 24h.
- **Frontend:** date picker becomes functional; remove broken fallback.
- **Existing data:** no changes.

### Security implications

- Ownership: patient can reschedule only own booking.
- Admin permission: `APPOINTMENTS:UPDATE`.
- Doctor: no reschedule.
- Concurrency: target slot lock prevents double booking.
- No doctor swap through reschedule.

### Acceptance criteria

1. Patient cannot reschedule someone else's booking.
2. Patient cannot reschedule within 24h of start (server-enforced).
3. Patient cannot reschedule a `PENDING`/unpaid or `CANCELLED` booking.
4. Target slot must belong to the same doctor and be free.
5. Payment remains SUCCESS/CONFIRMED; no extra charge/refund.
6. Original slot becomes available.
7. Two simultaneous reschedules to one target produce one success and one conflict.
8. Admin can reschedule any confirmed booking with permission.
9. Doctor has no reschedule endpoint.
10. Notifications are sent once.

**Owner approval:** recorded — the 24-hour/cross-date reschedule policy and admin exception behavior are approved.

---

## C. Doctor Dashboard & APIs

## C1 — Doctor Workspace

**Status: DECIDED — OWNER APPROVED.**

### Final decision

| Surface | Decision |
|---|---|
| Calendar | Keep. Month/week/day views; own `CONFIRMED` and `CANCELLED` bookings only; no unpaid `PENDING` holds |
| Booking details | Keep. Own bookings only; patient name + email, service, date/time, status, payment status |
| Session management | Keep. Join/end/admit flow from Phase 1 |
| Doctor notes | Keep **own** notes for own bookings inside the booking-detail drawer; remove peer notes and the patient-directory note timeline |
| Patients directory/detail | Remove from doctor UI and remove `/api/doctor/patients*` from the doctor-facing API surface; data preserved in DB/admin records |
| Profile | Remove doctor self-service page and self-edit APIs; admin manages name/phone/bio/specializations through existing admin doctor management. Doctor photo self-upload is removed; existing photos remain; a future admin photo feature can be added separately |
| Admin functionality | Not exposed to doctors |

Notes implementation rule:

- Add a small own-notes API under the booking context, e.g. `/api/doctor/bookings/:bookingId/notes` (GET/POST/PATCH/DELETE), or equivalent, always deriving the doctor from the session and checking `booking.doctorId`.
- The existing `DoctorNote` model already supports one note per booking/doctor; no schema change is required.
- Do not expose notes authored by other doctors to the doctor.
- Do not expose doctor notes to staff unless a separate explicit policy is approved.
- Existing note rows are preserved even if a doctor is deactivated.

### Business reasoning

- The requirement calls for a focused appointment calendar.
- Private notes for one's own sessions are part of clinical workflow and should not be lost.
- Patient directories and profile administration are not needed for the doctor's appointment workflow.
- Admin management remains the correct place for profile changes.

### Technical reasoning

- The current doctor patient pages are the only UI for notes; removing them without a replacement would silently end note-taking.
- Reusing `DoctorNote` keeps data and avoids a new schema.
- The current peer-note endpoint intentionally includes other doctors; it must be removed or restricted.
- The profile layout banner and fetch must be removed to prevent unnecessary PHI/profile calls.

### Impact

- **Database:** no schema change; notes preserved.
- **API:** remove/retire patient/profile endpoints; add own-booking notes endpoints; restrict booking reads.
- **Frontend:** remove nav/pages/profile banner; add notes in booking detail.
- **Existing data:** preserved.

### Security implications

- Own-booking/own-note checks server-side.
- No peer notes.
- No patient directory.
- Profile edits only by admin.
- Session access rules from C2.

### Acceptance criteria

1. Doctor nav shows only My Calendar.
2. No Patients/Profile pages expose data.
3. Doctor can read/write notes only for own bookings.
4. Doctor cannot read another doctor's notes.
5. Patient directory APIs are not reachable by doctors.
6. Admin doctor management still works.
7. Existing note rows remain.
8. No doctor can access admin functions.

**Owner approval:** recorded — retaining own clinical notes and removing doctor self-profile/photo are approved.

---

## C2 — Data Isolation

**Status: DECIDED.**

### Final decision

| Action | Allowed owner | Rule |
|---|---|---|
| Read booking list | Doctor | Only bookings with `Booking.doctorId = own Doctor.id`; statuses `CONFIRMED`/`CANCELLED`; no unpaid holds |
| Read booking detail | Doctor | Same ownership; patient name/email only as needed for the appointment |
| Read patient directory/info | Doctor | No directory; only patient data attached to own booking; admin uses `PATIENTS` permission |
| Read note | Doctor | Only notes authored by the authenticated doctor for their own booking; no peer notes |
| Write/update/delete note | Doctor | Only own note, own booking; content limits enforced |
| Join session | Patient | Own booking, `CONFIRMED`, `ONLINE`, inside window |
| Join session | Doctor | Own booking, `CONFIRMED`, inside window |
| Join session | Staff | No video join in this roadmap |
| Admit patient | Doctor | Own booking, `CONFIRMED`, inside window, identity = booked patient |
| Admin read notes | Staff | Not allowed unless a separate policy is approved |
| Admin read bookings | Staff | `APPOINTMENTS:READ` |

Rules:

- Never trust a client-supplied `doctorId`; resolve `Doctor.id` from `auth.userId`.
- Never trust a client-supplied patient identity; compare with `Booking.userId`.
- `Doctor.isActive` and `User.isActive` must be enforced where applicable.
- Session test mode must never bypass ownership or identity checks; it may only bypass the time/status window in development.
- API routes are the security boundary; hiding navigation is not sufficient.

### Business reasoning

- A doctor must not see another doctor's patients, bookings, or notes.
- A patient must not access another patient's session or booking.
- Staff video participation is outside the approved scope.

### Technical reasoning

- Existing doctor bookings/session endpoints already scope by `doctorId`, but the booking detail/notes/patient surfaces need tightening/removal.
- The doctor bookings endpoint currently returns all statuses, including unpaid `PENDING`; filter to confirmed/cancelled.
- The admit endpoint currently accepts any identity; fix per Phase 1.
- The session lobby currently allows staff role; remove staff video access unless separately approved.

### Impact

- **Database:** none.
- **API:** filter statuses; remove/replace patient endpoints; enforce identity; restrict staff.
- **Frontend:** calendar plus own booking detail and own notes; no patient directory or self-profile.
- **Existing data:** unchanged.

### Security implications

- Cross-doctor/patient/notes access is a security defect.
- Tests must prove denial for every route.

### Acceptance criteria

1. Doctor A cannot read Doctor B's booking list, detail, notes, or session.
2. Patient A cannot read Patient B's booking/session.
3. Staff cannot join a LiveKit room in this roadmap.
4. Doctor admit fails for a different participant identity.
5. Unpaid `PENDING` bookings are not shown as doctor appointments.
6. No client-supplied doctor/patient id can override ownership.
7. Test mode does not bypass ownership.

**Owner approval required:** no — required security behavior.

---

## D. Blog Publishing

## D1 — `publishedAt` Policy

**Status: DECIDED.**

### Final decision

- **First publish:** if `publishedAt` is null, set it to the server's current UTC timestamp.
- **Edit of a published article:** keep the original `publishedAt`; update `updatedAt` only.
- **Unpublish:** keep `publishedAt` for audit; public visibility is controlled by `status = PUBLISHED`.
- **Republish:** keep the original `publishedAt`; do not reset it.
- Public ordering uses `publishedAt DESC`, then `createdAt DESC`.
- If a migration/import finds a `PUBLISHED` row without `publishedAt`, backfill it from `createdAt`.
- No scheduled future publication in this release; do not set a future `publishedAt` unless a scheduling feature is separately approved.

### Business reasoning

- `publishedAt` should mean “first published,” not “last edited.”
- Preserving it keeps chronological order stable across unpublish/republish.
- `updatedAt` already communicates edits.

### Technical reasoning

- Set `publishedAt` only when transitioning from non-published to published and it is null.
- Do not trust client-provided timestamps.
- `status` is the visibility authority; `publishedAt` is metadata.

### Impact

- **Database:** `publishedAt`, `updatedAt`; no additional fields.
- **API:** server-controlled timestamps; public sorting.
- **Frontend:** display published date; no false “updated” ordering.
- **Existing data:** none (new feature).

### Security implications

- Client cannot backdate/future-date publication.
- Draft rows remain non-public regardless of `publishedAt`.

### Acceptance criteria

1. First publish sets a timestamp.
2. Editing does not change it.
3. Unpublish keeps it but hides the article.
4. Republish keeps it and reuses the original order.
5. Public list is chronologically stable.
6. Tests cover all transitions.

**Owner approval required:** no — content metadata semantics.

---

## D2 — Slug Generation

**Status: DECIDED.**

### Final decision

- If the admin provides no slug, generate one from the title.
- Slugs are Unicode-aware so Arabic and Latin titles work without a transliteration dependency:
  - normalize Unicode;
  - lowercase Latin characters;
  - trim;
  - replace whitespace with `-`;
  - remove control/punctuation/unsafe characters;
  - allow letters, numbers, Arabic letters, and hyphens;
  - collapse repeated hyphens and trim leading/trailing hyphens.
- If the generated slug is empty, use `post-<base36 timestamp>` and verify uniqueness.
- If a generated slug already exists, append `-2`, `-3`, etc. until unique.
- If an admin supplies a slug that already exists, reject with `409` and a clear message; do **not** silently suffix an explicit slug.
- Slug is editable while the post is a draft.
- Once a post has ever been published, the slug is **immutable**. Do not break public links.
- If a published slug must change, the supported path is to unpublish/delete and create a new post; redirects are not part of this release.
- Public article lookup uses the exact slug; deleted/unpublished returns 404.

### Business reasoning

- Arabic titles are expected; an ASCII-only slug rule would fail or force unnatural English slugs.
- Stable published URLs protect SEO and external links.
- Automatic suffixing prevents accidental duplicate generated slugs.

### Technical reasoning

- Use one slugify helper shared by create and update.
- Enforce uniqueness at the database and API layers.
- Store the final slug; never derive it at read time.
- Route handling must decode Unicode slugs consistently.

### Impact

- **Database:** `slug @unique`.
- **API:** validation, duplicate handling, immutability rule.
- **Frontend:** slug preview; disabled editing after publish.
- **Existing data:** none.

### Security implications

- Slug must reject control characters/path traversal.
- Do not allow slashes or reserved route-like values.
- URL decoding must not bypass publication checks.

### Acceptance criteria

1. Arabic title generates a usable non-empty slug.
2. Duplicate generated titles get `-2`, `-3`.
3. Duplicate explicit slug returns 409.
4. Draft slug can be edited.
5. Published slug cannot be changed via API/UI.
6. Deleted/unpublished slug 404s.
7. Tests cover Arabic, Latin, punctuation-only, duplicate, and immutability.

**Owner approval required:** no — technical content policy.

---

## D3 — Public Visibility

**Status: DECIDED.**

### Final decision

- Public listing API and page: only `status = PUBLISHED`.
- Public detail API and page: only `PUBLISHED`; draft/unpublished/deleted returns 404.
- Publication is enforced server-side in the Prisma query, not in the client.
- SSR fetches must use the same published-only filter.
- Page metadata (`title`, description, OpenGraph) is generated only from published records.
- No public caching in the first release:
  - send `Cache-Control: no-store` on public blog pages/API responses, or disable shared caching;
  - never cache a response that could later include draft data.
- Unpublishing takes effect immediately on the next request.
- Deleting is a hard delete in this roadmap; deleted posts return 404. If soft delete is chosen later, public queries must exclude it.
- Admin APIs are authenticated and never publicly cached.
- No draft preview route in this release; a draft preview would need an authenticated preview token and is out of scope.
- Sitemap/RSS are out of scope; if added later, they must query published-only.

### Business reasoning

- Draft content must never leak.
- Immediate unpublish is required for corrections/legal requests.
- No caching avoids stale draft/publication mistakes in the first release.

### Technical reasoning

- A single published query helper should be reused by API, SSR page, and metadata.
- Do not rely on route middleware alone; the data query itself must filter.
- 404 (not 403) avoids confirming that a draft exists.

### Impact

- **Database:** status index `(status, publishedAt)`.
- **API:** public endpoints filter published; admin endpoints remain authenticated.
- **Frontend:** SSR published-only; no cache; 404 states.
- **Existing data:** none.

### Security implications

- Draft leakage is a content/security defect.
- No public preview; no cache poisoning.
- Admin authentication remains mandatory.

### Acceptance criteria

1. Draft is absent from public listing/detail/API/SSR/meta.
2. Unpublish hides immediately.
3. Deleted post returns 404.
4. Public responses have no shared-cache risk.
5. Admin endpoints require auth/permission.
6. Tests cover direct URL, API, SEO, and SSR.
7. No draft ID/title appears in public responses.

**Owner approval required:** no — publication safety requirement.

---

## Cross-Decision Dependency Notes

- A1, A2, A3, and A5 all live in Phase 4 and must be implemented together; changing one without the others can produce inconsistent states.
- B1 and B2 are prerequisites for Phase 3's per-doctor availability; B3 depends on B1's availability and Phase 4's confirmed status.
- C1 depends on C2's ownership rules; C2 also constrains Phase 1's admit/session behavior.
- D1/D2/D3 are independent of booking/payment but must be implemented consistently in Phase 5.
- Email verification remains excluded from every decision and phase.
