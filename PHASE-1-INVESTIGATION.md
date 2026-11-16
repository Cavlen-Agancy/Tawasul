# Phase 1 Testing Investigation Report

## 1. Executive Summary
- Phase 1 implementation remains unchanged; no application files were modified for this investigation.
- Full Vitest API execution under Node 22.23.1 produced 9 unexpected failures across two files:
  - `tests/api/doctor/session/[bookingId]/admit.post.test.ts` — 8 failed
  - `tests/api/patient/session/[bookingId].get.test.ts` — 1 failed
- All 8 admit tests passed when executed individually with the same Node runtime.
- There is one additional audit-test failure: `tests/utils/useTheme.test.ts` (6 failed) due to the Node test environment lacking browser DOM methods.
- Browser E2E remains incomplete: authentication was 9/10, and Phase 1 comprehensive E2E was not run.
- No confirmed application security defect has been established from the executed evidence.

## 2. Detailed Failure Evidence

### 2.1 Vitest Admit Failures
Affected file: `tests/api/doctor/session/[bookingId]/admit.post.test.ts`

Failing test names and observed results:
- `rejects a different patient identity` — `expected undefined to be 403`
- `is safe to call twice for the same patient` — `Failed to verify participant`
- `rejects a reconnected old token (same entry, new SID) and removes it` — `Failed to verify participant`
- `rejects a stale entry identity and removes that participant` — `expected undefined to be 403`
- `allows the patient after a fresh server-side entry rotation` — `Failed to verify participant`
- `revokes a grant when the participant reconnects between the SID check and grant` — `expected 502 to be 409`
- `rejects duplicate connections for the same identity` — `expected 502 to be 409`
- `does not persist admission when the lobby entry rotates mid-flight` — `expected 502 to be 409`

Shared log evidence:
- `[doctor/session/admit] Failed to list room participants: TypeError: roomService.listParticipants is not a function`
- This TypeError only occurs in combined-file execution. Single-test execution passes.

Root cause classification: **TEST INFRASTRUCTURE / MOCK STATE ISOLATION**, not confirmed application defect.

Likely cause:
- The test uses one shared hoisted `vi.mock('livekit-server-sdk')` factory and calls `vi.restoreAllMocks()` in `finally` blocks.
- Mock function implementations can be cleared globally by `restoreAllMocks()`; interaction between restored mocks and subsequent `beforeEach` setup appears order-dependent.
- This does not demonstrate that LiveKit participant filtering fails in production.

### 2.2 Patient Session Re-entry Failure
Affected file: `tests/api/patient/session/[bookingId].get.test.ts`

Failing test:
- `returns a fresh member token on every entry and keeps the same room`
- Assertion: `expected 1794153077 to be 300`
- Meaning the decoded token's expected `exp - iat` delta did not equal the remaining window (300 seconds).
- Root cause is currently **UNRESOLVED**.
- Possible causes: LiveKit JWT does not include `iat`, token decode behavior varies by runtime, or the test's TTL calculation assumes a field that was not set. Single-test execution has not been conclusively recorded for this exact failure.

Classification: **UNRESOLVED / TEST DATA OR ENVIRONMENT PARSE ASSUMPTION**.

No evidence of application authorization bypass was observed.

### 2.3 Theme Test Failure
Affected file: `tests/utils/useTheme.test.ts`

Failure: `TypeError: root.setAttribute is not a function` (6 failures). This is a browser-DOM unavailable in the Node test environment, unrelated to Phase 1 session security.

Classification: **TEST ENVIRONMENT**.

## 3. E2E and LiveKit Coverage

### Authentication E2E
- Result: 9/10 passed.
- One failing assertion: staff login and `page-title` text `Admin Overview`.
- Likely environment/routing or test-fixture issue, not confirmed authorization bypass.
- Classification: **MISSING/INCOMPLETE E2E COVERAGE OR FIXTURE ISSUE**.

### Phase 1 Browser E2E
Not completed. No evidence was produced for:
- Forced disconnect in browser
- Old-token reconnect observed in a real room
- Duplicate participant handling
- Application restart recovery in a running application session
- All four roles completing Phase 1-relevant workflows

Classification: **MISSING TEST COVERAGE / ENVIRONMENT EXECUTION LIMITATION**.

### Old-Token Reconnect
- Unit/API tests verify that an old token cannot be admitted when its SID differs or entry is stale.
- Browser-level and actual LiveKit-room observation of old-token reconnect remain unexecuted.
- Classification: **PARTIAL ONLY; NOT CONFIRMED AT INTEGRATION LEVEL**.

### Application Restart and LiveKit Recovery
- Unit sweep tests cover startup behavior.
- The locally configured LiveKit integration (`LIVEKIT_URL=http://localhost:7880`) now works, but a controlled restart/recovery integration test was not executed.
- Classification: **MISSING TEST EXECUTION**, not confirmed defect.

## 4. Root-Cause Classification Summary

| Issue | Classification |
|---|---|
| 8 admit post failures | Test infrastructure (mock-state isolation) |
| Patient token re-entry TTL assertion | Unresolved (JWT field/decode assumption or test-environment behavior) |
| 6 useTheme failures | Test environment (missing DOM) |
| Auth E2E staff title failure | E2E fixture or environmental |
| Comprehensive Phase 1 E2E missing | Missing execution and fixtures |
| Real old-token reconnect unverified | Missing integration test |
| Application restart recovery unverified | Missing integration test |

No application bug is confirmed at this time.

## 5. Security Impact Assessment
- No evidence that ownership checks can be bypassed.
- No evidence that old tokens restore media access.
- No evidence that termination scoping fails.
- The failing suites do not prove that unauthorized admission occurs.
- Most failures arise from test mocks, test environment, or apparently order-dependent test state.

## 6. Proposed Fixes in Priority Order
1. Isolate Vitest mocks in `admit.post.test.ts` by avoiding `vi.restoreAllMocks()` on hoisted mocks or by re-entering each test through a controlled mock setup.
2. Reproduce the patient-token re-entry failure in isolation and then determine whether `iat` is actually present in LiveKit tokens.
3. Install or configure a browser-compatible DOM test environment if `useTheme` is relevant.
4. Complete Playwright E2E fixtures and explicit Phase 1 browser scenarios.
5. Execute a Node-20 as well as Node-22 test run if runtime compatibility remains uncertain.
6. Run test-mode-disabled (`NUXT_PUBLIC_ENABLE_SESSION_TEST_MODE=false`) across E2E and security tests once browser setup is stable.

## 7. Exact Files Likely Needing Changes
- `tests/api/doctor/session/[bookingId]/admit.post.test.ts` (test-only cleanup-style setup; assertions preserved)
- `tests/api/patient/session/[bookingId].get.test.ts` (TTL assertion or token test setup)
- `tests/utils/useTheme.test.ts` (browser/DOM test environment)
- Existing E2E fixture files and new Phase 1 spec files under `tests/e2e/`

## 8. Remaining Tests Required to Complete Phase 1
- Run all 8 isolated admit tests in one known clean sequence.
- Re-run the full `admit.post.test.ts` after correcting mock isolation.
- Re-run the full Vitest API suite after that fix.
- Complete Phase 1 Playwright authorization, timing, re-entry, termination, isolation, and old-token reconnect browser tests.
- Execute application restart and LiveKit recovery drills.
- Record screenshots, traces, and logs for any future failure.

## 9. Current Conclusion
Phase 1 remains unverified. The current failures should not be treated as proof of application security defects. They must be re-investigated, and the integration scenarios must be completed before any Phase 1 completeness claim.
