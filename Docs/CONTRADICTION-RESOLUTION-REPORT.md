# Contradiction Resolution Report

**Task:** documentation-only audit and in-place update of the Tawasul decision/roadmap documents.  
**Authority order used:** owner-approved decisions → `FINAL-DECISIONS.md` → `ROADMAP-DECISIONS-UPDATE.md` → phase documents → older analysis/risk documents.  
**Restrictions honored:** no application code, Prisma schema, migration, API implementation, test, dependency, container, build, browser automation, registration/auth change, email verification, or Git command was changed/executed.

> **Post-audit status update:** A1, A3, B3, and C1 have since been approved by the business owner. The “OWNER APPROVAL PENDING” labels in the historical table below record the state at audit time; they are not the current status. See `FINAL-DECISIONS.md` and `OWNER-APPROVAL-REQUIRED.md` for the approved record.

## 1. Summary

- **26 contradiction clusters found.**
- **18 resolved using decisions already marked DECIDED.**
- **8 clusters resolved to one consistent rule; they required the four owner approvals (A1, A3, B3, C1), which have since been recorded.**
- **0 additional unresolved questions** were discovered that lack a documented resolution path.
- The roadmap is now **internally consistent** with the final decision set, but it is **not fully implementation-ready** until the four owner approvals are recorded.

## 2. Contradictions and Resolutions

| # | Contradiction / ambiguity | Documents and sections affected | Final resolution | Status |
|---|---|---|---|---|
| 1 | Phase 4 allowed `BOOKING_HOLD_MINUTES` 5–120; FINAL A1 says 5–60. Phase 4/README also called the recommendation “approved” before owner approval. | `FINAL-DECISIONS.md` A1; `PHASE-04...` Task 1; `README.md` §6; `ROADMAP-DECISIONS-UPDATE.md` A1 | Default **20**, range **5–60**; all docs call it recommended/pending, not approved. | **OWNER APPROVAL PENDING (A1)** |
| 2 | Phase 4 mentioned a “recommended cleanup job/timer” and acceptance referenced concurrent cleanup; FINAL A2 says no automatic cleanup and no auto-cancel. | `PHASE-04...` Tasks 1, 6; acceptance; `01...` §8; `03...` R4 | Expiry frees slot only; booking remains `PENDING`; no auto cleanup/cancel; admin-only explicit cleanup excludes `Payment.SUCCESS`; no `EXPIRED` status. | Resolved by DECIDED A2 |
| 3 | Phase 4 left late-success policy “only if D3 approves”; FINAL A3 defines the branch table. It also said “mark for manual refund” without the explicit cancelled/reconciliation state, and could be read as allowing auto-refund. | `PHASE-04...` Tasks 5, 7, 8, 12; `01...` §8; `03...` R4 | Late success: free slot → confirm; occupied → do not double-book, keep `Payment.SUCCESS`, set `Booking.CANCELLED` reconciliation state; already cancelled → no confirm; manual refund only; no auto-refund. | **OWNER APPROVAL PENDING (A3)** |
| 4 | Legacy `PENDING` with `holdExpiresAt = NULL` was described as “decide before deployment” in Phase 4 and as generic legacy in A4. | `FINAL-DECISIONS.md` A2/A4; `PHASE-04...` Task 1; `01...` §4.2/§7 | Null-hold legacy rows remain blocking/admin-visible until explicit resolution; no auto assignment/confirmation/deletion. | Resolved by DECIDED A2/A4 |
| 5 | Roadmap/architecture discussed a future `Booking.doctorId NOT NULL` migration; FINAL A5 says nullable permanently. | `01...` §3.1/§4.2/§12; `02...` §6; `README.md` §6 | Database remains nullable; only the application requires doctorId for new bookings. No NOT NULL migration in this roadmap. | Resolved by DECIDED A5 |
| 6 | Phase 3 Task 10 mentioned a “future reassignment decision”; FINAL A5 says no confirmed reassignment; admin recovery is cancel + rebook. | `PHASE-03...` Task 10/acceptance; `PHASE-04...` Task 10; `01...` §4.2/§5.2; `02...` §7 | No confirmed reassignment API/UI; legacy unassigned assignment remains the only manual exception. | Resolved by DECIDED A5 |
| 7 | `server/utils/availability.ts` omits `GlobalBlockedDate`, while B1 says it applies globally. Phase 3 tests listed global blocks but current util did not. | `01...` §2.2/§7; `PHASE-03...` Task 1; `PHASE-04...` Task 2 | Doctor-aware availability must subtract `GlobalBlockedDate` and holidays, plus doctor blocks/bookings/holds; tests required. | Resolved by DECIDED B1 |
| 8 | It was unclear whether a `GlobalBlockedDate` cancels existing confirmed bookings. | `FINAL-DECISIONS.md` B1; `01...` §2.2/§7; `03...` R2 | Global block stops **new** bookings only; existing confirmed bookings are not silently cancelled; admin handles them explicitly. | Resolved by DECIDED B1 |
| 9 | Phase 3/README left AdminSchedule propagation open (Q8); FINAL B2 says default-only, no propagation. | `PHASE-03...` Task 2; `01...` §3.2; `02...` §8; `03...` Q8; `README.md` §8 | AdminSchedule edits affect only new/backfilled doctors; existing custom availability is never overwritten; future bulk-apply is separate. | Resolved by DECIDED B2 |
| 10 | Phase 3 Task 2 left “block doctor creation if no AdminSchedule” as an open product question. | `PHASE-03...` Task 2; `01...` §3.2 | Do not block doctor creation; create without availability, warn admin, require explicit schedule setup. | Resolved by DECIDED B2 |
| 11 | Phase 3 Task 9 recommended same-day-only rescheduling; FINAL B3 requires cross-date, same-doctor rescheduling. | `PHASE-03...` Task 9; `01...` §5.1; `02...` Phase 3; `03...` Q10 | Cross-date same-doctor reschedule; patient >=24h before original start; admin any confirmed before start; no doctor change; payment unchanged. | **OWNER APPROVAL PENDING (B3)** |
| 12 | Phase 3 said “do not reschedule within 24h if the current API enforces it”; the current `[id].patch` API has no 24h server check. | `PHASE-03...` Task 9; `01...` §5.1; `03...` Q10 | Server must enforce 24h against the original appointment start; client-only is insufficient. | **OWNER APPROVAL PENDING (B3)** |
| 13 | The UI calls a missing `/api/patient/appointments/:bookingId/reschedule`; no admin reschedule endpoint/UI exists; doctors had no explicit prohibition. | `PHASE-03...` Task 9; `01...` §5.1; `02...` Phase 3; `PHASE-06...` E2E | Implement patient and admin reschedule endpoints; doctor has no reschedule endpoint; atomic lock/revalidation; failure leaves original unchanged. | **OWNER APPROVAL PENDING (B3)** |
| 14 | Phase 2 left doctor patient/notes/profile API retention open (option A/B); FINAL C1 fixes removal from the doctor surface. | `PHASE-02...` Task 5/§7; `01...` §5.4; `00...` tests note; `03...` Q5 | Remove patient directory/detail, peer notes, and self-profile/photo APIs from the doctor surface; preserve data; admin manages profile text. | **OWNER APPROVAL PENDING (C1)** |
| 15 | Phase 2 said “calendar-only” and removed notes surfaces, while FINAL C1 keeps the doctor’s own notes for own bookings. | `PHASE-02...` scope/tasks/acceptance; `01...` §2.3; `02...` Phase 2 | Keep own notes in booking detail; add own-booking note API; remove peer/patient-wide notes; preserve rows. | **OWNER APPROVAL PENDING (C1)** |
| 16 | Phase 2 left patient email/phone visibility as an open product question and profile/photo management unresolved. | `PHASE-02...` UI/risks; `FINAL-DECISIONS.md` C1/C2; `03...` Q12; `01...` §5.4 | Own booking detail may show patient name + email needed for the appointment; no directory/phone; doctor self-profile/photo removed; admin profile text remains. | **OWNER APPROVAL PENDING (C1)** |
| 17 | Doctor bookings endpoint returns all statuses, including unpaid PENDING; C2 says doctor sees only own confirmed/cancelled appointments. | `01...` §5.4; `PHASE-02...` Task 6; `02...` Phase 2; `PHASE-06...` 4.4 | Filter doctor booking list/detail to own `CONFIRMED`/`CANCELLED`; unpaid holds are not doctor appointments. | Resolved by DECIDED C2 |
| 18 | Lobby supported a `staff` role; it was unclear whether staff can join video. C2 says no staff video. | `PHASE-01...` Task 4/tests; `01...` §2.4/§6; `PHASE-06...` 4.3; `03...` Q11 | Staff may read lobby metadata but receive no token/admit path and cannot join the video room. | Resolved by DECIDED C2 |
| 19 | Phase 5 had no `publishedAt` transition policy; it mentioned clearing or retaining according to an undefined product policy. | `PHASE-05...` Tasks 1, 3, 6; `01...` §3.3; `03...` Q6 | First publish sets `publishedAt`; edits/unpublish/republish preserve it; `updatedAt` tracks edits; no scheduling. | Resolved by DECIDED D1 |
| 20 | Phase 5 used an ASCII-only slug regex, could produce empty slugs for Arabic titles; duplicate and post-publication slug behavior were undefined. | `PHASE-05...` Task 2; `01...` §3.3; `03...` Q6 | Unicode-aware slug helper; generated collisions suffix `-2`/`-3`; explicit duplicates 409; draft editable; published immutable; Arabic URLs supported. | Resolved by DECIDED D2 |
| 21 | Phase 5 conditionally used `publishedAt <= now` as a gate and had no cache decision; drafts could potentially leak through cache/SSR. | `PHASE-05...` Tasks 5–7; `01...` §5.6; `03...` D3; `PHASE-06...` 4.5 | Visibility is `status=PUBLISHED` only; published-only server queries for API/SSR/meta; no shared cache (`no-store`/disabled); draft/unpublished/deleted 404. | Resolved by DECIDED D3 |
| 22 | Phase 5 left future publication scheduling as an open question; D1/D3 say no scheduling in this release. | `PHASE-05...` out-of-scope/Task 7 | No scheduled publication; no future `publishedAt`; status is the visibility authority. | Resolved by DECIDED D1/D3 |
| 23 | Roadmap decision registers (`README`, `03`, `00` notes, `01` §12, `02` §8) still presented Q1–Q12/D1–D3 as open after FINAL decisions existed. | `README.md` §8; `03...` §§4–7; `00...` note; `01...` §12; `02...` §8 | Registers replaced/annotated with final decision statuses; four owner approvals called out; older options retained only as historical context. | Resolved editorially (four approvals tracked) |
| 24 | Phase 6 release checks used vague “late webhook policy as decided”, “retained profile/patient/notes”, and did not include reschedule/publishedAt/slug/no-cache gates. | `PHASE-06...` 4.2–4.6, 5, 7 | Added exact A2/A3 checks, no-auto-refund/cleanup, legacy/no-reassign, own-notes, reschedule, publishedAt/Unicode/no-cache, and owner-approval gate. | Resolved editorially (owner approvals tracked) |
| 25 | Requirement labels “A1/A2” in the phase plan collided with decision IDs A1/A2, and “D1–D3” was used for both decision gates and blog decisions. | `02...` phase table/§8; `PHASE-04...` prerequisites; `README.md`/phase headers | Requirement labels changed to “A (part 1) / A (part 2)”; decision gates now reference A1/A3/A2 explicitly; blog decisions D1–D3 are distinct. | Resolved editorially |
| 26 | Phase 4 Task 2 said “failed holds are not occupied”, but a failed payment leaves `Booking=PENDING` with an active hold so the patient can retry before expiry. This could free the slot prematurely. | `PHASE-04...` Task 2/6; `FINAL-DECISIONS.md` A2 | A `PENDING` booking with `Payment=FAILED` **still occupies** while `holdExpiresAt` is active; only cancelled/expired holds free the slot. | Resolved by DECIDED A2 |

## 3. Detailed Consistency Checks

### A. Payment hold/expiry/late success

The updated documents now consistently state:

1. **Unpaid hold expires:** slot becomes bookable; booking stays `PENDING`; no automatic cancellation/cleanup; no `EXPIRED` status; admin reconciliation only; expired row is not a doctor appointment.
2. **Payment succeeds before expiry:** verified signature → transaction/row lock → `Payment.SUCCESS` + `Booking.CONFIRMED` when the slot is still valid; emails once; duplicates idempotent.
3. **Payment succeeds after expiry:** recheck the slot under lock; if free, confirm; if occupied, no double booking, keep `Payment.SUCCESS`, set `Booking.CANCELLED` reconciliation state, manual refund/rebooking; if already cancelled, do not resurrect.
4. **No automatic refund** exists; operators refund through the provider and update `Payment.REFUNDED` only after completion.
5. **Paid rows are never auto-cancelled/refunded by expiry or cleanup.**
6. **No second confirmed booking** for the same doctor/date/time.
7. Historical payment/booking rows remain; reconciliation query: `Payment.SUCCESS AND Booking.status != CONFIRMED`.

All related Phase 4/6 sections and `01` state machine now match.

### B. Rescheduling

Updated documents now consistently state:

- Patient: own `CONFIRMED` booking only, **at least 24 hours before the original start**, same doctor, same session type, cross-date allowed, no payment change.
- Admin: any non-cancelled confirmed booking, `APPOINTMENTS:UPDATE`, same doctor, target available, no 24h limit but not after start.
- Doctor: no reschedule.
- No doctor change; cancel + rebook under A5.
- PENDING/unpaid and CANCELLED cannot reschedule.
- Target validation: doctor availability, BlockedSlot, GlobalBlockedDate, holiday, active occupancy.
- Original slot released atomically; concurrency lock; second attempt 409; failure leaves original intact.
- Missing patient/admin endpoints and UI are now explicitly in Phase 3; the silent same-day fallback is removed.
- Tests/Phase 6 E2E include cross-date, 24h, cross-doctor rejection, concurrency.

B3 remains owner-approved.

### C. Doctor workspace

Updated documents now consistently state:

- Calendar + own booking detail + own notes + session access.
- Own bookings only; `CONFIRMED`/`CANCELLED`; no unpaid PENDING holds.
- Own notes only; no peer notes; note data preserved; new own-booking notes API.
- Patient directory/detail and doctor self-profile/photo APIs removed from the doctor surface.
- Admin profile text management remains; existing photos remain; photo-management gap documented.
- Server ownership: derived doctor ID, booking/patient/note/session checks, admit identity/window.
- Staff no video join.
- C1 remains owner-approved; C2 is DECIDED.

### D. Blog

Updated documents now consistently state:

- `publishedAt`: first publish sets; edits/unpublish/republish preserve; `updatedAt` for edits; no scheduling.
- Slug: Unicode-aware; generated collision suffix; explicit duplicate 409; draft editable; published immutable; Arabic public routing.
- Public: `status=PUBLISHED` only; server-side API/SSR/meta; no shared cache; draft/unpublished/deleted 404; no preview.
- Tests cover transition dates, Arabic slug, duplicate/immutability, no-cache/draft isolation, XSS.

D1/D2/D3 are DECIDED.

## 4. Files Updated

Updated in place:

- `Docs/FINAL-DECISIONS.md`
- `Docs/ROADMAP-DECISIONS-UPDATE.md`
- `Docs/OWNER-APPROVAL-REQUIRED.md`
- `Docs/Implementation-Roadmap/README.md`
- `Docs/Implementation-Roadmap/00-current-system-analysis.md`
- `Docs/Implementation-Roadmap/01-architecture-and-data-impact.md`
- `Docs/Implementation-Roadmap/02-phase-plan.md`
- `Docs/Implementation-Roadmap/03-risks-and-open-questions.md`
- `Docs/Implementation-Roadmap/phases/PHASE-01-session-reentry.md`
- `Docs/Implementation-Roadmap/phases/PHASE-02-doctor-workspace-simplification.md`
- `Docs/Implementation-Roadmap/phases/PHASE-03-doctor-booking-foundation.md`
- `Docs/Implementation-Roadmap/phases/PHASE-04-payment-confirmation-lifecycle.md`
- `Docs/Implementation-Roadmap/phases/PHASE-05-blog-management.md`
- `Docs/Implementation-Roadmap/phases/PHASE-06-release-hardening.md`

Created:

- `Docs/CONTRADICTION-RESOLUTION-REPORT.md`

No application/source/schema/migration/test file was modified.

## 5. Remaining Blockers

No business-owner decision remains blocked. A1, A3, B3, and C1 are owner-approved:

1. **A1** — 20-minute hold, 5–60 configurable.
2. **A3** — late successful payment/refund reconciliation.
3. **B3** — cross-date same-doctor rescheduling, 24h patient limit.
4. **C1** — own notes retained; patient directory/profile/peer notes removed.

Runtime evidence is still required before release (not documentation contradictions):

- real Paymob/Stripe webhook/signature behavior;
- LiveKit re-entry/room recreation drill;
- staging migration/backfill rehearsal;
- current test/build status after approved implementation.

The roadmap is internally consistent and owner-approved at the decision level. Implementation verification remains per phase.
