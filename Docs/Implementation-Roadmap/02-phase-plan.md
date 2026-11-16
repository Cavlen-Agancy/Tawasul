# 02 — Ordered Phase Plan

This is the control document for execution order. Detailed implementation specifications live in `phases/PHASE-*.md`; each phase document is authoritative for its files, tasks, tests, and definition of done.

## 1. Phase Summary

| Phase | Title | Requirement | Business Objective | Primary Modules | Schema | Release Dependency |
|---|---|---|---|---|---|---|
| 1 | Session Re-entry & Join-Window Enforcement | D | Repeatable lobby entry before end; server-enforced window/admission | session, patient, doctor, meeting util | None | None |
| 2 | Doctor Workspace Simplification | B | Calendar + own booking detail/notes; server-isolated appointments | doctor layouts/pages, doctor APIs | None | C1 owner approved |
| 3 | Doctor-Based Booking Foundation | A (part 1) | Patient selects doctor; doctor-specific availability; auto-linked booking | booking, patient, admin doctors, public API, homepage | indexes + availability backfill | Phase 2 recommended |
| 4 | Payment-Driven Confirmation | A (part 2) | Auto-confirm paid/in-clinic bookings; no approval; failure/race safety | payment, booking, admin, patient, email | `holdExpiresAt` | Phase 3 |
| 5 | Blog Management | C | Admin CRUD/public blog with publication control | new blog module, admin, public layout | BlogPost, BlogStatus, BLOG enum | Phase 2 recommended |
| 6 | Release Hardening | All | Integration, migration rehearsal, regression, rollback | whole app + ops | verification only | Phases 1–5 |

## 2. Recommended Schedule and Release Shape

### Execution order

1. Phase 1 — quick, isolated security/UX fix.
2. Phase 2 — quick, isolated access-surface reduction.
3. Phase 3 — booking foundation.
4. Phase 4 — payment/confirmation completion.
5. Phase 5 — blog (can run parallel with 3–4 by a separate engineer).
6. Phase 6 — release gate.

### Deployment shape

- Phases 1 and 2 can be deployed independently to production after their verification.
- Phases 3 and 4 must be released together for patient use. Phase 3 leaves the old manual-confirmation semantics temporarily; Phase 4 completes the requirement.
- Phase 5 can be released independently.
- Phase 6 is a gate, not a feature; it must precede the combined release.

## 3. Requirement-to-Phase Mapping

| Approved requirement | Phase | Detailed file |
|---|---|---|
| A1: admin manages doctors, patient chooses doctor, doctor-specific times, auto-link, no normal admin assignment | 3 | `phases/PHASE-03-doctor-booking-foundation.md` |
| A2: no approval; online confirmed only after successful payment; in-clinic no payment; failure/incomplete not confirmed | 4 | `phases/PHASE-04-payment-confirmation-lifecycle.md` |
| A3: both types appear in admin/doctor calendars | 3 + 4 | Phase 3 display; Phase 4 status semantics |
| B: doctor calendar + own booking detail/notes; no other doctors; remove unrelated sections; server enforcement | 2 (+1 for session) | `phases/PHASE-02-doctor-workspace-simplification.md` |
| C: blog admin CRUD/public pages/published-only | 5 | `phases/PHASE-05-blog-management.md` |
| D: re-entry before end, lobby, re-admit, server window, ownership, LiveKit security | 1 | `phases/PHASE-01-session-reentry.md` |
| E: registration unchanged; no email verification | — | No phase; explicitly excluded everywhere |

## 4. Phase Details (Summary)

### Phase 1 — Session Re-entry & Join-Window Enforcement

**Business objective:** Make the existing lobby/video flow safely repeatable within the exact appointment window.

**Scope:** shared meeting window, token TTL, per-entry admission state, current-entry/SID doctor admit, exact-end LiveKit room termination with restart recovery, canonical lobby behavior, UI copy, tests.

**Out of scope:** booking redesign, payment, blog.

**Key files:** `server/utils/meeting.ts`, `server/utils/livekit-token.ts`, `server/utils/session-access.ts`, `server/utils/session-room.ts`, `server/utils/session-termination.ts`, `server/plugins/session-termination.ts`, patient/doctor session APIs, session pages, meeting lobby, calendars, i18n, `prisma/schema.prisma` + Phase 1 migration.

**Database:** `SessionRoom.currentEntryId`, `admittedParticipantSid`, `terminatedAt`, expiry/termination index; additive migration.

**Acceptance:** re-entry works before end; exact end rejects and forcibly deletes the LiveKit room; old-token reconnect/entry reuse is denied; fresh token/lobby/admit each time; wrong patient/doctor/identity denied; staff cannot join video; termination is idempotent and restart-recoverable.

**Tests:** meeting/token unit tests; patient session; doctor session/admit; lobby; termination scheduler/sweep; staff denial; E2E waiting/window.

**Risks/dependencies:** single-instance in-process scheduler; old token can connect to waiting room but cannot get media/admission; LiveKit room recreation; clock boundary; old lobby links; migration must be applied.

**DoD:** migration authored/applied in staging, `prisma generate`, tests + staging re-entry and exact-end termination drills; no unrelated phase work.

---

### Phase 2 — Doctor Workspace Simplification & Access Hardening

**Business objective:** Reduce the doctor experience to a focused calendar and prove server-side isolation.

**Scope:** one nav item; remove patient directory/detail and self-profile pages; remove layout profile banner; add own-booking notes to the booking detail; remove patient/profile/peer-note APIs from the doctor surface; filter doctor bookings to confirmed/cancelled; consolidate duplicate layout; add isolation tests. C1 owner approved.

**Out of scope:** deleting historical notes/data; changing calendar UX; booking logic.

**Key files:** `layouts/doctor-layout.vue`, `modules/doctor/layouts/DoctorLayout.vue`, `modules/doctor/pages/doctor/**`, `modules/doctor/composables/useDoctorDashboard.ts`, doctor booking/notes APIs, doctor API tests.

**Database:** none.

**Acceptance:** calendar-only nav; own notes only in booking detail; removed routes/APIs do not expose PHI; doctor bookings return only own confirmed/cancelled rows; patient/staff denied; profile self-service/peer notes removed.

**Tests:** doctor booking isolation, own/peer note isolation, session ownership, role middleware, E2E doctor nav and own notes.

**Risks/dependencies:** C1 approved; doctor photo management gap; admin profile text management.

**DoD:** UI/API simplified; own-notes surface tested; isolation tests; no data deletion. C1 owner approval recorded (approved).

---

### Phase 3 — Doctor-Based Booking Foundation

**Business objective:** Make the doctor the unit of availability and link every new booking automatically.

**Scope:** doctor-aware availability, global blocked dates, availability backfill/default-only onboarding, public doctors API, `/book` redesign, homepage doctor cards, dashboard consolidation, cross-date same-doctor reschedule (B3 owner approved), transitional same-doctor staging confirmation, legacy-only assignment in the final flow, no confirmed reassignment.

**Out of scope:** automatic confirmation, holds, race locking, blog, doctor reassignment.

**Key files:** `prisma/schema.prisma` (indexes), new backfill migration, `server/utils/availability.ts`, booking APIs, `server/api/public/doctors.get.ts`, `/book` composable/page, homepage, patient dashboard, reschedule endpoints, admin doctor creation/booking APIs.

**Database:** indexes; availability backfill; no required-field change to `Booking.doctorId`.

**Acceptance:** doctor required for every new booking; slots per doctor; global blocks apply; custom availability preserved and default edits do not propagate; new doctor gets defaults; booking shows in calendars; no cross-doctor access; cross-date same-doctor reschedule with 24h patient limit; no confirmed reassignment.

**Tests:** availability unit, booking API, admin doctor creation, public doctors, patient/admin reschedule, E2E doctor selection.

**Risks/dependencies:** B3 approved; backfill makes doctors unbookable if incomplete; global schedule vs per-doctor expectations; dashboard UX change.

**DoD:** staging backfill verified; all entry points send doctorId; reschedule policy implemented/tested; transitional approval documented.

---

### Phase 4 — Payment-Driven Confirmation & Booking Lifecycle

**Business objective:** Confirm bookings automatically and correctly: paid online or in-clinic; never failed/abandoned.

**Scope:** 20-minute hold (A1 owner approved), transactional create, idempotent payment success, failure/expiry, late-success free-slot recheck (A3 owner approved), in-clinic confirmation, success UI, refund fix, admin approval removal/legacy-only assignment, no confirmed reassignment, Stripe URL fix.

**Out of scope:** automatic refund API, auto-cancel/cleanup job for unpaid holds, recurring bookings, notification center.

**Key files:** `prisma/schema.prisma` (hold), `server/utils/booking-status.ts`, `server/utils/availability.ts`, booking create, payment APIs, booking pages, admin appointments/API, email templates.

**Database:** `Booking.holdExpiresAt`, index; additive.

**Acceptance:** online confirmed only after verified success; in-clinic confirmed immediately; expired hold frees slot but does not auto-cancel booking or paid rows; late success confirms only if slot free, otherwise cancel + manual reconciliation; no automatic refund; no normal admin approval or reassignment; calendars automatic; emails once; historical preservation; refunds SUCCESS-only.

**Tests:** payment webhook, initiate, create concurrency, late webhook, cancel/refund, admin legacy, E2E payment/confirmation.

**Risks/dependencies:** A1/A3 approved; gateway behavior; webhook retry semantics; migration rehearsal.

**DoD:** staging lifecycle verified; no paid-but-unconfirmed state silently ignored; no auto refund; phase 3+4 shipped together.

---

### Phase 5 — Blog Management & Public Content

**Business objective:** Minimal first-party blog with admin publication control and safe public rendering.

**Scope:** BlogPost/BlogStatus/BLOG permission, admin CRUD, public list/detail, nav, plain-text rendering, Unicode slugs, `publishedAt` transition policy, no-cache published-only SSR, tests.

**Out of scope:** CMS/markdown/HTML, categories, comments, uploads, scheduled publishing.

**Key files:** `prisma/schema.prisma`, new migration, `prisma/seed.ts`, `modules/blog/**`, `pages/admin/blog.vue`, `layouts/admin.vue`, `PermissionBuilder.vue`, staff validation, `layouts/default.vue`, `lib/home-content.ts`.

**Database:** BlogPost table, BlogStatus, BLOG enum; additive.

**Acceptance:** admin CRUD/publish; first publish sets `publishedAt`, republish preserves; Unicode slugs generated and published slugs immutable; public only PUBLISHED; drafts/deleted 404; no shared cache; permission enforced; XSS-safe; no new dependency.

**Tests:** admin/public API, permission, publishedAt, Unicode slug/duplicate/immutability, E2E publish/unpublish, draft/no-cache/XSS.

**Risks/dependencies:** slug collisions, permission drift.

**DoD:** CRUD/public verified; draft isolation; no booking changes.

---

### Phase 6 — Integration, Regression & Release Readiness

**Business objective:** Prove the combined system is safe to deploy and operable.

**Scope:** staging migration rehearsal, full test matrix, E2E business flow, configuration checklist, monitoring/reconciliation/rollback docs.

**Out of scope:** new features.

**Key files:** all changed modules; operations docs; `PROJECT-CURRENT-STATE.md` update after release.

**Database:** verify migrations; no new changes.

**Acceptance:** checklist complete; repeatable migration rehearsal; approved tests/build; rollback/reconciliation docs; no critical unresolved issue.

**Tests:** full Vitest + Playwright suites (when approved), staging smoke, manual LiveKit drill.

**Risks/dependencies:** staging/production divergence, gateway sandbox differences, LiveKit NAT.

**DoD:** release sign-off.

## 5. Cross-Phase Dependencies and Shared Work

### Shared availability helper

Phase 3 changes `server/utils/availability.ts`; Phase 4 extends the same helper with active holds. Implement Phase 3 with a clear occupancy predicate seam so Phase 4 can add `holdExpiresAt` without rewriting all endpoints.

### Shared booking DTOs

`modules/booking/composables/types.ts`, `modules/patient/composables/types.ts`, and API response shapes must carry `doctorId`, `doctorName`, `sessionType`, and `status` consistently. Do not duplicate divergent types.

### Shared role/authorization tests

Phase 1 and Phase 2 both add ownership tests. Put common fixtures in existing helpers (`tests/api/auth`/`booking`/`patient` helpers) rather than inventing a second fixture system.

### Shared admin nav/RBAC

Phase 2 edits doctor nav; Phase 5 edits admin nav/permissions. Both touch layout files, but different ones. Phase 5 should be merged after Phase 2 to avoid layout conflicts in the admin/doctor shells.

### Shared test fixture doctors

Phase 3 and Phase 4 tests need doctors with availability and bookings. Extend `tests/api/booking/helpers.ts` rather than create per-test duplicate doctors.

### Shared migration release process

Phases 1, 3, 4, and 5 each add a migration. They must be applied in order (`0002_session_hardening` first) and rehearsed in Phase 6. Do not collapse them into one destructive migration.

## 6. Tasks That Must Not Be Done Prematurely

- Do not make `Booking.doctorId` `NOT NULL`; it remains nullable for historical rows. Enforce required doctor at the API layer for new bookings.
- Do not auto-confirm historical paid `PENDING` rows by migration.
- Do not remove the legacy assign endpoint until the product owner approves its removal.
- Do not build a second booking UI in the dashboard; consolidate into `/book`.
- Do not add a CMS, rich-text editor, or HTML renderer for the blog without a sanitation decision and tests.
- Do not remove DoctorNote data.
- Do not implement email verification.
- Do not change the LiveKit vendor or recording behavior in these phases.
- Do not deploy Phase 3 to patients without Phase 4 auto-confirmation.

## 7. Conflicts With Existing Behavior

| Existing behavior | Required change | Phase | Compatibility handling |
|---|---|---|---|
| Booking has no doctor | New booking requires doctor | 3 | Existing rows keep nullable; new API rejects missing |
| Admin assigns doctor | Automatic association | 3 | Transitional confirm in staging; remove normal queue in 4 |
| Payment success leaves PENDING | Payment success confirms | 4 | Update webhook/tests/UI; idempotent transition |
| In-clinic stays PENDING | In-clinic CONFIRMED at creation | 4 | No Payment; confirmation email |
| +15 min post-end join | Exact end | 1 | Update utility/UI/tests; token TTL bounded |
| Doctor can view patients/profile/peer notes | Calendar + own booking detail + own notes | 2 | Remove patient/profile/peer APIs; add own-booking notes; C1 approval pending |
| No blog | Blog feature | 5 | Additive model/routes; publishedAt/Unicode/no-cache rules |
| `/meeting` lobby is a stub | Canonical session lobby | 1 | Redirect/delegate; no duplicate video; staff no video |
| `/book` has no doctor/session type | Doctor and session type selection | 3 | New validation/query params; update clients |
| Cross-date reschedule missing | Same-doctor cross-date reschedule | 3 | Implement patient/admin endpoints; B3 approval pending |

## 8. Decision Status (before implementation)

All decisions are resolved in `Docs/FINAL-DECISIONS.md`.

1. **Availability source:** per-doctor `Availability` with backfill; `AdminSchedule` is a default-only template; edits do not propagate. DECIDED.
2. **Doctor persistence:** `Booking.doctorId` stays nullable permanently; new writes require it at the API layer. DECIDED.
3. **Confirmation semantics:** in-clinic `CONFIRMED` immediately; online `CONFIRMED` only on verified webhook success; expiry and late payment branches defined. DECIDED (A2) + A3 owner approved.
4. **Hold policy:** 20-minute default, 5–60 configurable; no auto-cancel/cleanup; late success rechecks slot. A1/A3 owner approved.
5. **Approval removal and reassignment:** normal admin queue removed; legacy-only remediation retained; no confirmed reassignment. DECIDED (A4/A5).
6. **Doctor notes/profile:** own notes retained; patient directory/profile/peer notes removed. C1 owner approved.
7. **Blog content:** plain text + `BLOG` resource; Unicode slugs; first-publish `publishedAt`; no-cache published-only. DECIDED.
8. **Dashboard booking consolidation:** `/book` is the single booking flow; dashboard navigates to it. DECIDED.
9. **Rescheduling:** same-doctor cross-date; patient 24h; admin confirmed bookings; doctor none. B3 owner approved.

## 9. Verification Strategy by Layer

| Layer | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---|---|---|---|---|---|---|
| Unit | meeting | — | availability | holds/state | blog validation | full |
| API | session/admit/lobby | doctor isolation | booking/doctors/public | payment/webhook/concurrency | blog public/admin | full |
| Integration | LiveKit staging | role matrix | DB + calendars | gateway + DB | SSR + DB | full |
| E2E | re-entry/window | doctor nav/access | doctor selection | payment confirm | blog publish | full release |
| Manual | re-entry drill | doctor UI review | admin schedule review | reconciliation drill | content review | release sign-off |

No test is claimed as passing by this document. Execution requires explicit approval.

## 10. Execution Rules for the Implementing Engineer

1. Read the phase document in full before editing.
2. Do not start a later phase's schema/API work early.
3. Update tests in the same change as behavior.
4. Preserve historical data; no destructive migration.
5. Use the existing Nuxt module/page/composable patterns; do not introduce a second architecture.
6. Do not add dependencies unless the phase explicitly requires one (none of Phases 1–3 or 5 do; Phase 4 may need only existing gateway SDKs).
7. Do not expose secrets in logs, docs, or errors.
8. Stop and ask if a decision from `../FINAL-DECISIONS.md` or `../ROADMAP-DECISIONS-UPDATE.md` is unapproved or blocks the task.
9. Do not claim completion without running the approved verification commands.
10. Do not implement email verification.
