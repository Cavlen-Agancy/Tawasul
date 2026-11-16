# 03 — Risks and Resolved Decisions

> **Status:** risks retained for context; the former open questions are resolved.  
> **Authority:** [`../FINAL-DECISIONS.md`](../FINAL-DECISIONS.md) is the decision source; [`../ROADMAP-DECISIONS-UPDATE.md`](../ROADMAP-DECISIONS-UPDATE.md) maps decisions to phases.  
> **Owner approvals:** A1 (payment hold), A3 (late payment/refund), B3 (rescheduling), and C1 (doctor notes/profile scope) are **owner-approved**. See [`../OWNER-APPROVAL-REQUIRED.md`](../OWNER-APPROVAL-REQUIRED.md).

## 1. Critical Technical Risks

### R1 — Availability backfill leaves doctors unbookable

**Impact:** High. If patient slots switch to `Doctor.Availability` while active doctors have zero rows, the booking calendar becomes empty platform-wide.  
**Phase:** 3.  
**Evidence:** `server/utils/availability.ts` returns no slots when no `Availability` exists; new doctor creation does not create availability; current booking bypasses it via `AdminSchedule`.  
**Mitigation:**

- Backfill every active doctor with zero rows from active `AdminSchedule`.
- Staging assertion: active doctors with zero availability must be zero after migration.
- New doctor creation copies the active default schedule.
- Admin empty-state warning.
- Documented rollback to global availability.

### R2 — Two availability sources drift

**Impact:** High. Admin edits `AdminSchedule`, but patients see custom `Availability` that never updates. Support burden and perceived bugs.  
**Phase:** 3.  
**Resolution:** `AdminSchedule` is a default template only; edits do not propagate to existing doctors. Existing custom schedules are protected. A future “apply default to all” is a separate explicit action (not in this roadmap).  
**Mitigation:** admin UI copy; tests that a schedule edit leaves existing availability untouched; no silent fallback from an intentionally empty custom schedule.

### R3 — Double booking / race conditions

**Impact:** Critical business and trust risk. Two patients can book the same doctor/time, or a payment can confirm after another booking took the slot.  
**Phase:** 4.  
**Current evidence:** availability counts only `CONFIRMED`; create is not transactional/locked; admin assignment also has a time-of-check/time-of-use gap.  
**Mitigation:**

- PostgreSQL advisory transaction lock keyed by doctor/date/start.
- Revalidate inside the transaction.
- Conditional payment confirmation under a row lock.
- Concurrency tests with parallel create calls.
- Late-webhook free-slot recheck.

### R4 — Abandoned payment holds either block forever or allow double booking

**Impact:** High. Without expiry, slots are permanently unavailable; with unsafe expiry, a late success can double-book.  
**Phase:** 4.  
**Resolution:** 20-minute configurable hold (A1, owner approved); expiry frees the slot but does not auto-cancel the booking; late success rechecks the slot (A3, owner approved); no automatic refund.  
**Mitigation:** `holdExpiresAt`, occupancy predicate, reconciliation query, row locks.

### R5 — Webhook errors are currently swallowed

**Impact:** High. A paid booking can remain unconfirmed if the database update fails, and the gateway will not retry because the handler returns 200.  
**Phase:** 4.  
**Evidence:** `utils/booking-status.ts` catches all errors; `webhook.post.ts` returns `{message: 'Webhook received'}` after signature.  
**Mitigation:** transactional update; return non-2xx on processing failure after signature; idempotent retries; alerting.

### R6 — LiveKit re-entry and room lifecycle unverified

**Impact:** High UX/security. Re-entry may fail if the room is closed when everyone leaves, or a patient may reconnect with a stale token/permission.  
**Phase:** 1.  
**Mitigation:** fresh `SessionRoom.currentEntryId` per patient entry; admission bound to current entry + LiveKit SID; old-token reconnects with a new SID are denied/removed; token TTL bounded; exact-end room deletion with durable `terminatedAt` and startup/fallback sweeps; staging two-browser drill. `SessionRoom.expiresAt` is metadata, not authorization.

### R7 — Token remains valid beyond the appointment window

**Impact:** Security/privacy. A token issued at 1:59 for a 1:00–2:00 session would otherwise live for an hour.  
**Phase:** 1.  
**Mitigation:** token TTL = remaining window; exact-end token rejection; exact-end LiveKit room deletion; no publish/subscribe before current-entry admission.

### R8 — Doctor peer notes are a PHI exposure

**Impact:** High privacy risk. A doctor with any confirmed booking with a patient can read notes authored by other doctors for that patient.  
**Phase:** 2.  
**Resolution:** C1 (owner approved) keeps only the doctor's own notes for their own bookings; peer notes and the patient-directory note timeline are removed; note data is preserved.  
**Evidence:** `server/api/doctor/patients/[userId]/notes.get.ts` includes peer author ids.

### R9 — Legacy unassigned/pending bookings

**Impact:** High business/data. Setting `doctorId` required or auto-confirming old rows could destroy history or create incorrect appointments.  
**Phase:** 3–4.  
**Resolution:** A4/A5: keep `doctorId` nullable; new writes require a doctor; legacy rows remain editable only by explicit admin remediation; no automatic confirmation or deletion; no confirmed reassignment.

### R10 — Current tests encode old behavior

**Impact:** Medium. Tests will fail or hide regressions if not updated alongside behavior.  
**Phase:** 1, 3, 4.  
**Evidence:** booking E2E asserts `doctorId: null`/`PENDING`; payment tests assert success leaves `PENDING`; meeting tests assert +15; patient dashboard tests exercise the inline flow.  
**Mitigation:** update tests in the same phase; prefer tests that assert the new server contract, not only UI.

### R11 — Timezone/date boundary regressions

**Impact:** High correctness. Booking dates are stored as `@db.Date` at UTC midnight; previous fixes specifically addressed day-flip bugs.  
**Phase:** 3–4.  
**Mitigation:** preserve `parseDateUTC`/`formatDateUTC` at DB boundaries; add tests around month/year boundaries, exact end time, and server timezone assumptions.

### R12 — Stripe checkout is not actually usable

**Impact:** Medium. Stripe returns `clientSecret`, but the UI doesn’t implement client-side confirmation and only redirects on `paymentUrl`.  
**Phase:** 4 if Stripe remains supported.  
**Mitigation:** return `session.url` and redirect; or explicitly declare Paymob-only for this release.

## 2. Business and UX Risks

### B1 — Moving dashboard booking to `/book` changes familiar UX

**Impact:** Medium. Patients currently book inside the dashboard calendar. Consolidation removes a familiar flow.  
**Phase:** 3.  
**Mitigation:** pass the selected date to `/book`, preserve a clear “Book a Session” CTA, and show a one-time notice/redirect. Update E2E and docs.

### B2 — Confirmation timing vs gateway redirect

**Impact:** Medium. The redirect can arrive before the webhook; the patient may see “pending” after paying.  
**Phase:** 4.  
**Mitigation:** success page polls `GET /api/booking/:id` for a short period; show “confirming payment”; never show confirmed prematurely.

### B3 — No-approval model removes an operational safety net

**Impact:** Medium. Admin can no longer inspect and assign every booking.  
**Phase:** 4.  
**Mitigation:** admin calendar is the operational view; legacy unassigned queue remains; add reconciliation alerts for paid/unconfirmed.

### B4 — Doctor profile edit removal

**Impact:** Medium. Removing the doctor profile page prevents self-service photo/bio edits. Admin doctor management covers name/phone/bio/specializations but not photo/slug.  
**Phase:** 2.  
**Resolution:** C1 (owner-approved) removes doctor self-profile and photo upload; existing photos remain; admin profile management is the canonical text-editing path.  
**Mitigation:** document the photo-management gap; add admin photo support only through a separately approved scope.

### B5 — Doctor notes access removal

**Impact:** Medium-high clinical workflow.  
**Phase:** 2.  
**Resolution:** C1 (owner-approved) keeps own notes in the booking-detail drawer and removes peer/patient-wide notes.  
**Mitigation:** reuse `DoctorNote` (one note per booking/doctor); preserve rows; no new schema.

### B6 — Blog content quality/expectations

**Impact:** Low-medium. Plain text may be perceived as limited.  
**Phase:** 5.  
**Resolution:** plain text + `BLOG` resource is the chosen design; D1–D3 (publishedAt, Unicode slugs, public visibility/no-cache) are DECIDED. Rich text/Markdown remains out of scope.

## 3. Security Concerns

1. **Ownership checks:** every patient booking/session route must keep `booking.userId === auth.userId`; every doctor route must derive `Doctor.id` from the JWT userId, never from a client-supplied doctor id.
2. **LiveKit admit identity:** verify the supplied `identity` parses to the booked patient and matches `SessionRoom.currentEntryId`, then bind admission to the current LiveKit participant SID.
3. **Token TTL/window:** always recheck the window server-side; never trust a previously issued token to define authorization.
4. **Payment webhook:** do not weaken signature verification. Do not accept client-reported success. Do not expose HMAC/secrets in logs.
5. **Admin blog permissions:** use `BLOG` RBAC; do not rely on nav hiding.
6. **Public blog:** enforce published status server-side; do not use client filtering or shared cache.
7. **XSS:** plain text; no `v-html`; if rich text is later approved, sanitize with an allowlist.
8. **Doctor endpoints:** own notes only; patient directory and profile self-service removed; peer notes removed.
9. **No confirmed doctor reassignment:** the only supported recovery is cancel + rebook.
10. **Uploads:** no new upload surface is needed for plain-text blog.
11. **Secrets:** never place real credentials in docs, source, or test fixtures; environment review reports names/status only.
12. **Rate limiting/CAPTCHA:** not part of these phases; blog public endpoints may need rate limiting later.

## 4. Resolved Decision Register

The following are no longer open questions. Status and details are in `../FINAL-DECISIONS.md`.

| ID | Final decision | Status |
|---|---|---|
| A1 | 20-minute online hold, configurable 5–60 minutes | DECIDED — OWNER APPROVED |
| A2 | Expiry releases slot; booking remains PENDING; no auto-cancel of paid rows; no auto cleanup job | DECIDED |
| A3 | Late success: confirm if slot free; else keep payment SUCCESS, cancel booking, manual refund/reconciliation | DECIDED — OWNER APPROVED |
| A4 | Legacy unassigned rows preserved, admin-resolvable, no auto assignment/deletion | DECIDED |
| A5 | New bookings require doctor; DB nullable for history; no confirmed reassignment | DECIDED |
| B1 | Doctor Availability is patient-facing source; AdminSchedule is default template; global closures/holidays apply to all | DECIDED |
| B2 | AdminSchedule edits affect only new/backfilled doctors | DECIDED |
| B3 | Patients reschedule own confirmed bookings up to 24h before start, same doctor, cross-date; admins any confirmed; doctors none; no doctor change | DECIDED — OWNER APPROVED |
| C1 | Calendar + own booking detail + own notes + session; remove Patients/Profile/peer notes | DECIDED — OWNER APPROVED |
| C2 | Strict ownership rules for bookings, patient info, notes, session join, and admit | DECIDED |
| D1 | First publish sets `publishedAt`; edits/unpublish/republish preserve it | DECIDED |
| D2 | Unicode-aware generated slugs; unique suffixes; published slugs immutable | DECIDED |
| D3 | Public access only PUBLISHED; SSR/server filtering; no shared cache; draft/deleted = 404 | DECIDED |

## 5. Former Question Mapping

| Former question | Resolution |
|---|---|
| Q1 hold duration | A1 — 20 minutes, configurable (owner approved) |
| Q2 legacy pending | A4 — preserve, admin-resolve, no auto changes |
| Q3 late webhook | A3 — free-slot confirm; otherwise cancel + manual refund |
| Q4 `doctorId` nullability | A5 — DB nullable permanently; API required |
| Q5 profile/notes APIs | C1 — own notes retained; patient/profile/peer APIs removed (owner approved) |
| Q6 blog format/permission | D1–D3 + Phase 5 — plain text, BLOG resource |
| Q7 in-clinic confirmation | Phase 4 — CONFIRMED at creation, no payment |
| Q8 AdminSchedule propagation | B2 — default for new/backfilled only |
| Q9 admin reassignment | A5 — not supported; cancel/rebook |
| Q10 reschedule scope | B3 — cross-date, same doctor, 24h patient limit (owner approved) |
| Q11 staff video join | C2 — staff cannot join video |
| Q12 doctor contact visibility | C1/C2 — patient name + email in own booking detail; no directory; no phone exposure in notes |

## 6. Owner-Approved Decisions

The four decisions are owner-approved:

1. **A1** — payment hold duration/configuration.
2. **A3** — late successful payment/refund policy.
3. **B3** — rescheduling policy.
4. **C1** — doctor notes/profile scope.

Everything else is DECIDED and can be implemented without separate business approval. Implementation verification remains required before release; no business decision is pending.

## 7. Risk Ownership Checklist

Before implementation/release, assign an owner for:

- payment hold/late webhook policy (business + engineering);
- legacy booking reconciliation (operations + data owner);
- doctor notes/profile scope sign-off (clinical/product);
- blog content review (content/editorial);
- LiveKit staging drill (engineering);
- production configuration/backup/restore (operations);
- final release approval (product owner).
