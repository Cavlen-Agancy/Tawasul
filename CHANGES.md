# CHANGES.md — Admin Panel Fix Prompt

## Scope note

Most of this prompt's implementation already existed in the working tree
(route hierarchy, Overview KPIs, doctor/User sync, seed-admin PATCH guard,
page permission meta + middleware, SUCCESS-only refunds, calendar doctor
filter/colors, deduped availability utils, and API regression tests for all of
them). This session verified every step end-to-end, repaired three stale
import breakages left by the dedup, fixed two stale E2E expectations, and added
the missing routing/permission E2E coverage plus this report.

## Files changed (this session)

- `modules/admin/server/api/admin/blocked-dates/index.post.ts` — fixed broken
  import: `formatDateISO` no longer comes from `admin-availability` (deduped);
  now imported from `~/server/utils/availability`. Without this the Nitro
  server failed to build (`RollupError: "formatDateISO" is not exported`).
- `modules/booking/server/api/booking/create.post.ts` — same class of fix:
  `timeToMinutes` now imported from `~/server/utils/availability`; behavior
  unchanged.
- `modules/admin/server/api/admin/doctors/[id]/availability/block.post.ts` —
  same class of fix for `formatDateISO`; behavior unchanged.
- `tests/e2e/auth.spec.ts` — fixed two stale expectations that failed before
  this session: staff login now expects the `page-title` "Admin Overview"
  (page was rebuilt; "Admin Dashboard" heading no longer exists); doctor login
  now waits for `**/doctor**` and expects "My Calendar" (doctors land on
  `/doctor/calendar`; old `**/doctor` pattern could never match). Test-only
  changes, no app code touched.

## Files created (this session)

- `tests/e2e/admin-panel.spec.ts` — 12 Playwright tests: unauthenticated
  redirect, Overview renders with real KPIs, each of the 6 admin routes renders
  its own `page-title`, `/admin/appointments` shows no Overview content,
  restricted staff (APPOINTMENTS:READ only) reaches appointments but is
  redirected from doctors/patients/payments/staff/settings to `/admin`.
  Fixtures (full-permission + limited staff) are created/removed in
  `beforeAll`/`afterAll`.

## Files deleted

- None by this session. (`pages/admin.vue` is already absent; the flat
  `pages/admin/` + `index.vue` structure predates this session.)

## Verified pre-existing implementation (reviewed, not rewritten)

- STEP 1 routes: flat `pages/admin/` with `index.vue`; no `admin.vue`
  conflict; E2E proves independent rendering.
- STEP 2 overview: `pages/admin/index.vue` renders Total Bookings / Total
  Revenue (EGP) / Active Patients / Active Doctors + 5 recent bookings from
  `overview.get.ts`; loading/empty/error states present.
- STEP 3 deactivation: `doctors/[id].patch.ts` syncs `User.isActive`
  atomically via `$transaction`, only when supplied; login rejects inactive
  users (`login.post.ts`).
- STEP 4 seed admin: `staff/[id].patch.ts` rejects deactivation and
  permission-wipe via `SEED_ADMIN_EMAIL`; 4 regression tests exist.
- STEP 5 guards: every admin page declares `permission: { resource, READ }`
  meta; `staff-only` middleware maps paths to resources and redirects to
  `/admin`; API checks remain the final boundary.
- STEP 6 refunds: admin cancel refunds only `status: 'SUCCESS'`; per-state
  regression test exists.
- STEP 7 calendar: doctor + status filters, 6-color doctor palette with
  `[Cancelled]`/`[Pending]` title prefixes, status classes, permission-gated
  assign/cancel, loading skeletons, empty-filter state, error line.
- STEP 8 dedup: `admin-availability.ts` imports shared utils; this session
  repaired the three consumer imports the dedup had broken.

## Assumptions

- The E2E staff fixtures use the same bcrypt/login flow as existing specs;
  permission rows cascade-delete with their user.
- `**/doctor**` URL wait is intentional: doctors land on `/doctor/calendar`.
- Raw `tsc --noEmit` (no vue-tsc installed) is the available TS validation;
  its 24 errors are pre-existing project noise (verified identical via stash).

## Problems encountered and resolutions

- Nitro build failure from stale re-export imports after the availability
  dedup (3 files) — fixed by pointing imports at `~/server/utils/availability`.
- Two stale E2E expectations failing before this session (staff/doctor login)
  — fixed test-side to match the rebuilt pages.
- `npx tsc` reports 24 errors; stash-compared pristine tree reports the same
  24, so zero new type errors from this session.

## Test commands and results

- `npx playwright test tests/e2e/admin-panel.spec.ts` — **12/12 pass**.
- `npx playwright test tests/e2e/auth.spec.ts` — 21/22 full run (only the
  stale doctor expectation failed); after the test-only fix, the 2 affected
  tests pass.
- `npx vitest run tests/api/admin` — **50/50 pass (9 files)**.
- `npx vitest run` (full) — **239/239 pass (39 files)**.
- `npx tsc --noEmit` — 24 errors, all pre-existing (identical on pristine
  tree via `git stash` comparison).
- `npx nuxt build` — success; **no duplicate availability utility warnings**.
