# Roadmap Decisions Update

**Purpose:** map every final decision in `Docs/FINAL-DECISIONS.md` to the exact roadmap phase/task, identify required roadmap edits, and record contradictions that must be removed before implementation.  
**Status:** documentation only. No application code, schema, migration, config, build, test, container, or Git command was changed.  
**Applied:** the affected roadmap documents have been updated in place so they now use the final decisions consistently. The “before update” wording below records what changed; it is not a description of the current documentation state. The four decisions are owner-approved; implementation verification remains. See [`CONTRADICTION-RESOLUTION-REPORT.md`](CONTRADICTION-RESOLUTION-REPORT.md) for the full audit trail.

## 1. Decision-to-Phase Map

### A. Booking & Payment

| Decision | Status | Affected roadmap phase(s) | Exact tasks/sections | Required roadmap update |
|---|---|---|---|---|
| A1 — 20-minute configurable hold | OWNER-APPROVED | Phase 4 | Task 1 (hold schema/config), Task 6 (initiate/expiry), Task 8 (UI), Phase 6 config checklist | Set default 20, range 5–60, `BOOKING_HOLD_MINUTES`; add tests for config bounds; add patient-facing hold copy; add Phase 6 env validation |
| A2 — expired hold releases slot, no automatic paid cancellation | DECIDED | Phase 4 | Task 1 (`holdExpiresAt`), Task 2 (occupancy), Task 6 (expiry) | Expired hold is not automatically bookable/confirmed; booking remains PENDING; no auto-cancel/cleanup job; no `EXPIRED` status; admin reconciliation filter; paid rows excluded; tests |
| A3 — late success confirms only if slot free; otherwise cancel/refund reconciliation | OWNER-APPROVED | Phase 4 | Task 5 (success), Task 7 (late webhook), Task 8 (success UI), Task 12 (reconciliation) | Apply the final branch table; add free-slot recheck under lock; add cancelled-booking handling; add manual refund query; add tests |
| A4 — legacy unassigned rows preserved, admin-resolvable, no auto assignment | DECIDED | Phase 3, Phase 4 | Phase 3 Task 10; Phase 4 Task 10 and 12; README §Decision A5 context | Clarify admin read access, legacy-only assign, no automatic migration/status rewrite; add legacy filter/query; no deletion |
| A5 — new bookings require doctor; DB nullable; no confirmed reassignment | DECIDED | Phase 3, Phase 4 | Phase 3 Tasks 4, 10; Phase 4 Task 10; `03` Q4/Q9 | Enforce app-level doctor; keep nullable; remove/forbid confirmed reassignment; legacy assign only for `doctorId = null`; admin recovery = cancel/rebook; update tests |

### B. Availability & Rescheduling

| Decision | Status | Affected roadmap phase(s) | Exact tasks/sections | Required roadmap update |
|---|---|---|---|---|
| B1 — doctor Availability is patient-facing source; AdminSchedule is template; global closures/holidays apply to all | DECIDED | Phase 3, Phase 4 | Phase 3 Tasks 1–4; Phase 4 Task 2; `01` §2.2/`03` Q8 | Add exact rule table; ensure `GlobalBlockedDate` is in doctor-aware util; clarify global block does not cancel existing bookings; update tests |
| B2 — AdminSchedule edits affect only new/backfilled doctors | DECIDED | Phase 3 | Task 2 (backfill/onboarding), admin settings copy, `03` Q8 | Remove “propagate” ambiguity; add explicit admin UI copy; add test that schedule edit does not touch existing availability; document future bulk-apply as separate |
| B3 — patient cross-date reschedule, same doctor, 24h; admin any confirmed; doctor none; no doctor change | OWNER-APPROVED | Phase 3, Phase 4 | Phase 3 Tasks 8, 9; Phase 4 Task 5/payment unchanged; `03` Q10 | Implement missing reschedule endpoint; extend booking patch instead of fallback; enforce 24h server-side; atomic target-slot lock; no payment change; notifications; no doctor swap; update tests |

### C. Doctor Dashboard & APIs

| Decision | Status | Affected roadmap phase(s) | Exact tasks/sections | Required roadmap update |
|---|---|---|---|---|
| C1 — calendar + own detail + own notes + session; remove Patients/Profile/peer notes | OWNER-APPROVED | Phase 2 (+Phase 1 session) | Phase 2 Tasks 1–6; Phase 2 scope/out-of-scope; Phase 1 Task 4 staff behavior | Add own-booking notes surface/API; remove profile APIs/photo self-service; remove patient directory/detail APIs; remove peer notes; update DoD and tests; admin profile management note |
| C2 — strict ownership rules for bookings/patient info/notes/join/admit | DECIDED | Phase 1, Phase 2, Phase 4 | Phase 1 Tasks 3–4; Phase 2 Task 6; Phase 3 Task 10; Phase 4 Task 10 | Filter doctor bookings to CONFIRMED/CANCELLED only; remove staff video join; enforce admit identity/window; add denial tests; no client-supplied doctor/patient IDs |

### D. Blog Publishing

| Decision | Status | Affected roadmap phase(s) | Exact tasks/sections | Required roadmap update |
|---|---|---|---|---|
| D1 — first publish sets `publishedAt`; edits/unpublish/republish preserve | DECIDED | Phase 5 | Tasks 1, 3, 6; `01` §3.3, §5.6 | Add exact transition rules and tests; backfill published rows without timestamp from `createdAt`; no scheduling |
| D2 — Unicode-aware generated slugs; suffix collisions; published immutable | DECIDED | Phase 5 | Task 2 (currently ASCII regex), Task 3, Task 6 | Replace ASCII-only validation with Unicode-aware slug helper; add `-2` suffix for generated collisions; 409 for explicit duplicates; immutable after first publish; tests |
| D3 — published-only SSR/no-cache/404 | DECIDED | Phase 5 | Tasks 5, 6, 7; Phase 6 security checklist | Add server-side published-only query helper; no public caching (`no-store` or disabled); draft/unpublished/deleted 404; no preview route; tests for API/SSR/meta |

## 2. Roadmap Sections That Need Updates

### `Docs/Implementation-Roadmap/README.md`

- §8 “Open Product Decisions” is superseded by `Docs/FINAL-DECISIONS.md`; replace with a short link and state that A1, A3, B3, C1 are owner-approved.
- §6/§7 risk bullets should reference the final decisions, especially no auto-cancel of paid holds and no confirmed reassignment.
- Phase table remains valid; no order change.
- Add a note that Phase 2 now includes own-session notes and removes profile/patient APIs.
- Add a note that Phase 3 includes cross-date same-doctor reschedule.

### `Docs/Implementation-Roadmap/00-current-system-analysis.md`

No historical-fact rewrite required. Optionally add a top note: “Current implementation facts are pre-decision; final target is in `Docs/FINAL-DECISIONS.md`.” Do not alter verified current-state claims.

### `Docs/Implementation-Roadmap/01-architecture-and-data-impact.md`

Update:

- §2.1: add “no confirmed reassignment; legacy only.”
- §2.2: exact B1/B2 source-of-truth table and global-block behavior.
- §2.4: staff no video join.
- §3.1: `doctorId` nullable for history; app-level required; no NOT NULL migration.
- §3.2: no automatic AdminSchedule propagation.
- §3.3: `publishedAt` policy and Unicode slug implications.
- §4.2: legacy handling exact.
- §4.3: backfill no propagation.
- §5.2/5.4/5.5: legacy assign only null; doctor status filter; staff no video; reschedule endpoint.
- §5.6: publishedAt/slug/no-cache.
- §8: final late-payment state machine.
- §11: remove “doctorId may become NOT NULL” ambiguity; final: nullable.
- §12: replace the open decision list with links to final decisions and the approved status; only implementation verification remains.

### `Docs/Implementation-Roadmap/02-phase-plan.md`

Update phase summaries and acceptance criteria:

- Phase 1: staff no video; admit identity; C2 rules.
- Phase 2: own notes, remove profile/patient APIs, status filter.
- Phase 3: cross-date same-doctor reschedule; no confirmed reassignment; AdminSchedule default-only; B1 rule table.
- Phase 4: 20-minute hold; no auto-cancel paid; late success branch; legacy-only assign; no reassignment.
- Phase 5: publishedAt/Unicode/no-cache.
- Phase 6: config `BOOKING_HOLD_MINUTES`; decision sign-off.

### `Docs/Implementation-Roadmap/03-risks-and-open-questions.md`

Add a top banner: “Q1–Q12 are resolved by `Docs/FINAL-DECISIONS.md`; this file is retained for risk context.”  
Replace/annotate:

- Q1 resolved: 20 minutes.
- Q2 resolved: legacy queue/no auto changes.
- Q3 resolved: late success branch.
- Q4 resolved: nullable DB.
- Q5 resolved: own notes retained, patients/profile removed, peer notes removed.
- Q6 resolved: plain text + BLOG.
- Q7 resolved: in-clinic confirmed.
- Q8 resolved: default-only propagation.
- Q9 resolved: no confirmed reassignment.
- Q10 resolved: cross-date same doctor, 24h patient.
- Q11 resolved: no staff video.
- Q12 resolved: patient name/email in own detail; no directory.

### Individual phase documents

- `PHASE-01-session-reentry.md`: add staff no-video rule and identity/window tests; already partially present.
- `PHASE-02-doctor-workspace-simplification.md`: replace open API disposition with C1; add own notes; remove profile/photo/patient APIs; add status filter; update scope/DoD.
- `PHASE-03-doctor-booking-foundation.md`: add B1 table, B2 no propagation, B3 cross-date endpoint, A4/A5 legacy/reassignment rules; update reschedule and admin assignment tasks/tests.
- `PHASE-04-payment-confirmation-lifecycle.md`: replace A1/A2/A3 open defaults with final; add late-success branch, legacy-only assign, no reassignment; update tests/acceptance.
- `PHASE-05-blog-management.md`: replace ASCII slug with Unicode; add publishedAt transitions, no-cache, 404, tests; keep plain-text.
- `PHASE-06-release-hardening.md`: add owner-approval checklist, hold config, reschedule, notes removal, legacy and reassignment checks.

## 3. Acceptance Criteria Changes

Add or change the following:

### Phase 1

- Add: staff cannot join a LiveKit room; no staff token/admit path.
- Add: doctor admit verifies patient identity exactly.
- Existing exact-end and token TTL criteria remain.

### Phase 2

- Add: doctor can read/write notes only for own bookings; no peer notes.
- Add: doctor booking list shows only `CONFIRMED`/`CANCELLED`, not unpaid `PENDING`.
- Add: patient directory/detail APIs are not available to doctors.
- Add: doctor profile self-edit/photo endpoints are not available; admin manages profile text.
- Add: existing notes rows preserved.

### Phase 3

- Add: patient reschedules cross-date, same doctor, up to 24h before start, with no payment change.
- Add: admin reschedules any confirmed booking with permission; doctor cannot.
- Add: no doctor change through reschedule.
- Add: simultaneous reschedule conflict test.
- Add: AdminSchedule edit does not modify existing doctor availability.
- Add: global blocked date does not automatically cancel existing confirmed bookings.
- Remove: “same-day only” recommendation.
- Remove: any “admin may reassign confirmed doctor” implication.

### Phase 4

- Add: 20-minute default hold (5–60 range).
- Add: expired hold releases slot but does not auto-cancel paid rows.
- Add: late success with free slot confirms; occupied slot cancels + manual refund; cancelled booking stays cancelled.
- Add: duplicate late webhooks idempotent.
- Add: no confirmed reassignment.
- Add: legacy-only assign.
- Add: patient cancel refunds only SUCCESS.
- Add: admin reconciliation query for paid-not-confirmed.

### Phase 5

- Add: `publishedAt` transition tests.
- Add: Unicode slug generation/duplicate/immutability tests.
- Add: no-cache/draft 404/SSR/meta tests.
- Remove: ASCII-only slug regex.

### Phase 6

- Add: owner approvals recorded.
- Add: `BOOKING_HOLD_MINUTES` production check.
- Add: reschedule and notes surface regression tests.
- Add: legacy resolution and no-reassignment checks.
- Add: blog draft/no-cache checks.

## 4. Dependencies Introduced or Clarified

1. **Phase 4 depends on Phase 3 more strongly now:** A1/A2/A3 operate on the doctor-linked booking and doctor-specific availability from Phase 3.
2. **C1 depends on C2:** the own-notes UI/API must use the ownership rules; the patient directory/profile API removal must be done together with layout/nav changes.
3. **B3 depends on B1 and Phase 4 status rules:** confirmed online bookings must be stable before reschedule can move them without a new payment.
4. **A3 depends on B1 and Phase 4 slot locking:** the free-slot recheck uses the same occupancy predicate and lock.
5. **D1/D2/D3 are independent of booking** but must be implemented together; do not ship a public page before published-only filtering and slug policy are complete.
6. **Phase 6 depends on implementation verification**; the A1/A3/B3/C1 owner approvals are recorded.

## 5. Contradictions to Remove

### Roadmap-internal

1. **Phase 2 “calendar-only” vs C1 own notes.** Before the update, Phase 2 removed patient pages/notes but left API retention open. Final: keep own notes in booking detail; remove patient directory/profile/peer notes; add a new notes surface. Phase 2 scope and tests are updated.
2. **Phase 3 Task 9 “same-day only recommended” vs B3 cross-date.** Final: implement cross-date, same-doctor reschedule. Remove the same-day-only recommendation and the silent fallback.
3. **Phase 4 Task 6/7 open hold/late-webhook wording vs A2/A3.** Final: 20-minute hold, no auto-cancel of paid rows, exact late-success branch. Remove “recommended/optional” language.
4. **Phase 3/4 legacy assign vs A4/A5.** Final: legacy assign only for `doctorId = NULL`; no confirmed reassignment; no automatic doctor assignment. Remove any implication that normal pending bookings need manual approval.
5. **Phase 3/README Q8 propagation vs B2.** Final: default-only, no propagation. Remove “apply to all” as an active option; keep as a future separate feature.
6. **Phase 5 Task 2 ASCII slug regex vs D2 Arabic titles.** Final: Unicode-aware slugs and immutable published slugs. Replace the regex and add collision/immutability tests.
7. **Phase 5 no publishedAt policy vs D1.** Final: first publish sets, later edits/unpublish/republish preserve. Add to task 3 and tests.
8. **Phase 5 no caching policy vs D3.** Final: no public caching in first release; 404 for drafts/unpublished/deleted. Add to tasks 5–7.
9. **Phase 2/3 doctor API retention vs C1.** Final: remove patient directory/profile/photo self-service; keep own notes. Update Phase 2 Task 5 from “open decision” to fixed.
10. **Phase 4 normal assignment removal vs legacy remediation.** Final: no normal assignment; legacy-only endpoint may remain. Update UI/acceptance.

### Roadmap vs current implementation (expected gaps, not current-behavior claims)

These are not contradictions in the plan; they are implementation gaps the phases must close:

- Current `create.post.ts` stores `doctorId: null`; final requires doctor.
- Current payment success leaves booking `PENDING`; final auto-confirms.
- Current in-clinic booking stays `PENDING`; final confirms immediately (Phase 4).
- Current meeting window closes at end + 15; final closes at exact end.
- Current doctor admit has no window/identity check.
- Current doctor bookings endpoint returns all statuses; final returns confirmed/cancelled only.
- Current doctor patient/notes/profile APIs expose surfaces that final C1 removes.
- Current `/api/booking/[id].patch` has no 24-hour server check; final B3 requires it.
- Current dashboard calls a missing cross-date reschedule endpoint; final B3 implements it.
- Current global availability ignores `Doctor.Availability`; final B1 uses it.
- Current `availability.ts` ignores `GlobalBlockedDate`; final B1 fixes it.
- Current patient cancel refunds failed/pending payments; final Phase 4 fixes to SUCCESS-only.
- Current `/meeting` lobby is a timeout-only stub; final uses the canonical session lobby.
- Current blog does not exist; final Phase 5 adds it.

## 6. Owner Approvals Still Required

Only four decisions:

1. **A1** — 20-minute payment hold.
2. **A3** — late successful payment / manual refund policy.
3. **B3** — cross-date rescheduling and 24-hour policy.
4. **C1** — own notes retained; patient directory/profile/peer notes removed.

All other decisions are marked DECIDED and do not require separate business approval. If the owner rejects any recommended default, update `FINAL-DECISIONS.md`, this mapping, and the affected phase before implementation.

## 7. Roadmap Update Order

1. Approve A1, A3, B3, C1.
2. Update `Docs/Implementation-Roadmap/README.md` and `03-risks-and-open-questions.md` to point to final decisions.
3. Apply targeted updates to Phases 1–6 listed above.
4. Re-run a documentation consistency check (no code/test execution required).
5. Start Phase 1 only after approval.
