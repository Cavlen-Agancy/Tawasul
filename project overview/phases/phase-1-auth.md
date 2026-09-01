# Phase 1 — Authentication Module

## Goal
Build the complete authentication system. After this phase, patients can register, verify their email, log in, and reset their password. Doctors and staff log in with credentials created by the admin. All routes are protected by role and permission middleware.

---

## Stack Used in This Phase
- Nitro API endpoints
- Prisma (User, Permission models)
- JWT stored in httpOnly cookies
- Resend (verification + reset emails)
- HeroUI (form components)
- Zod (request validation)

---

## Overview

- Patients self-register. Email verification required before login.
- Doctor and staff accounts are created by the admin only. They skip email verification.
- JWT is stored in an httpOnly cookie named `auth_token`.
- After login, redirect by accountType: PATIENT → `/dashboard`, DOCTOR → `/doctor`, STAFF → `/admin`.
- A server middleware reads the JWT on every request and attaches the user to `event.context.user`.

---

## Step 1 — Database Updates

Add to User model in schema (already in schema.prisma — verify these fields exist):
- `emailVerificationToken` — String?
- `emailVerificationExpiry` — DateTime?
- `passwordResetToken` — String?
- `passwordResetExpiry` — DateTime?

Run `prisma db push` after confirming.

---

## Step 2 — API Endpoints

All endpoints inside `modules/auth/server/api/auth/`.

---

### POST /api/auth/register

Validation (Zod):
- `name` — string, min 2 chars
- `email` — valid email format
- `phone` — string, optional
- `password` — string, min 8 chars

Logic:
1. Validate request body with Zod. Return 400 on failure.
2. Check if User with this email exists. Return 400 "Email already in use" if found.
3. Hash password with `hashPassword`.
4. Generate verification token with `generateToken`. Set expiry to 24 hours from now.
5. Create User with `accountType: PATIENT`, `emailVerified: false`.
6. Send verification email using `emailVerificationTemplate`. URL: `APP_URL/verify-email?token=TOKEN`.
7. Return 201 `{ message: "Registration successful. Please check your email." }`.
8. Never return the password or token in the response.

---

### GET /api/auth/verify-email

Query param: `token`

Logic:
1. Find User by `emailVerificationToken`.
2. If not found → 400 "Invalid or expired link".
3. If `emailVerificationExpiry` is past → 400 "Link has expired".
4. Update User: `emailVerified: true`, clear token and expiry fields.
5. Return 200 `{ message: "Email verified. You can now log in." }`.

---

### POST /api/auth/login

Validation (Zod):
- `email` — valid email
- `password` — string, min 1 char

Logic:
1. Find User by email. If not found → 401 "Invalid credentials".
2. If `emailVerified` is false → 403 "Please verify your email before logging in".
3. If `isActive` is false → 403 "Your account has been deactivated".
4. Compare password with `comparePassword`. If wrong → 401 "Invalid credentials".
5. Generate JWT with `generateJWT`.
6. Set `auth_token` cookie: httpOnly, secure (true in production), sameSite strict, maxAge 7 days.
7. Return 200 `{ id, name, email, accountType, photo }`.

---

### POST /api/auth/logout

Logic:
1. Clear `auth_token` cookie by setting maxAge to 0.
2. Return 200 `{ message: "Logged out successfully" }`.

---

### GET /api/auth/me

Logic:
1. Call `requireAuth(event)`.
2. Fetch User by `event.context.user.userId`.
3. If STAFF, also fetch their permissions.
4. Return `{ id, name, email, phone, photo, accountType, permissions? }`.

---

### POST /api/auth/forgot-password

Validation (Zod):
- `email` — valid email

Logic:
1. Always return 200 `{ message: "If this email exists, a reset link has been sent." }` — never reveal if email exists.
2. Find User by email. If not found, return the message above silently.
3. Generate reset token. Set expiry to 1 hour.
4. Save to User record.
5. Send reset email using `passwordResetTemplate`. URL: `APP_URL/reset-password?token=TOKEN`.

---

### POST /api/auth/reset-password

Validation (Zod):
- `token` — string
- `newPassword` — string, min 8 chars

Logic:
1. Find User by `passwordResetToken`.
2. If not found → 400 "Invalid or expired link".
3. If `passwordResetExpiry` is past → 400 "Link has expired".
4. Hash new password.
5. Update User: new password, clear reset token and expiry.
6. Return 200 `{ message: "Password updated successfully." }`.

---

## Step 3 — Frontend Route Middleware

Create inside `middleware/`:

### `middleware/auth.ts`
- Checks if user is logged in via `useAuth` composable.
- If not → redirect to `/login`.

### `middleware/guest.ts`
- Checks if user is already logged in.
- If logged in → redirect to their dashboard by accountType.

### `middleware/patient-only.ts`
- Requires PATIENT accountType.
- If wrong type → redirect to correct dashboard.

### `middleware/doctor-only.ts`
- Requires DOCTOR accountType.
- If wrong type → redirect to correct dashboard.

### `middleware/staff-only.ts`
- Requires STAFF accountType.
- If wrong type → redirect to correct dashboard.

---

## Step 4 — Auth Composable

Create `modules/auth/composables/useAuth.ts`.

State (using `useState` for SSR-safe reactivity):
- `user` — `{ id, name, email, phone, photo, accountType, permissions? } | null`

Computed:
- `isLoggedIn` — `user !== null`
- `isPatient` — `user?.accountType === 'PATIENT'`
- `isDoctor` — `user?.accountType === 'DOCTOR'`
- `isStaff` — `user?.accountType === 'STAFF'`

Methods:
- `fetchMe()` — calls GET /api/auth/me, sets user state. Called on app load.
- `login(email, password)` — calls POST /api/auth/login, sets user, redirects by accountType.
- `logout()` — calls POST /api/auth/logout, clears user, redirects to /login.
- `hasPermission(resource, action)` — checks user.permissions array. Always returns true for STAFF with no permission restrictions (admin sets them). Returns false if permission not found.

Call `fetchMe()` in a Nuxt plugin `plugins/auth.ts` that runs on every page load to restore auth state from the cookie.

---

## Step 5 — Frontend Pages

All pages inside `modules/auth/pages/`. Use the `default` layout (public, no sidebar).
All forms use HeroUI components: `Input`, `Button`, `Card`, `CardBody`, `Link`.

---

### `/register`

Fields: Full Name, Email, Phone (optional), Password, Confirm Password.

Behavior:
- Client-side validation before submit (all required except phone, passwords match, min 8 chars).
- POST /api/auth/register.
- On success: show success card "Check your email to verify your account." Hide the form.
- On error: show error message below the form.
- Apply `guest` middleware.

---

### `/login`

Fields: Email, Password.

Behavior:
- POST /api/auth/login.
- On success: redirect by accountType.
- On error: show error message.
- "Forgot password?" link → `/forgot-password`.
- "Don't have an account? Register" link → `/register`.
- Apply `guest` middleware.

---

### `/verify-email`

Behavior:
- On mount: read `token` from query, call GET /api/auth/verify-email?token=TOKEN.
- Show loading state while verifying.
- On success: show success message + link to /login.
- On error: show error message + link to /login.

---

### `/forgot-password`

Field: Email.

Behavior:
- POST /api/auth/forgot-password.
- Always show "If this email exists, a reset link has been sent." after submit.
- Disable button after first click.

---

### `/reset-password`

Fields: New Password, Confirm New Password.

Behavior:
- Read `token` from query param.
- Validate passwords match, min 8 chars.
- POST /api/auth/reset-password with token and newPassword.
- On success: show success message, redirect to /login after 2 seconds.
- On error: show error message.

---

## Checks — Phase 1 Complete

- [ ] Patient registers and receives verification email
- [ ] Unverified patient cannot login — gets clear error
- [ ] Verified patient logs in and is redirected to /dashboard
- [ ] Doctor logs in (admin-created) and is redirected to /doctor
- [ ] Staff logs in and is redirected to /admin
- [ ] Wrong password returns 401 without revealing which field is wrong
- [ ] auth_token cookie is set after login and cleared after logout
- [ ] After logout, protected routes redirect to /login
- [ ] Forgot password sends reset email
- [ ] Reset link expires after 1 hour
- [ ] Password resets successfully end to end
- [ ] /login and /register redirect already logged-in users to their dashboard
- [ ] requireAuth returns 401 on protected routes with no cookie
- [ ] isActive false account cannot login

---

## Notes for the AI

- Never store JWT in localStorage. httpOnly cookie only.
- Never return password hash in any response. Use Prisma `select` explicitly.
- `fetchMe()` must run on every page load via a Nuxt plugin — without this, page refresh clears the frontend auth state even though the cookie still exists.
- All Zod validation errors must return 400 with a human-readable message field.
- The `guest` middleware must redirect to the correct dashboard per accountType — not always to /dashboard.
