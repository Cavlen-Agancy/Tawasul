# Phase 0 — Project Setup
## testing.md

---

## Testing Strategy

Phase 0 is infrastructure only — no API endpoints, no pages with logic, no user flows. Testing in this phase is therefore:

- **Unit Tests (Vitest)** — YES. Test every function in the four server utility files. These are pure functions and can be tested in complete isolation.
- **API Tests (Vitest + supertest)** — NO. No API endpoints exist in Phase 0.
- **End-to-End Tests (Playwright)** — NO. No meaningful user flows exist yet beyond rendering a test page.

The test page (`pages/index.vue`) is verified manually only.

---

## Unit Tests

Create test files in `tests/utils/` (Vitest `include` covers `tests/**/*.{test,spec}.ts`).
Phase 0's unit tests are pure-function tests that run standalone under bare-node Vitest —
no Nuxt/Nitro runtime is loaded, which is why the server utils keep a documented
`process.env` fallback via `server/utils/runtime.ts` (see `phase-0/notes.md` §8).

All tests use Vitest.

Install test dependencies if not already installed:
```
npm install -D vitest @vitest/coverage-v8
```

Add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

---

### Test File 1 — `tests/utils/auth.test.ts`

Tests for `server/utils/auth.ts`.

Import the functions directly. Do not mock bcryptjs or jsonwebtoken — test against real implementations.

Set `process.env.JWT_SECRET = 'test-secret-for-unit-tests'` in a `beforeAll` block.
Set `process.env.JWT_EXPIRES_IN = '7d'` in a `beforeAll` block.

**`hashPassword`**

| Test case | Input | Expected |
|---|---|---|
| Returns a string | `'password123'` | result is a string |
| Returns a bcrypt hash (starts with `$2`) | `'password123'` | result starts with `'$2'` |
| Same input produces different hashes (salt) | `'password123'` twice | the two hashes are not equal |
| Hash length is always 60 characters | `'anypassword'` | `result.length === 60` |

**`comparePassword`**

| Test case | Input | Expected |
|---|---|---|
| Returns true for correct password | plain: `'password123'`, hashed: hash of `'password123'` | `true` |
| Returns false for wrong password | plain: `'wrongpassword'`, hashed: hash of `'password123'` | `false` |
| Returns false for empty string | plain: `''`, hashed: hash of `'password123'` | `false` |

**`generateJWT`**

| Test case | Input | Expected |
|---|---|---|
| Returns a string | `{ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' }` | result is a non-empty string |
| Token has three parts (header.payload.signature) | any valid payload | `result.split('.').length === 3` |
| Token contains the payload data | `{ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' }` | decoded token includes userId, email, accountType |

**`verifyJWT`**

| Test case | Input | Expected |
|---|---|---|
| Returns the original payload | token generated from `{ userId: 'u1', email: 'a@b.com', accountType: 'STAFF' }` | returns object with matching userId, email, accountType |
| Throws on invalid token | `'invalid.token.string'` | throws an error |
| Throws on tampered token | modify one character in the signature part of a valid token | throws an error |
| Throws on token signed with wrong secret | generate token with secret `'wrong-secret'` | throws an error |

**`generateToken`**

| Test case | Input | Expected |
|---|---|---|
| Returns a string | none | result is a string |
| Returns 64 characters | none | `result.length === 64` |
| Returns hex characters only | none | `/^[a-f0-9]+$/.test(result)` is true |
| Two calls return different values | call twice | results are not equal |

**`requireAuth`**

Mock the H3Event object. Create a helper function `mockEvent(user)` that returns an object with `context: { user }`.

| Test case | event.context.user | accountTypes param | Expected |
|---|---|---|---|
| Returns user when authenticated | `{ userId: 'u1', email: 'a@b.com', accountType: 'PATIENT' }` | not provided | returns the user object |
| Returns user when accountType matches | `{ userId: 'u1', email: 'a@b.com', accountType: 'DOCTOR' }` | `['DOCTOR']` | returns the user object |
| Returns user when accountType is in list | `{ userId: 'u1', email: 'a@b.com', accountType: 'STAFF' }` | `['DOCTOR', 'STAFF']` | returns the user object |
| Throws 401 when no user | `null` | not provided | throws error with statusCode 401 |
| Throws 401 when user is undefined | `undefined` | not provided | throws error with statusCode 401 |
| Throws 403 when accountType not in list | `{ accountType: 'PATIENT' }` | `['DOCTOR']` | throws error with statusCode 403 |
| Throws 403 when accountType is STAFF but list is PATIENT only | `{ accountType: 'STAFF' }` | `['PATIENT']` | throws error with statusCode 403 |

---

### Test File 2 — `tests/utils/email.test.ts`

Tests for the template functions in `server/utils/email.ts`.

Do NOT test `sendEmail` itself — that would require a live Resend account. Only test the template functions.

Mock `Resend` at the top of the file so the module loads without a real API key:
```typescript
vi.mock('resend', () => ({ Resend: vi.fn().mockImplementation(() => ({ emails: { send: vi.fn() } })) }))
```

**`emailVerificationTemplate`**

| Test case | Input | Expected |
|---|---|---|
| Returns a string | `('Ahmed', 'https://example.com/verify?token=abc')` | result is a string |
| Contains the recipient name | `('Ahmed', '...')` | result includes `'Ahmed'` |
| Contains the verification URL | `('Ahmed', 'https://example.com/verify?token=abc')` | result includes the full URL |
| Contains expiry mention | `('Ahmed', '...')` | result includes `'24'` (for 24 hours) |
| Is valid HTML | any input | result starts with `'<'` and includes `'</html>'` or at minimum `'<div'` |

**`passwordResetTemplate`**

| Test case | Input | Expected |
|---|---|---|
| Returns a string | `('Sara', 'https://example.com/reset?token=xyz')` | result is a string |
| Contains the recipient name | `('Sara', '...')` | result includes `'Sara'` |
| Contains the reset URL | `('Sara', 'https://example.com/reset?token=xyz')` | result includes the full URL |
| Contains 1 hour expiry mention | any input | result includes `'1'` and (`'hour'` or `'ساعة'`) |

**`bookingConfirmationTemplate`**

| Test case | Input | Expected |
|---|---|---|
| Returns a string | `('Ahmed', 'Dr. Sara', '2024-03-04', '10:00 AM', 'Marital Counseling')` | result is a string |
| Contains patient name | above input | result includes `'Ahmed'` |
| Contains doctor name | above input | result includes `'Dr. Sara'` |
| Contains date | above input | result includes `'2024-03-04'` |
| Contains time | above input | result includes `'10:00 AM'` |
| Contains service | above input | result includes `'Marital Counseling'` |

**`doctorWelcomeTemplate`**

Signature: `doctorWelcomeTemplate(doctorName: string, email: string, temporaryPassword: string, loginUrl: string)`.

| Test case | Input | Expected |
|---|---|---|
| Returns a string | `('Dr. Amr', 'amr@email.com', 'TempPass123!', 'http://localhost:3000')` | result is a string |
| Contains doctor name | above input | result includes `'Dr. Amr'` |
| Contains email | above input | result includes `'amr@email.com'` |
| Contains temporary password | above input | result includes `'TempPass123!'` |
| Contains the login URL | above input | result includes `'http://localhost:3000/login'` |
| Contains instruction to change password | any input | result includes `'change'` or `'password'` |

---

### Test File 3 — `tests/utils/permissions.test.ts`

Tests for `server/utils/permissions.ts`.

Mock Prisma using `vitest-mock-extended`:
```
npm install -D vitest-mock-extended
```

```typescript
import { mockDeep, mockReset } from 'vitest-mock-extended'
import { PrismaClient } from '@prisma/client'

vi.mock('../../server/utils/prisma', () => ({ prisma: mockDeep<PrismaClient>() }))
```

Also mock `requireAuth` from `server/utils/auth`:
```typescript
vi.mock('../../server/utils/auth', () => ({ requireAuth: vi.fn() }))
```

| Test case | Setup | Expected |
|---|---|---|
| Resolves when permission exists | `prisma.permission.findMany` returns `[{ resource: 'APPOINTMENTS', action: 'READ' }]` | function resolves without throwing |
| Throws 403 when no permissions found | `prisma.permission.findMany` returns `[]` | throws error with statusCode 403 |
| Throws 403 with correct message | `prisma.permission.findMany` returns `[]` | error message is `'You do not have permission to perform this action'` |
| Calls requireAuth with STAFF | any setup | `requireAuth` called with `['STAFF']` |
| Queries correct resource and action | any setup | `findMany` called with `where: { userId: ..., resource: 'APPOINTMENTS', action: 'READ' }` |

---

## Manual Verification Checklist

Complete every item below before marking Phase 0 as done.

**Docker**
1. Run `docker compose up -d`. Verify output shows both containers (postgres, pgAdmin) starting.
2. Run `docker compose ps`. Both containers show status `running` or `healthy`.
3. Open http://localhost:5050 in browser. pgAdmin login page appears.
4. Log in to pgAdmin with `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD`.
5. Add a server connection to postgres (host: `postgres`, port: `5432`, user: `tawasul`, password: `tawasul_pass`).
6. Expand the database — all 9 tables appear: users, doctors, availability, blocked_slots, bookings, payments, session_rooms, permissions, settings.

**Seed**
7. Query the `users` table in pgAdmin. One row exists with email matching `SEED_ADMIN_EMAIL` and `accountType = STAFF`.
8. Query the `settings` table. One row exists with `id = 'singleton'` and `platformName = 'Tawasul Academy'`.
9. Run `npx prisma db seed` a second time (on the host). No error thrown. Row counts unchanged.

**Nuxt and UI (host dev — see notes.md §7)**
10. Run `npm run dev` on the host, open http://localhost:3000 in browser. Test page renders with heading "Tawasul Academy — Setup Complete".
11. The shadcn-vue Button on the test page is magenta/pink (the brand primary color `#E91E8C`). Not blue, not gray.
12. The Card renders with a border and rounded corners.
13. Hot reload: change the heading text in `pages/index.vue` and save. Browser updates without a full page refresh.

**Resend (deferred — requires a real Resend account; see notes.md §10)**
14. Open a temporary test script or use Nuxt's server playground. Call `sendEmail` with a real recipient email address, subject "Test from Tawasul", and any HTML body.
15. The email arrives in the recipient's inbox within 2 minutes.
16. The sender name shows as "Tawasul Academy" and the sender address matches `RESEND_FROM_EMAIL`.

**Git**
17. Run `git status`. The `.env` file does not appear in the output (it is gitignored).
18. Run `git branch`. A single branch exists: `main` (post-cleanup amendment, notes.md §7).
19. Current branch is `main`.

**TypeScript**
20. Run `npx tsc --noEmit` on the host. Zero errors.

---

## Completion Criteria

Mark each item PASS or FAIL with a note before handing off to Phase 1.

```
[ ] All unit tests pass — run `npm test`, output shows 0 failures
[ ] TypeScript check passes — `npx tsc --noEmit` shows 0 errors
[ ] Docker environment starts with no errors — `docker compose up -d` succeeds (postgres + pgAdmin)
[ ] All 9 database tables exist in PostgreSQL
[ ] Seed data exists — admin user and settings singleton confirmed in pgAdmin
[ ] Running seed twice does not throw errors
[ ] Nuxt dev server accessible at http://localhost:3000 (host `npm run dev`)
[ ] shadcn-vue Button primary color is brand magenta on test page — visual check
[ ] Hot reload works — change a file, browser updates without full refresh
[ ] Test email sent and received successfully via Resend (deferred — requires real Resend account, see notes.md §10)
[ ] Git repo clean on `main`, .env not committed
[ ] No console errors in browser on test page
```

**The phase is complete only when all 12 items above are marked PASS.**

If any item is FAIL, fix it before moving to Phase 1. Document what failed and what was done to fix it in a `notes.md` file inside the `phase-0/` folder.
