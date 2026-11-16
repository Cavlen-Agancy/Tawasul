# Phase 1 — Test Fixture Isolation

## Objective
Remove the confirmed `TEST DEFECT / FIXTURE ISOLATION` in `tests/api/booking/[id].patch.test.ts` without weakening the booking conflict validation.

## Implemented
- Selected each test run's Saturday fixture dates far in the future using a per-run week offset.
- Kept dates unique within a run via the existing `fixtureWeek` counter.
- Skipped public-holiday Saturdays using the existing `isHoliday` helper.
- Did not delete the pre-existing development booking that originally caused the collision.
- Kept the endpoint's overlap validation unchanged; genuine conflict tests still reject overlapping bookings.

## Files
- Modified: `tests/api/booking/[id].patch.test.ts`

## Tests Executed
```bash
npx vitest run "tests/api/booking/[id].patch.test.ts" -t "allows the patient to keep their own current slot"
npx vitest run "tests/api/booking/[id].patch.test.ts"
npm run test
```

## Results
- Isolated failing test, two runs: **PASS / PASS**
- Complete booking PATCH file, three consecutive runs: **6/6 passed each time**
- Full Vitest suite: **45 files, 304 tests, all passed**

## Problems / Resolution
- A per-run offset that could be small occasionally selected dates near persistent E2E fixtures. The offset was changed to 520–1039 weeks in the future.
- A far-future Saturday could fall on an Egyptian public holiday; the fixture now skips holidays.

## Remaining Risks / Unverified
- Vitest still uses the shared development database; other suites can leave data if interrupted. This fix prevents the confirmed collision but does not provide database-level isolation.

## Manual Testing
- Confirm a patient can move a booking to a free time.
- Confirm rescheduling into a slot occupied by another booking is rejected.
- Confirm keeping the current booking time succeeds.
