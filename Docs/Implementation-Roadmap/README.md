# Tawasul Academy — Implementation Roadmap

**Status:** Phase 1 implementation code and tests are written but **unverified**; Phases 2–6 are not started. No build, automated test, browser check, container, migration, or Git command was executed during implementation.  
**Final decisions:** see [`../FINAL-DECISIONS.md`](../FINAL-DECISIONS.md) and [`../ROADMAP-DECISIONS-UPDATE.md`](../ROADMAP-DECISIONS-UPDATE.md). A1 (20-minute hold), A3 (late payment/refund), B3 (rescheduling), and C1 (doctor notes/profile scope) are owner-approved. The open questions in this folder are superseded by those documents.  
**Baseline inspected:** current working tree on 2026-11-08, plus `PROJECT-CURRENT-STATE.md`, `PROJECT_SUMMARY.md`, `project overview/PRD-ASBUILT.md`, `project overview/CHANGES.md`, `project overview/admin_panel_report.md`, `project overview/bugs/*`, and the actual booking/payment/doctor/admin/session source files.  
**Note:** There is no `Docs/` directory in the baseline; the project documentation lives under `project overview/`. This roadmap creates the requested `Docs/Implementation-Roadmap/` tree.

## 1. Project Objective

Implement the approved changes for:

1. A booking flow where the patient chooses a doctor, availability is doctor-specific, and the booking is automatically linked to that doctor.
2. A doctor experience reduced to a focused appointment calendar with server-enforced data isolation.
3. A minimal admin-managed blog with public listing and article pages.
4. Repeatable patient LiveKit session entry before the appointment end time, always through the waiting lobby and doctor admission.
5. Registration remains exactly as it currently works: **no email verification work is included anywhere in this roadmap.**

## 2. Current System Baseline (Verified Summary)

- **Stack:** Nuxt 3 (Vue 3 + TypeScript), Nitro/H3 API routes, PostgreSQL + Prisma 5.22, Tailwind + shadcn-vue, Zod, JWT HttpOnly cookie auth, LiveKit self-hosted, FullCalendar, Resend, Paymob/Stripe, Docker Compose. **CONFIRMED** in `package.json`, `nuxt.config.ts`, `prisma/schema.prisma`, and compose files.
- **Booking currently:** patient chooses a time from a shared `AdminSchedule`; `POST /api/booking/create` stores `doctorId: null` and status `PENDING`; admin later assigns a doctor via `PATCH /api/admin/bookings/:id/assign`, which sets `CONFIRMED`. **CONFIRMED** in `server/utils/admin-availability.ts`, `modules/booking/server/api/booking/create.post.ts`, and `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts`.
- **Per-doctor `Availability` exists but is not used by patient booking.** A separate `server/utils/availability.ts` already contains doctor-aware slot/date logic, but its booking callers were replaced by the global scheduler. It also does not subtract `GlobalBlockedDate`. **CONFIRMED** by tracing all callers.
- **Payment currently:** online booking creates `Payment{PENDING}`; the payment webhook marks `Payment` `SUCCESS` but deliberately leaves the booking `PENDING` until admin assignment. Dev mock completion does the same. **CONFIRMED** in `server/utils/booking-status.ts` and `modules/payment/server/api/payment/*`.
- **Doctor dashboard currently:** three nav destinations — My Calendar, My Patients, My Profile. It also exposes patient directory, patient detail, private/peer notes, and profile editing APIs. The calendar endpoint is already scoped to the authenticated doctor. **CONFIRMED** in `layouts/doctor-layout.vue`, `modules/doctor/pages/doctor/*`, and `modules/doctor/server/api/doctor/bookings.get.ts`.
- **Session currently:** patient receives a LiveKit member token with `canPublish: false` and `canSubscribe: false`; the patient page is a waiting room; the doctor admits by updating participant permissions through `RoomServiceClient.updateParticipant`. Re-entry is architecturally possible, but the window closes **15 minutes after the appointment end** and the doctor-admit endpoint has no window check. Token TTL is fixed at 3600 seconds. `/meeting/:id/lobby` is a non-functional stub whose Join button only starts a timeout. **CONFIRMED** in `server/utils/meeting.ts`, `server/utils/livekit-token.ts`, `pages/dashboard/session/[bookingId].vue`, `modules/doctor/.../admit.post.ts`, and `pages/meeting/[meetingId]/lobby.vue`.
- **Blog:** no Prisma model, no API, no admin page, and no public page exist. The old PRD lists blog as v2/deferred. **CONFIRMED** by schema and repository search.
- **Automated tests:** Vitest and Playwright suites exist for current behavior, including assertions of the old booking behavior (`PENDING`, `doctorId: null`) and the 15-minute post-end join window. They must be updated in the phases that change those behaviors. **CONFIRMED** in `tests/api/booking`, `tests/api/payment`, `tests/utils/meeting.test.ts`, and `tests/e2e/booking.spec.ts`.

## 3. Phase Index and Recommended Execution Order

| Order | Phase | File | Primary Requirement | Dependency |
|---|---|---|---|---|
| 1 | Session Re-entry & Join-Window Enforcement | `phases/PHASE-01-session-reentry.md` | D | None (uses existing booking/session contracts) |
| 2 | Doctor Workspace Simplification & Access Hardening | `phases/PHASE-02-doctor-workspace-simplification.md` | B | None; C1 owner approved |
| 3 | Doctor-Based Booking Foundation | `phases/PHASE-03-doctor-booking-foundation.md` | A (part 1) | Phase 2 for the doctor UI; B3 owner approved |
| 4 | Payment-Driven Confirmation & Booking Lifecycle | `phases/PHASE-04-payment-confirmation-lifecycle.md` | A (part 2) | Phase 3; A1/A3 owner approved |
| 5 | Blog Management & Public Content | `phases/PHASE-05-blog-management.md` | C | Phase 2 for admin nav patterns; otherwise independent |
| 6 | Integration, Regression & Release Readiness | `phases/PHASE-06-release-hardening.md` | All | Phases 1–5 |

**Recommended order:** 1 → 2 → 3 → 4 → 5 → 6.

**Important release constraint:** Phases 3 and 4 are separate implementation/verification units but should ship in the same production release window. Phase 3 changes the booking source of truth to the doctor; Phase 4 removes the old admin-approval semantics. Deploying Phase 3 alone is safe only for internal/staging use.

Phase 5 can run in parallel with Phases 3–4 by a separate engineer because it does not touch booking, payment, or session tables. It is placed after Phase 4 only because booking is business-critical.

## 4. Overall Dependency Graph

```
Phase 1 (Session re-entry)  ───────────────┐
                                          ├──> Phase 6 (Integration/release)
Phase 2 (Doctor simplification) ──────────┤
        │                                 │
        v                                 │
Phase 3 (Doctor booking foundation) ──────┤
        │                                 │
        v                                 │
Phase 4 (Payment confirmation lifecycle) ─┤
                                          │
Phase 5 (Blog) ───────────────────────────┘
```

Hard dependencies:

- Phase 4 requires Phase 3's doctor-linked bookings and doctor-specific availability.
- Phase 6 requires all earlier phases.
- Phase 3's booking UI work should not be started before Phase 2's doctor navigation cleanup is merged, otherwise two teams will edit the same doctor layout.
- Phase 5's admin permission work reuses the existing PermissionBuilder and `staff-only` path mapping; it does not require booking phases.

## 5. Prioritization and Risk Scoring

Scores are 1 (low) to 5 (high). Ordering follows the user's rule: Security Risk 5 first, then Business Impact, then UX Severity, then Technical Risk.

| Phase | Business Impact | Technical Risk | UX Severity | Security Risk | Reason |
|---|---:|---:|---:|---:|---|
| 1 — Session re-entry | 5 | 2 | 5 | 5 | Wrong-time or repeat access to a clinical room is a privacy/access-control boundary. Small, isolated change. |
| 2 — Doctor simplification | 4 | 2 | 4 | 5 | Removes unnecessary PHI surfaces from the doctor experience and verifies server-side doctor isolation. Low technical risk. |
| 3 — Booking foundation | 5 | 5 | 5 | 4 | Changes the source of truth for availability and doctor assignment. High data/logic risk, but no payment-state rewrite yet. |
| 4 — Payment lifecycle | 5 | 5 | 4 | 5 | Money and confirmation correctness; double booking/duplicate webhooks are security-adjacent. Depends on Phase 3. |
| 5 — Blog | 2 | 2 | 3 | 3 | Low business criticality; draft/published enforcement and XSS safety are the main risks. |
| 6 — Release hardening | 5 | 2 | 2 | 5 | Final gate for migrations, access checks, and production flags. |

Why this order minimizes risk and rework:

1. Phases 1 and 2 are independent, small, and reduce the attack surface before the booking data model changes.
2. Phase 3 establishes the new doctor-linked source of truth once; Phase 4 then changes only payment/status transitions on top of it. This avoids editing the same creation endpoint twice in conflicting ways.
3. The blog is independent and deliberately last, so it cannot block the business-critical booking/payment work.
4. Phase 6 is a release gate, not a feature phase, and includes migration rehearsal and regression checks that need the final code.

## 6. Critical Architectural Changes

1. **Effective doctor schedule becomes authoritative for patient booking.**
   - Keep `AdminSchedule` + `GlobalBlockedDate` as the clinic-wide default/closure template.
   - Backfill `Doctor.Availability` for existing doctors with no rows from active `AdminSchedule` rows.
   - Copy the active default schedule into `Doctor.Availability` when a new doctor is created.
   - Patient slots read `Doctor.Availability` + `Doctor.BlockedSlot` + `GlobalBlockedDate` + public holidays, minus active `Booking` rows.
2. **A new booking always has a doctor.** `Booking.doctorId` already exists and is nullable; the API requires a valid active doctor for every new booking. The column remains nullable permanently for historical rows; no `NOT NULL` migration is planned in this roadmap.
3. **No normal admin/doctor approval and no confirmed reassignment.** Online booking becomes `CONFIRMED` only on a verified successful payment; in-clinic becomes `CONFIRMED` at creation. New bookings carry their doctor; confirmed doctor changes are not supported (cancel and rebook instead).
4. **Pending online attempts are time-boxed reservations.** The recommended default is a configurable 20-minute hold (`BOOKING_HOLD_MINUTES`, 5–60 range, owner approved). Expiry releases the slot but does not auto-cancel a booking; late successful payments recheck the slot and use manual refund/reconciliation if it is taken.
5. **Session lobby is the existing patient session waiting room.** `/dashboard/session/[bookingId]` already implements the waiting-room/admit state machine. The unused `/meeting/:id/lobby` stub is not a second lobby; Phase 1 will either redirect it into the canonical session route or make its Join action delegate correctly. Staff do not join video rooms.
6. **Blog is a small first-party Prisma feature, not a CMS.** Plain-text content renders without `v-html`; no new CMS dependency is introduced. Published slugs are immutable and Unicode-aware.
7. **RBAC resource `BLOG`** is the chosen resource so blog management can be granted independently of settings/staff permissions.
8. **Doctor workspace is calendar + own booking detail + own notes + session access.** Patient directory, doctor self-profile, peer notes, and profile self-service are removed; existing note rows are preserved. C1 is owner-approved.
9. **Phase 1 session hardening is durable and server-enforced.** Each patient entry rotates `SessionRoom.currentEntryId`; admission is bound to the current entry and LiveKit SID. At exact end, a server-side `deleteRoom` disconnects participants; `terminatedAt` + startup/fallback sweeps make termination idempotent and restart-recoverable.

## 7. Critical Risks

- **Legacy data:** existing `doctorId: null` bookings cannot be made non-null without a product decision. The plan preserves history and enforces doctor presence at the API layer.
- **Abandoned payments / holds:** without a hold policy, either slots are blocked forever or the same slot can be double-booked. This is a product decision before Phase 4.
- **Concurrency:** client-side slot checks are not sufficient. Phase 4 requires a database-level serialization/advisory-lock strategy around create/payment confirmation.
- **Delayed webhooks:** resolved by `FINAL-DECISIONS.md` A3: recheck the slot; if free, confirm; if occupied, keep the successful payment, cancel the booking, and require manual reconciliation/refund. Never double-book or auto-refund.
- **LiveKit re-entry:** tokens are bounded to the remaining window, patient entries rotate server-side, and old-token reconnects with a new LiveKit SID are rejected/removed. The room is forcibly deleted at the exact end; the in-process scheduler is backed by a durable `terminatedAt` marker and startup/30s sweeps. A malicious client can still connect to the waiting room with an unexpired old token but cannot get media/admission.
- **Test drift:** current tests explicitly assert old booking and +15-minute behavior. Each phase must update tests in the same change.
- **Doctor notes/profile:** resolved by C1 (owner-approved): doctors keep notes only for their own bookings; patient directory, self-profile, and peer notes are removed; historical note data is preserved.

## 8. Decision Status

All design questions have a documented resolution in `../FINAL-DECISIONS.md` and a phase mapping in `../ROADMAP-DECISIONS-UPDATE.md`; four resolutions are owner-approved.

**DECIDED without separate owner approval:** A2, A4, A5, B1, B2, C2, D1, D2, D3.

**OWNER-APPROVED:**

1. **A1** — 20-minute payment hold, configurable 5–60 minutes.
2. **A3** — late successful payment policy and manual refund/reconciliation.
3. **B3** — same-doctor cross-date rescheduling with a 24-hour patient limit.
4. **C1** — retain own booking notes; remove patient directory, self-profile, and peer notes.

The four decisions are recorded as approved in `../OWNER-APPROVAL-REQUIRED.md`; implementation may proceed subject to each phase's prerequisites and verification gates.

## 9. Current Planning Status

- Current system analysis: complete for the code touched by these requirements.
- Architecture/data impact: complete at design level; no migration SQL authored.
- Phase breakdown: complete.
- **Phase 1:** hardened implementation, a new `SessionRoom` migration (authored, not applied), and focused tests are written; **not verified** (no migration/prisma generate/test/build/browser/manual run executed). It is not complete until approved verification passes.
- Phases 2–6: implementation not started.
- Phase 1 has no owner-approval dependency. Phases 2–4 have the required C1/B3/A1/A3 owner approvals; they may proceed after their code prerequisites and verification gates.
- No verification build/test was run during implementation, per instructions.

## 10. Documentation Set

- `00-current-system-analysis.md` — verified baseline and flow traces.
- `01-architecture-and-data-impact.md` — target design, schema/API/auth impacts, migration considerations.
- `02-phase-plan.md` — full ordered phase summary and cross-phase tasks.
- `phases/PHASE-01-session-reentry.md`
- `../PHASE-01-session-reentry.md` — root implementation-status summary
- `phases/PHASE-02-doctor-workspace-simplification.md`
- `phases/PHASE-03-doctor-booking-foundation.md`
- `phases/PHASE-04-payment-confirmation-lifecycle.md`
- `phases/PHASE-05-blog-management.md`
- `phases/PHASE-06-release-hardening.md`
- `03-risks-and-open-questions.md`
- `../FINAL-DECISIONS.md` — resolved decisions and statuses.
- `../ROADMAP-DECISIONS-UPDATE.md` — decision-to-phase mapping.
- `../OWNER-APPROVAL-REQUIRED.md` — owner approval record (A1/A3/B3/C1 approved).
- `../CONTRADICTION-RESOLUTION-REPORT.md` — audit trail of contradictions and updates.
