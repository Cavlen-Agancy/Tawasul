# Phase 1 — Authentication Module
## expected-output.md

---

## API Endpoints Delivered

| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a new patient account. Sends verification email. |
| GET | `/api/auth/verify-email` | No | Verify email using token from verification link. |
| POST | `/api/auth/login` | No | Log in with email and password. Sets `auth_token` cookie. |
| POST | `/api/auth/logout` | Yes | Clear `auth_token` cookie. |
| GET | `/api/auth/me` | Yes | Fetch logged-in user details. |
| POST | `/api/auth/forgot-password` | No | Send password reset email. |
| POST | `/api/auth/reset-password` | No | Reset password using token. |

---

## Pages Delivered

| Route | Layout Used | Middleware Applied | Description |
|---|---|---|---|
| `/register` | `default` | `guest` | Patient registration form. |
| `/login` | `default` | `guest` | Login form for all roles. |
| `/verify-email` | `default` | None | Email verification page. |
| `/forgot-password` | `default` | `guest` | Forgot password form. |
| `/reset-password` | `default` | None | Reset password form. |

---

## Components Delivered

None. All auth pages use HeroUI components directly (Input, Button, Card, Link, etc.).

---

## Composables Delivered

| File | State | Computed | Methods |
|---|---|---|---|
| `modules/auth/composables/useAuth.ts` | `user: { id, name, email, phone?, photo?, accountType, permissions? } \| null` | `isLoggedIn`, `isPatient`, `isDoctor`, `isStaff` | `fetchMe()`, `login(email, password)`, `logout()`, `hasPermission(resource, action)` |

---

## Server Utilities Delivered

**Reused from Phase 0:**
- `server/utils/prisma.ts` — `prisma` singleton.
- `server/utils/auth.ts` — `hashPassword`, `comparePassword`, `generateJWT`, `verifyJWT`, `generateToken`, `requireAuth`.
- `server/utils/email.ts` — `sendEmail`, `emailVerificationTemplate`, `passwordResetTemplate`.
- `server/middleware/auth.ts` — Global JWT cookie reader.

**New in Phase 1:**
None. All utilities are reused from Phase 0.

---

## Middleware Delivered

| File | Purpose |
|---|---|
| `middleware/auth.ts` | Redirect to `/login` if not authenticated. |
| `middleware/guest.ts` | Redirect to role-specific dashboard if already logged in. |
| `middleware/patient-only.ts` | Allow only PATIENT users. Redirect others. |
| `middleware/doctor-only.ts` | Allow only DOCTOR users. Redirect others. |
| `middleware/staff-only.ts` | Allow only STAFF users. Redirect others. |

---

## Plugins Delivered

| File | Purpose |
|---|---|
| `plugins/auth.ts` | Restore auth state from cookie on every page load. |

---

## Database Changes

No schema changes in this phase. The `User` model already includes all required fields from Phase 0:
- `emailVerificationToken: String?`
- `emailVerificationExpiry: DateTime?`
- `passwordResetToken: String?`
- `passwordResetExpiry: DateTime?`

---

## Emails Sent

| Trigger Event | Recipient | Template Used | Key Variables |
|---|---|---|---|
| Patient registration | Patient email | `emailVerificationTemplate` | `name`, `verificationUrl` |
| Forgot password | Patient email | `passwordResetTemplate` | `name`, `resetUrl` |

---

## Environment Variables Used

| Variable | Where Used |
|---|---|
| `APP_URL` | Verification and reset email URLs in `server/api/auth/register.post.ts` and `server/api/auth/forgot-password.post.ts`. |
| `JWT_SECRET` | `generateJWT` and `verifyJWT` in `server/utils/auth.ts`. |
| `JWT_EXPIRES_IN` | `generateJWT` in `server/utils/auth.ts`. |
| `RESEND_API_KEY` | `sendEmail` in `server/utils/email.ts`. |
| `RESEND_FROM_EMAIL` | `sendEmail` in `server/utils/email.ts`. |
| `RESEND_FROM_NAME` | `sendEmail` in `server/utils/email.ts`. |

---

## What the Next Phase (Phase 2) Will Receive

- All auth API endpoints working and tested.
- All auth pages (`/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`) working and tested.
- `useAuth` composable with full functionality.
- All middleware (`auth`, `guest`, `patient-only`, `doctor-only`, `staff-only`) working.
- Auth plugin restoring user state on page load.
- Email verification and password reset flows fully functional.
- JWT cookie-based authentication working across all routes.
