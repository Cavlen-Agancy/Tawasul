# Phase 1 — Authentication Module
## overview.md

---

## Goal

Phase 1 builds the complete authentication system for the Tawasul Academy platform. After this phase, patients can register, verify their email, log in, and reset their password. Doctors and staff can log in with credentials created by the admin. All routes are protected by role and permission middleware. The system uses JWT stored in httpOnly cookies for secure session management.

---

## Scope

- **Database Updates**: Verify `User` model fields for email verification and password reset tokens.
- **API Endpoints**: 7 endpoints for registration, email verification, login, logout, user profile, forgot password, and reset password.
- **Frontend Route Middleware**: 5 middleware files (`auth.ts`, `guest.ts`, `patient-only.ts`, `doctor-only.ts`, `staff-only.ts`).
- **Auth Composable**: `useAuth.ts` with state, computed properties, and methods for authentication.
- **Frontend Pages**: 5 pages (`/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`).
- **Server Utilities**: Use existing `server/utils/auth.ts` and `server/utils/email.ts` from Phase 0.

---

## Out of Scope

- Doctor or staff registration (only admin can create these accounts in Phase 6).
- Dashboard pages (Phases 4–6).
- Booking or payment logic (Phase 3).
- Marketing pages (Phase 2).
- Permission-based access control (Phase 6).

---

## Dependencies

**Must exist from Phase 0:**
- `server/utils/prisma.ts` — singleton Prisma client.
- `server/utils/auth.ts` — `hashPassword`, `comparePassword`, `generateJWT`, `verifyJWT`, `generateToken`, `requireAuth`.
- `server/utils/email.ts` — `sendEmail`, `emailVerificationTemplate`, `passwordResetTemplate`.
- `server/middleware/auth.ts` — global JWT cookie reader.
- `layouts/default.vue` — public layout for auth pages.
- All `User` model fields in `schema.prisma`.
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `APP_URL`.

---

## Stack Used

```
nuxt: ^3.x
shadcn-vue: latest
zod: ^3.x
bcryptjs: ^2.x
jsonwebtoken: ^9.x
resend: ^3.x
```

---

## Folder Structure

```
modules/auth/
├── composables/
│   └── useAuth.ts              (create)
├── pages/
│   ├── register.vue            (create)
│   ├── login.vue               (create)
│   ├── verify-email.vue        (create)
│   ├── forgot-password.vue     (create)
│   └── reset-password.vue      (create)
└── server/
    └── api/
        └── auth/
            ├── register.post.ts (create)
            ├── verify-email.get.ts (create)
            ├── login.post.ts    (create)
            ├── logout.post.ts   (create)
            ├── me.get.ts         (create)
            ├── forgot-password.post.ts (create)
            └── reset-password.post.ts (create)

middleware/
├── auth.ts                    (create)
├── guest.ts                   (create)
├── patient-only.ts            (create)
├── doctor-only.ts             (create)
└── staff-only.ts              (create)

plugins/
└── auth.ts                   (create)
```

---

## Key Conventions

- **API Routes**: Use Nitro file-based routing. Each endpoint is a separate file (e.g., `register.post.ts` for `POST /api/auth/register`).
- **Validation**: Use Zod for request body validation. Return 400 with `{ message: string }` on validation failure.
- **Auth Protection**: Call `requireAuth(event)` as the first line in protected endpoints.
- **Cookies**: JWT is stored in an `httpOnly` cookie named `auth_token`. Use `setCookie` and `deleteCookie` from `h3`.
- **Redirects**: After login, redirect by `accountType`: `PATIENT` → `/dashboard`, `DOCTOR` → `/doctor`, `STAFF` → `/admin`.
- **Error Handling**: Never reveal if an email exists in the system (e.g., forgot password always returns success message).
- **Passwords**: Never return password hashes in responses. Use Prisma `select` to exclude sensitive fields.
- **Email Templates**: Use templates from `server/utils/email.ts`.

---

## Notes for the AI

- The `guest` middleware must redirect logged-in users to their respective dashboards based on `accountType`.
- The `auth` middleware must redirect unauthenticated users to `/login`.
- `fetchMe()` in `useAuth` must run on every page load via a Nuxt plugin to restore auth state from the cookie.
- All Zod validation errors must return 400 with a human-readable `message` field.
- Email verification tokens expire after 24 hours. Password reset tokens expire after 1 hour.
