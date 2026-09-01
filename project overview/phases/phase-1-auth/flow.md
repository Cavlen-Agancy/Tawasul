# Phase 1 — Authentication Module
## flow.md

---

## Feature 1 — Database Updates

**Action:** Verify `User` model fields for email verification and password reset.

**Steps:**
1. Open `prisma/schema.prisma` and confirm the `User` model includes:
   - `emailVerificationToken: String?`
   - `emailVerificationExpiry: DateTime?`
   - `passwordResetToken: String?`
   - `passwordResetExpiry: DateTime?`
2. If any field is missing, add it and run `npx prisma db push`.

**Edge Cases:**
- If the database already has users, ensure `prisma db push` does not drop existing data.

---

## Feature 2 — API Endpoints

---

### POST /api/auth/register

**User Action:** Patient submits registration form with name, email, phone (optional), and password.

**Frontend Behavior:**
- Form fields: Full Name (required), Email (required, valid format), Phone (optional), Password (required, min 8 chars), Confirm Password (required, must match).
- Client-side validation before submit.
- On success: Show success card with message "Check your email to verify your account." Hide the form.
- On error: Show error message below the form.

**API Call:**
- **Method:** POST
- **Path:** `/api/auth/register`
- **Body:**
  ```typescript
  {
    name: string (min 2 chars),
    email: string (valid email),
    phone?: string,
    password: string (min 8 chars)
  }
  ```
- **Response (Success):**
  ```typescript
  { message: "Registration successful. Please check your email." }
  ```
  - **Status:** 201
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400 (validation error) or 400 (email already in use)

**Server Logic:**
1. Validate request body with Zod:
   - `name`: string, min 2 chars.
   - `email`: valid email format.
   - `phone`: optional string.
   - `password`: string, min 8 chars.
2. Check if a `User` with the provided email already exists. If found, return 400 with `{ message: "Email already in use" }`.
3. Hash the password using `hashPassword(password)`.
4. Generate a verification token using `generateToken()`.
5. Set `emailVerificationExpiry` to 24 hours from now.
6. Create a new `User` with:
   - `accountType: PATIENT`
   - `emailVerified: false`
   - `isActive: true`
   - `emailVerificationToken` and `emailVerificationExpiry` set.
7. Send verification email using `emailVerificationTemplate` with URL: `${APP_URL}/verify-email?token=${TOKEN}`.
8. Return 201 with success message.

**Edge Cases:**
- Email already exists: Return 400.
- Invalid email format: Return 400.
- Password too short: Return 400.
- Email sending fails: Log error but still return 201 (email may be sent asynchronously).

---

### GET /api/auth/verify-email

**User Action:** User clicks verification link in their email.

**Frontend Behavior:**
- On mount: Read `token` from query param.
- Show loading state while verifying.
- On success: Show success message + link to `/login`.
- On error: Show error message + link to `/login`.

**API Call:**
- **Method:** GET
- **Path:** `/api/auth/verify-email`
- **Query Param:** `token: string`
- **Response (Success):**
  ```typescript
  { message: "Email verified. You can now log in." }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400

**Server Logic:**
1. Find `User` by `emailVerificationToken`.
2. If not found → return 400 with `{ message: "Invalid or expired link" }`.
3. If `emailVerificationExpiry` is in the past → return 400 with `{ message: "Link has expired" }`.
4. Update `User`:
   - `emailVerified: true`
   - `emailVerificationToken: null`
   - `emailVerificationExpiry: null`
5. Return 200 with success message.

**Edge Cases:**
- Token not found: Return 400.
- Token expired: Return 400.
- User already verified: Still clear token and return success.

---

### POST /api/auth/login

**User Action:** User submits login form with email and password.

**Frontend Behavior:**
- On success: Redirect to dashboard based on `accountType`.
- On error: Show error message.

**API Call:**
- **Method:** POST
- **Path:** `/api/auth/login`
- **Body:**
  ```typescript
  {
    email: string (valid email),
    password: string (min 1 char)
  }
  ```
- **Response (Success):**
  ```typescript
  {
    id: string,
    name: string,
    email: string,
    accountType: AccountType,
    photo?: string
  }
  ```
  - **Status:** 200
  - **Cookies:** `auth_token` (httpOnly, secure in production, sameSite strict, maxAge 7 days)
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 401 (invalid credentials) or 403 (email not verified or account deactivated)

**Server Logic:**
1. Find `User` by email. If not found → return 401 with `{ message: "Invalid credentials" }`.
2. If `emailVerified` is false → return 403 with `{ message: "Please verify your email before logging in" }`.
3. If `isActive` is false → return 403 with `{ message: "Your account has been deactivated" }`.
4. Compare password with `comparePassword(plain, hashed)`. If wrong → return 401 with `{ message: "Invalid credentials" }`.
5. Generate JWT with `generateJWT({ userId, email, accountType })`.
6. Set `auth_token` cookie with the JWT.
7. Return user data (exclude password and tokens).

**Edge Cases:**
- User not found: Return 401 (do not reveal if email exists).
- Wrong password: Return 401.
- Email not verified: Return 403.
- Account deactivated: Return 403.

---

### POST /api/auth/logout

**User Action:** User clicks logout button.

**Frontend Behavior:**
- On success: Clear user state, redirect to `/login`.

**API Call:**
- **Method:** POST
- **Path:** `/api/auth/logout`
- **Response (Success):**
  ```typescript
  { message: "Logged out successfully" }
  ```
  - **Status:** 200
  - **Cookies:** `auth_token` cleared (maxAge 0)

**Server Logic:**
1. Clear `auth_token` cookie by setting `maxAge: 0`.
2. Return 200 with success message.

---

### GET /api/auth/me

**User Action:** Page load or user state refresh.

**Frontend Behavior:**
- Called automatically on app load via `useAuth` composable.
- Updates frontend user state.

**API Call:**
- **Method:** GET
- **Path:** `/api/auth/me`
- **Auth:** Required (via `requireAuth`)
- **Response (Success):**
  ```typescript
  {
    id: string,
    name: string,
    email: string,
    phone?: string,
    photo?: string,
    accountType: AccountType,
    permissions?: Permission[] (only for STAFF)
  }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 401 (unauthorized)

**Server Logic:**
1. Call `requireAuth(event)`.
2. Fetch `User` by `event.context.user.userId`.
3. If `accountType` is `STAFF`, fetch their `permissions`.
4. Return user data (exclude password and tokens).

---

### POST /api/auth/forgot-password

**User Action:** User submits email on forgot password page.

**Frontend Behavior:**
- Always show success message: "If this email exists, a reset link has been sent."
- Disable button after first click.

**API Call:**
- **Method:** POST
- **Path:** `/api/auth/forgot-password`
- **Body:**
  ```typescript
  { email: string (valid email) }
  ```
- **Response (Success):**
  ```typescript
  { message: "If this email exists, a reset link has been sent." }
  ```
  - **Status:** 200

**Server Logic:**
1. Always return 200 with the success message (never reveal if email exists).
2. Find `User` by email. If not found, return the message silently.
3. Generate a reset token using `generateToken()`.
4. Set `passwordResetExpiry` to 1 hour from now.
5. Save `passwordResetToken` and `passwordResetExpiry` to the `User` record.
6. Send reset email using `passwordResetTemplate` with URL: `${APP_URL}/reset-password?token=${TOKEN}`.

**Edge Cases:**
- Email not found: Still return 200.
- Email sending fails: Log error but return 200.

---

### POST /api/auth/reset-password

**User Action:** User submits new password on reset password page.

**Frontend Behavior:**
- On success: Show success message, redirect to `/login` after 2 seconds.
- On error: Show error message.

**API Call:**
- **Method:** POST
- **Path:** `/api/auth/reset-password`
- **Body:**
  ```typescript
  {
    token: string,
    newPassword: string (min 8 chars)
  }
  ```
- **Response (Success):**
  ```typescript
  { message: "Password updated successfully." }
  ```
  - **Status:** 200
- **Response (Error):**
  ```typescript
  { message: string }
  ```
  - **Status:** 400

**Server Logic:**
1. Find `User` by `passwordResetToken`.
2. If not found → return 400 with `{ message: "Invalid or expired link" }`.
3. If `passwordResetExpiry` is in the past → return 400 with `{ message: "Link has expired" }`.
4. Hash the new password using `hashPassword(newPassword)`.
5. Update `User`:
   - `password: hashedPassword`
   - `passwordResetToken: null`
   - `passwordResetExpiry: null`
6. Return 200 with success message.

**Edge Cases:**
- Token not found: Return 400.
- Token expired: Return 400.
- New password too short: Return 400.

---

## Feature 3 — Frontend Route Middleware

---

### `middleware/auth.ts`

**Purpose:** Protect routes that require authentication.

**Logic:**
1. Use `useAuth()` composable to check if user is logged in.
2. If not logged in → redirect to `/login`.

---

### `middleware/guest.ts`

**Purpose:** Redirect already logged-in users away from auth pages.

**Logic:**
1. Use `useAuth()` to check if user is logged in.
2. If logged in → redirect to their dashboard based on `accountType`:
   - `PATIENT` → `/dashboard`
   - `DOCTOR` → `/doctor`
   - `STAFF` → `/admin`

---

### `middleware/patient-only.ts`

**Purpose:** Restrict access to patient-only routes.

**Logic:**
1. Use `useAuth()` to check if user is logged in and is a `PATIENT`.
2. If not logged in → redirect to `/login`.
3. If logged in but not `PATIENT` → redirect to their correct dashboard.

---

### `middleware/doctor-only.ts`

**Purpose:** Restrict access to doctor-only routes.

**Logic:**
1. Use `useAuth()` to check if user is logged in and is a `DOCTOR`.
2. If not logged in → redirect to `/login`.
3. If logged in but not `DOCTOR` → redirect to their correct dashboard.

---

### `middleware/staff-only.ts`

**Purpose:** Restrict access to staff-only routes.

**Logic:**
1. Use `useAuth()` to check if user is logged in and is a `STAFF`.
2. If not logged in → redirect to `/login`.
3. If logged in but not `STAFF` → redirect to their correct dashboard.

---

## Feature 4 — Auth Composable

**File:** `modules/auth/composables/useAuth.ts`

**State:**
```typescript
const user = useState<{
  id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  accountType: AccountType;
  permissions?: Permission[];
} | null>('auth-user', () => null)
```

**Computed:**
```typescript
const isLoggedIn = computed(() => user.value !== null)
const isPatient = computed(() => user.value?.accountType === 'PATIENT')
const isDoctor = computed(() => user.value?.accountType === 'DOCTOR')
const isStaff = computed(() => user.value?.accountType === 'STAFF')
```

**Methods:**
- `fetchMe()`: Calls `GET /api/auth/me`, sets `user` state. Called on app load.
- `login(email: string, password: string)`: Calls `POST /api/auth/login`, sets `user`, redirects by `accountType`.
- `logout()`: Calls `POST /api/auth/logout`, clears `user`, redirects to `/login`.
- `hasPermission(resource: Resource, action: Action)`: Checks `user.value?.permissions` array. Returns `true` if permission exists, `false` otherwise. For non-STAFF users, always return `false`.

---

## Feature 5 — Frontend Pages

---

### `/register`

**Layout:** `default`
**Middleware:** `guest`

**Behavior:**
- Form with fields: Full Name, Email, Phone (optional), Password, Confirm Password.
- Client-side validation:
  - All fields required except phone.
  - Passwords must match.
  - Password min 8 chars.
- On submit: Call `POST /api/auth/register`.
- On success: Show success card with message and link to `/login`.
- On error: Show error message below form.

---

### `/login`

**Layout:** `default`
**Middleware:** `guest`

**Behavior:**
- Form with fields: Email, Password.
- On submit: Call `POST /api/auth/login`.
- On success: Redirect by `accountType`.
- On error: Show error message.
- Links:
  - "Forgot password?" → `/forgot-password`
  - "Don't have an account? Register" → `/register`

---

### `/verify-email`

**Layout:** `default`
**Middleware:** None

**Behavior:**
- On mount: Read `token` from query, call `GET /api/auth/verify-email?token=TOKEN`.
- Show loading state while verifying.
- On success: Show success message + link to `/login`.
- On error: Show error message + link to `/login`.

---

### `/forgot-password`

**Layout:** `default`
**Middleware:** `guest`

**Behavior:**
- Form with field: Email.
- On submit: Call `POST /api/auth/forgot-password`.
- Always show success message: "If this email exists, a reset link has been sent."
- Disable button after first click.

---

### `/reset-password`

**Layout:** `default`
**Middleware:** None

**Behavior:**
- Read `token` from query param.
- Form with fields: New Password, Confirm New Password.
- Client-side validation: Passwords must match, min 8 chars.
- On submit: Call `POST /api/auth/reset-password` with `token` and `newPassword`.
- On success: Show success message, redirect to `/login` after 2 seconds.
- On error: Show error message.

---

## Feature 6 — Auth Plugin

**File:** `plugins/auth.ts`

**Purpose:** Restore auth state from cookie on every page load.

**Logic:**
1. Run on client-side only (use `process.client`).
2. Call `fetchMe()` from `useAuth` composable.
3. If `fetchMe` fails (401), clear user state and continue.

---

## Edge Cases Summary

- Email already exists during registration: Return 400.
- Invalid email format: Return 400.
- Password too short: Return 400.
- Email verification token expired: Return 400.
- Password reset token expired: Return 400.
- User not found during login: Return 401 (do not reveal if email exists).
- Wrong password: Return 401.
- Email not verified: Return 403.
- Account deactivated: Return 403.
- Forgot password for non-existent email: Return 200 (do not reveal).
- JWT tampered or expired: Clear cookie and return 401.
