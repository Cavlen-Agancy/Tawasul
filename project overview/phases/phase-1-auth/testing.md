# Phase 1 — Authentication Module
## testing.md

---

## Testing Strategy

Phase 1 introduces API endpoints, frontend pages, and authentication logic. Testing includes:

- **Unit Tests (Vitest)** — NO. No pure utility functions are added in this phase (all utilities are from Phase 0).
- **API Tests (Vitest + supertest)** — YES. Test all 7 API endpoints for happy paths, validation errors, auth errors, and edge cases.
- **End-to-End Tests (Playwright)** — YES. Test complete user flows (registration, login, password reset).

---

## API Tests

Install test dependencies if not already installed:
```bash
npm install -D vitest @vitest/coverage-v8 supertest
```

Add to `package.json`:
```json
"scripts": {
  "test:api": "vitest run tests/api",
  "test:api:watch": "vitest tests/api"
}
```

---

### Test File: `tests/api/auth/register.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Register with valid data | Body: `{ name: "Ahmed", email: "ahmed@test.com", password: "Password123!" }` | 201 | `{ message: "Registration successful. Please check your email." }` |
| Register with duplicate email | Body: `{ name: "Ahmed", email: "existing@test.com", password: "Password123!" }` (email exists) | 400 | `{ message: "Email already in use" }` |
| Register with invalid email | Body: `{ name: "Ahmed", email: "invalid-email", password: "Password123!" }` | 400 | `{ message: "Invalid email format" }` |
| Register with short password | Body: `{ name: "Ahmed", email: "ahmed@test.com", password: "123" }` | 400 | `{ message: "Password must be at least 8 characters" }` |
| Register with short name | Body: `{ name: "A", email: "ahmed@test.com", password: "Password123!" }` | 400 | `{ message: "Name must be at least 2 characters" }` |

---

### Test File: `tests/api/auth/verify-email.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Verify with valid token | Query: `?token=VALID_TOKEN` (token exists, not expired) | 200 | `{ message: "Email verified. You can now log in." }` |
| Verify with invalid token | Query: `?token=INVALID_TOKEN` | 400 | `{ message: "Invalid or expired link" }` |
| Verify with expired token | Query: `?token=EXPIRED_TOKEN` (expiry in past) | 400 | `{ message: "Link has expired" }` |

---

### Test File: `tests/api/auth/login.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Login with correct credentials | Body: `{ email: "patient@test.com", password: "CorrectPass123!" }` | 200 | `{ id, name, email, accountType: "PATIENT", photo? }` + `auth_token` cookie |
| Login with wrong password | Body: `{ email: "patient@test.com", password: "WrongPass123!" }` | 401 | `{ message: "Invalid credentials" }` |
| Login with non-existent email | Body: `{ email: "nonexistent@test.com", password: "AnyPass123!" }` | 401 | `{ message: "Invalid credentials" }` |
| Login with unverified email | Body: `{ email: "unverified@test.com", password: "CorrectPass123!" }` | 403 | `{ message: "Please verify your email before logging in" }` |
| Login with deactivated account | Body: `{ email: "deactivated@test.com", password: "CorrectPass123!" }` | 403 | `{ message: "Your account has been deactivated" }` |

---

### Test File: `tests/api/auth/logout.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Logout while authenticated | Cookies: `auth_token=VALID_JWT` | 200 | `{ message: "Logged out successfully" }` + `auth_token` cookie cleared |
| Logout while unauthenticated | No cookies | 200 | `{ message: "Logged out successfully" }` |

---

### Test File: `tests/api/auth/me.get.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Fetch me while authenticated (PATIENT) | Cookies: `auth_token=VALID_JWT` (PATIENT) | 200 | `{ id, name, email, phone?, photo?, accountType: "PATIENT" }` |
| Fetch me while authenticated (STAFF) | Cookies: `auth_token=VALID_JWT` (STAFF) | 200 | `{ id, name, email, phone?, photo?, accountType: "STAFF", permissions: [...] }` |
| Fetch me while unauthenticated | No cookies | 401 | `{ message: "Unauthorized" }` |

---

### Test File: `tests/api/auth/forgot-password.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Forgot password with existing email | Body: `{ email: "patient@test.com" }` | 200 | `{ message: "If this email exists, a reset link has been sent." }` |
| Forgot password with non-existent email | Body: `{ email: "nonexistent@test.com" }` | 200 | `{ message: "If this email exists, a reset link has been sent." }` |
| Forgot password with invalid email | Body: `{ email: "invalid-email" }` | 200 | `{ message: "If this email exists, a reset link has been sent." }` |

---

### Test File: `tests/api/auth/reset-password.post.test.ts`

| Test Case | Request Setup | Expected Status | Expected Response |
|---|---|---|---|
| Reset with valid token and new password | Body: `{ token: "VALID_TOKEN", newPassword: "NewPass123!" }` | 200 | `{ message: "Password updated successfully." }` |
| Reset with invalid token | Body: `{ token: "INVALID_TOKEN", newPassword: "NewPass123!" }` | 400 | `{ message: "Invalid or expired link" }` |
| Reset with expired token | Body: `{ token: "EXPIRED_TOKEN", newPassword: "NewPass123!" }` | 400 | `{ message: "Link has expired" }` |
| Reset with short new password | Body: `{ token: "VALID_TOKEN", newPassword: "123" }` | 400 | `{ message: "Password must be at least 8 characters" }` |

---

## End-to-End Tests (Playwright)

Install Playwright:
```bash
npm install -D @playwright/test
npx playwright install
```

Add to `package.json`:
```json
"scripts": {
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

### Test File: `tests/e2e/auth.spec.ts`

#### Test: Patient Registration Flow
- **Starting State:** Logged out, on `/register` page.
- **Steps:**
  1. Fill in name: "Test Patient".
  2. Fill in email: `test-patient-${Date.now()}@example.com`.
  3. Fill in password: "TestPass123!"
  4. Fill in confirm password: "TestPass123!"
  5. Click submit.
- **Assertions:**
  - URL changes to `/verify-email?token=...` (or success message appears).
  - Success message "Check your email to verify your account." is visible.

#### Test: Email Verification Flow
- **Starting State:** User registered but not verified, on `/verify-email?token=VALID_TOKEN`.
- **Steps:**
  1. Navigate to `/verify-email?token=VALID_TOKEN`.
- **Assertions:**
  - Success message "Email verified. You can now log in." is visible.
  - Link to `/login` is visible.

#### Test: Login Flow (Patient)
- **Starting State:** Logged out, on `/login` page.
- **Steps:**
  1. Fill in email: `verified-patient@test.com`.
  2. Fill in password: "CorrectPass123!".
  3. Click submit.
- **Assertions:**
  - Redirected to `/dashboard`.
  - `auth_token` cookie is set.

#### Test: Login Flow (Doctor)
- **Starting State:** Logged out, on `/login` page.
- **Steps:**
  1. Fill in email: `doctor@test.com`.
  2. Fill in password: "CorrectPass123!".
  3. Click submit.
- **Assertions:**
  - Redirected to `/doctor`.

#### Test: Login Flow (Staff)
- **Starting State:** Logged out, on `/login` page.
- **Steps:**
  1. Fill in email: `admin@test.com`.
  2. Fill in password: "CorrectPass123!".
  3. Click submit.
- **Assertions:**
  - Redirected to `/admin`.

#### Test: Logout Flow
- **Starting State:** Logged in as patient, on `/dashboard`.
- **Steps:**
  1. Click logout button.
- **Assertions:**
  - Redirected to `/login`.
  - `auth_token` cookie is cleared.

#### Test: Guest Middleware Redirects
- **Starting State:** Logged in as patient, on `/login`.
- **Steps:**
  1. Navigate to `/login`.
- **Assertions:**
  - Redirected to `/dashboard`.

#### Test: Auth Middleware Redirects
- **Starting State:** Logged out, on `/dashboard`.
- **Steps:**
  1. Navigate to `/dashboard`.
- **Assertions:**
  - Redirected to `/login`.

#### Test: Forgot Password Flow
- **Starting State:** Logged out, on `/forgot-password`.
- **Steps:**
  1. Fill in email: `test-patient@test.com`.
  2. Click submit.
- **Assertions:**
  - Success message "If this email exists, a reset link has been sent." is visible.
  - Button is disabled after click.

#### Test: Reset Password Flow
- **Starting State:** Logged out, on `/reset-password?token=VALID_TOKEN`.
- **Steps:**
  1. Fill in new password: "NewPass123!".
  2. Fill in confirm password: "NewPass123!".
  3. Click submit.
- **Assertions:**
  - Success message "Password updated successfully." is visible.
  - Redirected to `/login` after 2 seconds.

---

## Manual Verification Checklist

Complete every item below before marking Phase 1 as done:

1. **Registration:**
   - [ ] Patient can register with valid data.
   - [ ] Verification email is received and contains correct link.
   - [ ] Verification link works and marks email as verified.

2. **Login:**
   - [ ] Verified patient can log in and is redirected to `/dashboard`.
   - [ ] Doctor can log in and is redirected to `/doctor`.
   - [ ] Staff can log in and is redirected to `/admin`.
   - [ ] Wrong password returns 401 without revealing which field is wrong.
   - [ ] Unverified patient cannot log in — gets clear error.
   - [ ] Deactivated account cannot log in.

3. **Auth State:**
   - [ ] `auth_token` cookie is set after login.
   - [ ] `auth_token` cookie is cleared after logout.
   - [ ] After logout, protected routes redirect to `/login`.
   - [ ] Page refresh maintains auth state (cookie persists).

4. **Password Reset:**
   - [ ] Forgot password sends reset email.
   - [ ] Reset link expires after 1 hour.
   - [ ] Password resets successfully end-to-end.

5. **Middleware:**
   - [ ] `/login` and `/register` redirect already logged-in users to their dashboard.
   - [ ] Protected routes (e.g., `/dashboard`) redirect unauthenticated users to `/login`.
   - [ ] Role-specific middleware redirects incorrect roles.

6. **Emails:**
   - [ ] Verification email arrives and link works.
   - [ ] Password reset email arrives and link works.

7. **UI/UX:**
   - [ ] All auth pages are responsive on mobile (375px viewport).
   - [ ] Form validation errors are user-friendly.
   - [ ] Loading states are shown during API calls.

---

## Completion Criteria

Mark each item PASS or FAIL with a note before handing off to Phase 2:

```
[ ] All API tests pass (0 failures) — run `npm run test:api`
[ ] All Playwright tests pass (0 failures) — run `npm run test:e2e`
[ ] No TypeScript errors — `npx tsc --noEmit` shows 0 errors
[ ] Manual verification checklist completed
[ ] No console errors in the browser on any auth page
[ ] All auth flows work end-to-end (registration, login, logout, password reset)
[ ] Email verification and password reset emails are received and functional
[ ] Middleware redirects work correctly for all roles
```

**The phase is complete only when all 8 items above are marked PASS.**

If any item is FAIL, fix it before moving to Phase 2. Document what failed and what was done to fix it in a `notes.md` file inside the `phase-1/` folder.
