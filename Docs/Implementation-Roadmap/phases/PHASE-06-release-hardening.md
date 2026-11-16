# Phase 6 — Integration, Regression & Release Readiness

**Requirement:** All (release gate).  
**Priority rationale:** Security Risk 5, Business Impact 5, Technical Risk 2 (planning/verification only). No new product feature is introduced.

## 1. Business Objective

Prove that the phased changes work together on a production-like environment, that migrations are safe and reversible in practice, and that no old approval/payment/session behavior remains. This phase converts five implementation efforts into a single deployable release.

## 2. Scope

Included:

- Full regression suite on a production-like database.
- Migration rehearsal from a production snapshot.
- End-to-end business flow verification.
- Authorization matrix verification.
- Production configuration review (names/status only; no secret values).
- Monitoring/alerting and payment reconciliation runbook.
- Rollback/recovery rehearsal.
- Documentation updates.

Out of scope:

- New features or schema changes.
- Email verification.
- Refund API automation.
- Marketing content writing beyond the blog feature.
- Infrastructure redesign.

## 3. Prerequisites

- Phases 1–5 merged and individually verified.
- A1 (20-minute hold), A3 (late payment/refund), B3 (rescheduling), and C1 (doctor notes/profile) owner approvals recorded.
- A staging database restored from a recent production snapshot (approved by the owner).
- Test/staging credentials for Paymob/Stripe/LiveKit/Resend available; do not place real secrets in the repository.
- Explicit approval to run builds, tests, migrations, containers, and browser automation. Per project instructions, none of these are run during planning.

## 4. Release Gate Checklist

### 4.1 Code and schema

- [ ] No uncommitted/untracked implementation files outside the approved phase.
- [ ] `prisma/schema.prisma` and the actual migrations match.
- [ ] `prisma migrate deploy` succeeds on the staging snapshot.
- [ ] No destructive migration is present.
- [ ] `Doctor.Availability` backfill verified: active doctors with zero rows = 0.
- [ ] `SessionRoom` hardening migration (`currentEntryId`, `admittedParticipantSid`, `terminatedAt`, index) applied and `prisma generate` run.
- [ ] `BlogPost` table and `BLOG` enum applied.
- [ ] `Booking.holdExpiresAt` applied and indexed.
- [ ] Rollback instructions exist for each migration.
- [ ] Seed admin has all expected permissions, including BLOG.
- [ ] No test-only fixture or debug route is exposed in production.

### 4.2 Booking and payment

- [ ] Patient chooses doctor; slots are doctor-specific.
- [ ] In-clinic booking is confirmed immediately with no Payment.
- [ ] Online booking stays pending until verified payment success.
- [ ] Failed payment never confirms.
- [ ] Default online hold is 20 minutes (5–60 configurable).
- [ ] Expired hold frees the slot but leaves the booking PENDING; no auto-cancel/cleanup job; paid rows are never cancelled.
- [ ] Late success with free slot confirms; occupied slot does not double-book, payment remains SUCCESS, booking cancelled for manual reconciliation; already cancelled not resurrected.
- [ ] Duplicate webhook is harmless.
- [ ] Concurrent create for the same doctor/time produces one booking.
- [ ] Admin/doctor calendars show the booking automatically; doctor sees confirmed/cancelled only.
- [ ] No normal admin approval or confirmed reassignment is required.
- [ ] Legacy unassigned bookings are visible to admins and not silently mutated.
- [ ] AdminSchedule edits do not rewrite existing doctor availability.
- [ ] GlobalBlockedDate stops new bookings without silently cancelling existing confirmed bookings.
- [ ] Cross-date same-doctor reschedule works with 24h patient rule, admin permission, and concurrency rejection.
- [ ] Refund status rules are consistent (SUCCESS only); no automatic refund.
- [ ] Confirmation emails are attempted once per confirmation.

### 4.3 Session

- [ ] Join opens 5 minutes before start.
- [ ] Join closes exactly at end.
- [ ] Server rejects token issuance after end.
- [ ] Doctor admit rejects after end and for wrong identity.
- [ ] Patient can leave and re-enter before end.
- [ ] Re-entry requires a fresh doctor admission and fresh server-side entry.
- [ ] Old-token reconnect with a new LiveKit SID is denied and removed.
- [ ] Reconnect during the admission grant is detected after the grant and revoked.
- [ ] Duplicate connections for the same participant identity are rejected.
- [ ] Token TTL does not exceed the window.
- [ ] Wrong patient/wrong doctor denied.
- [ ] Exact-end termination deletes the LiveKit room and disconnects connected participants.
- [ ] Termination is idempotent and survives restart/missed-timer sweep.
- [ ] Staff can read lobby metadata but cannot get a session token or join the video room.
- [ ] Test mode is disabled in production.

### 4.4 Doctor access

- [ ] Doctor nav is calendar-only (plus own booking detail/notes).
- [ ] Removed doctor patient/profile pages/APIs redirect, 404, or are retired.
- [ ] Doctor sees only own `CONFIRMED`/`CANCELLED` bookings; no unpaid holds.
- [ ] Doctor cannot fetch another doctor's booking, notes, or session.
- [ ] Doctor can read/write own notes only; peer notes are unavailable.
- [ ] Patient/staff cannot use doctor endpoints.
- [ ] No confirmed-booking reassignment API/UI exists.
- [ ] Existing note/profile/photo data is preserved.

### 4.5 Blog

- [ ] Admin with BLOG permissions can CRUD/publish.
- [ ] Staff without BLOG is denied at API and redirected at UI.
- [ ] Only PUBLISHED is public; drafts/deleted 404.
- [ ] `publishedAt` set on first publish and preserved on edit/unpublish/republish.
- [ ] Arabic title generates a valid Unicode slug; generated collisions suffix; explicit duplicates 409; published slug immutable.
- [ ] Public listing/detail/SSR/metadata use published-only queries and no shared cache.
- [ ] Content is XSS-safe.
- [ ] Nav/footer links work mobile/desktop.

### 4.6 Production configuration (names only; never print values)

- [ ] `NODE_ENV=production`.
- [ ] `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=false`.
- [ ] `PAYMENT_GATEWAY` explicit; real Paymob/Stripe keys configured.
- [ ] `PAYMOB_HMAC_SECRET` / `STRIPE_WEBHOOK_SECRET` configured.
- [ ] `RESEND_API_KEY` / `RESEND_FROM_EMAIL` configured.
- [ ] `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` configured for production.
- [ ] `APP_URL` is the public HTTPS origin.
- [ ] `DATABASE_URL` points to production with the correct pooled connection settings.
- [ ] `BOOKING_HOLD_MINUTES` is set to the owner-approved value (recommended 20; range 5–60).
- [ ] Upload path is persistent and writable by the app user.
- [ ] Secrets are not committed or logged.

## 5. Test Matrix

Run only after explicit approval. Paths are the intended locations.

### Unit

- `tests/utils/availability.test.ts`
- `tests/utils/meeting.test.ts`
- `tests/utils/email.test.ts`
- new slot-lock/payment-state tests
- new blog validation tests if extracted

### API

- Auth/payment/booking/patient/doctor/admin/session suites already present under `tests/api/`.
- New/updated:
  - public doctors
  - doctor booking isolation
  - doctor session admit + current-entry/SID re-entry denial
  - session termination/sweep/idempotency
  - booking creation with doctor
  - payment auto-confirm/idempotency
  - concurrent booking
  - refund rules
  - blog public/admin CRUD

### E2E

Recommended sequence in one Playwright run:

1. Patient logs in → `/book` → selects doctor → date/time → online mock payment → success page shows confirmed.
2. DB assertion: `booking.doctorId = selected`, `booking.status = CONFIRMED`, `payment.status = SUCCESS`.
3. Admin calendar shows the booking; selected doctor calendar shows it; another doctor does not.
4. In-clinic booking → no payment → confirmed → calendars.
5. Failed payment → not confirmed → retry/expiry message.
6. Expired hold releases slot; late mock success with free slot confirms; occupied slot does not double-book and appears in reconciliation.
7. Patient session re-entry before end; old token reconnect denied; Join disabled after end; unauthorized route denied.
8. Active patient/doctor forcibly disconnected at exact end; room deletion + termination sweep verified.
9. Doctor login → only calendar nav; `/doctor/patients` and `/doctor/profile` do not expose PHI; own notes work; peer notes fail.
10. Patient/admin cross-date same-doctor reschedule; 24h/ownership/concurrency rules.
11. Blog admin create/publish with Arabic title → public Arabic slug → edit/unpublish/republish preserves date → draft 404; no-cache header/behavior.
12. Role matrix: patient cannot call doctor/admin APIs; doctor cannot call admin APIs; staff cannot join video; staff permissions enforced.

## 6. Migration Rehearsal

On a staging copy, not production:

1. Take a backup/snapshot.
2. Record row counts for `users`, `doctors`, `availability`, `admin_schedules`, `bookings`, `payments`, `session_rooms`.
3. Apply migrations in order.
4. Verify:
   - no data loss;
   - availability backfill counts;
   - existing custom availability unchanged;
   - legacy bookings still readable;
   - `SessionRoom` entry/admission/termination columns and index valid;
   - blog table/enum valid.
5. Run the application against the restored DB.
6. Run the integration/E2E suite.
7. Restore the snapshot and repeat once to prove repeatability.

Do not run `prisma migrate reset`, `db push --force-reset`, or any destructive command against production.

## 7. Observability and Operations

### Payment/webhook

- Log verification failures with gateway/request id, never the HMAC secret or full payload containing PII.
- Alert on:
  - webhook signature failures above threshold;
  - paid-but-not-confirmed bookings;
  - PENDING holds past expiry;
  - bookings not confirmed within N minutes of payment success.
- Provide read-only reconciliation queries:
  - `Payment.status = SUCCESS AND Booking.status != CONFIRMED` (late success/refund required);
  - `Booking.status = PENDING AND holdExpiresAt < now` (expired hold; no auto-cancel; admin review);
  - `Booking.status = PENDING AND holdExpiresAt IS NULL` (legacy; admin resolution);
  - `Booking.doctorId IS NULL` (legacy unassigned);
  - duplicate webhook events if a log table is added (not planned).
- Never auto-refund or auto-cancel from these queries; actions are explicit and authorized.

### LiveKit

- Alert on token/admit failures and room connection errors.
- Record staging re-entry drill results.
- Confirm token TTL and window in logs without exposing tokens.

### Blog

- Monitor 5xx on public blog endpoints.
- No draft leakage in SSR/cache.

## 8. Backups and Rollback

- Confirm the production backup/restore procedure before deployment.
- Take a pre-migration snapshot.
- Application rollback:
  - redeploy the previous image;
  - additive columns/tables are ignored by old code.
- Data correction:
  - never manually delete booking/payment rows;
  - use the reconciliation queries and manual gateway refunds;
  - restore from snapshot only with owner approval.
- If Phase 3 and Phase 4 ship separately despite the recommendation:
  - Phase 3 alone is internal/staging only;
  - do not expose the new `/book` to patients until Phase 4 auto-confirmation is live.

## 9. Documentation Updates

- `PROJECT-CURRENT-STATE.md` update after release.
- `Docs/Implementation-Roadmap/README.md` status update.
- Operations:
  - payment reconciliation;
  - LiveKit re-entry drill;
  - rollback steps;
  - admin guide for blog and doctor schedules.
- Note any open questions resolved during implementation.

## 10. Acceptance Criteria

1. All phase acceptance criteria are met.
2. A1, A3, B3, and C1 are owner-approved.
3. Migration rehearsal succeeds twice from the same snapshot.
4. Full approved test suite passes; any skipped test is documented with a reason.
5. E2E covers doctor selection, payment confirmation/expiry/late success, calendar visibility, cross-date reschedule, session re-entry, doctor isolation/own notes, and blog publication/Arabic slug/no-cache.
6. Production config checklist is complete (names/status, no secrets exposed).
7. Monitoring/reconciliation/rollback docs exist.
8. No normal admin approval or confirmed reassignment remains.
9. Email verification is still not implemented and is not referenced as a new task.
10. No known critical security or payment issue remains unowned.

## 11. Risks and Dependencies

- **Risk:** Staging data differs from production; a successful rehearsal is not a guarantee. Use a real sanitized snapshot where approved.
- **Risk:** Gateway sandbox behavior differs from production. Verify with provider test credentials and a small live test if approved.
- **Risk:** LiveKit NAT/TURN issues may only appear in production. Keep the existing test mode for drills (dev only) and document a fallback.
- **Dependency:** All prior phases.
- **Rollback:** additive schema; see section 8.

## 12. Definition of Done

- A1/A3/B3/C1 owner approvals are recorded.
- Release checklist signed off.
- Migrations applied and verified.
- Approved test/build results recorded.
- Operations runbooks stored.
- Roadmap status set to released/complete.
- Post-release monitoring window completed.
