# Tawasul Test Baseline — 2026-11-08

## 1. Baseline Summary

This is an investigation-only baseline after environment preparation and Phase 1 test-infrastructure changes, without fixing application functionality.

Latest reproduced commands:

- `npm run test` (Node 22.23.1): 45 test files passed, 304 tests passed, 0 failed.
- `npx playwright test` (Playwright 1.62.1, existing tests only): 50 passed, 6 failed.
- Playwright authentication suite: 10 passed, 0 failed after fixing the E2E staff permissions fixture.
- LiveKit API: running and authenticated (`RoomService.listRooms()` -> 0).
- PostgreSQL: healthy, migration `0002_session_hardening` applied, rows preserved.
- Session test mode: disabled (`NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=false`).

## 2. Test Inventory

Primary commands:

- `npm run test`: full Vitest suite.
- `npm run test:api`: API-only Vitest suite.
- `npm run test:e2e`: full Playwright E2E suite (default Chromium browser dependency may still need the remaining Playwright browser install).
- Utility tests are executed by `npm run test` via Vitest.

Covered areas:
- Authentication and role permissions (Vitest API + Playwright E2E).
- Booking, patient dashboard, calendar, and admin UI (Playwright E2E).
- Session time restrictions, token TTL, session access, and admission (Vitest API + utilities).
- Session termination, cleanup, sweeps, and reschedule handling (Vitest API).
- LiveKit API connectivity (direct server-side SDK check).
- Theme composables (Vitest utility).
- Client media helpers (Vitest unit).

Known coverage gaps:
- No browser-level Phase 1 session re-entry flow.
- No browser-level forced-disconnect observation.
- No real LiveKit old-token reconnect in a real room.
- No application restart or LiveKit recovery integration test.
- No direct E2E browser checks for cross-user session isolation.

## 3. Reproduced Test Results

### Vitest
- Command: `npm run test`
- Result: 45 passed, 304 passed, 0 failed.
- Evidence: local execution on Node 22.23.1 on 2026-11-08.

### Playwright existing suite
- Command: `npx playwright test`
- Result: 6 failed, 50 passed.
- Authentication suite alone from the same environment: 10 passed, 0 failed.

### Environment baseline
- PostgreSQL: running and healthy.
- LiveKit container: running and API-verified.
- Prisma schema: migration history complete through `0002_session_hardening`.
- Prisma client: generated.

## 4. Failure Classification Table

| Test file | Test name | Result | Classification | Blocking Phase 1 |
|---|---|---|---|---|
| `tests/e2e/admin-panel.spec.ts` | `/admin/appointments does not show the Overview` | Failed | `UNCONFIRMED` | No |
| `tests/e2e/patient-dashboard.spec.ts` | clicking a holiday shows a closed toast | Failed | `UNCONFIRMED` | No |
| `tests/e2e/patient-dashboard.spec.ts` | outside-month dates are dimmed and not clickable | Failed | `UNCONFIRMED` | No |
| `tests/e2e/patient-dashboard.spec.ts` | slots fetch failure shows inline error and reselecting recovers | Failed | `UNCONFIRMED` | No |
| `tests/e2e/patient-dashboard.spec.ts` | join button is active near session time and opens the session page | Failed | `UNCONFIRMED` | Yes |
| `tests/e2e/patient-dashboard.spec.ts` | available day opens the booking flow | Failed | `UNCONFIRMED` | No |

Notes:
- No previous passing/failing history is available for these exact six checks in the Phase 1 verification set.
- They should not be classified as pre-existing or regressions without historical execution evidence.
- The admin test failure is a page-loading timeout at `/login`, not evidence of a security issue.
- The join button failure is approaching the Phase 1 session-entry flow and therefore blocks real browser-level Phase 1 proof.

## 5. Unverified Critical Scenarios

| Scenario | Status | Evidence |
|---|---|---|
| Patient session re-entry | `PASS` API-level, `UNVERIFIED` browser-level | Vitest session route/admission tests pass |
| Forced disconnect | `PARTIAL` | Vitest scheduler passes; startup sweep removed expired rooms; LiveKit logs show successful `DeleteRoom` handling |
| Session isolation | `PASS` API-level, `UNVERIFIED` browser-level | Ownership/admission tests pass |
| Old-token reconnect in real LiveKit room | `UNVERIFIED` | No real browser or repeated LiveKit-room observation |
| Application restart recovery | `PARTIAL` | Sweep/re-arm tests pass; application process was restarted during troubleshooting but no clean drill |
| LiveKit recovery | `NOT EXECUTED` | No container recovery drill |
| Doctor/patient E2E | `PARTIAL` | Existing E2E covers dashboard/calendar flows, but not dedicated Phase 1 session flows |

## 6. Environment and Infrastructure Limitations

- Browser binaries: Playwright package is present; a usable headless shell in revision 1234 was still downloading when last checked. Existing browser binaries 1243 and 1248 are installed.
- Dev server stale-module risk was previously reproduced and fixed with relative imports. Restart of the dev server may be needed when new server utilities are added.
- Node v26 exists on PATH; recommended testing uses Node 22.23.1 to avoid Vitest runtime quirks.
- `.env` has `NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=false` after fixes.
- PostgreSQL and LiveKit containers are running and operational.
- Prisma migration `0002_session_hardening` is applied and Prisma client generated.
- No production data or credentials may be used for further testing.

## 7. Confirmed Historical Regressions or New Failures

No exact historical baseline was available to prove which of the six Playwright failures are newly introduced versus pre-existing. At least one test touches Phase 1 behavior (join to session), so it must remain `UNCONFIRMED` pending a direct reproducible isolated run.

## 8. Recommended Fix Order

1. Fix or investigate the Phase 1 join-to-session browser failure first.
2. Re-run `patient-dashboard.spec.ts` around `join button is active near session time and opens the session page` in isolation to classify it as deterministic/intermittent/new regression.
3. Complete Browser-level session re-entry, forced disconnect, and session-isolation E2E scenarios.
4. Run a controlled old-token reconnect test against a real local LiveKit room.
5. Perform an application restart integration drill and document behavior.
6. Perform a separate LiveKit restart integration drill and document behavior.
7. Finish remaining unrelated UI failure investigations (holiday, booking flow, admin appointments overview) only after security-critical Phase 1 scenarios.
8. Re-run the full Vitest suite and then a stable Playwright suite to establish a final green baseline.

## 9. Reference Commands for Future Verification

```bash
npm run test
npx playwright test tests/e2e/auth.spec.ts
npx playwright test
```

Use Node 22.23.1 via `PATH="$HOME/.config/nvm/versions/node/v22.23.1/bin:$PATH"`.

Recommended local LiveKit verification:

```bash
docker compose up -d postgres livekit
npx prisma migrate status
npx prisma generate
```

Do not apply migrations, reset data, or change existing application functionality without explicit approval.
