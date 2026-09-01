# Phase 0 — Project Setup
## expected-output.md

---

## API Endpoints Delivered

None. Phase 0 produces no API endpoints.

---

## Pages Delivered

| Route | Layout Used | Middleware | Description |
|---|---|---|---|
| `/` | default | none | Temporary test page to verify HeroUI and layout render correctly. Replaced in Phase 2. |

---

## Components Delivered

None. No reusable components are created in Phase 0.

---

## Composables Delivered

None. Composables start in Phase 1.

---

## Server Utilities Delivered

| File | Functions Exported |
|---|---|
| `server/utils/prisma.ts` | `prisma` — singleton PrismaClient instance |
| `server/utils/auth.ts` | `hashPassword`, `comparePassword`, `generateJWT`, `verifyJWT`, `generateToken`, `requireAuth` |
| `server/utils/email.ts` | `sendEmail`, `emailVerificationTemplate`, `passwordResetTemplate`, `bookingConfirmationTemplate`, `bookingCancellationTemplate`, `doctorWelcomeTemplate`, `sessionReminderTemplate` |
| `server/utils/permissions.ts` | `requirePermission` — Permission check for STAFF routes. Created in Phase 0, used starting Phase 6. |
| `server/middleware/auth.ts` | Global middleware — no export, runs automatically on every request |

---

## Database Changes

Full schema applied via `prisma db push`. All models created:

| Table | Purpose |
|---|---|
| `users` | All account types — PATIENT, DOCTOR, STAFF |
| `doctors` | Doctor profile data linked to User |
| `availability` | Doctor weekly schedule |
| `blocked_slots` | Doctor-specific time blocks |
| `bookings` | Session bookings between patient and doctor |
| `payments` | Payment records linked to bookings |
| `session_rooms` | Jitsi room data linked to bookings |
| `permissions` | Per-resource per-action permissions for STAFF accounts |
| `settings` | Platform singleton settings record |

Seed data created:
- One `settings` record with id `"singleton"` and default values
- One `users` record with accountType `STAFF`, emailVerified `true`, using `SEED_ADMIN_EMAIL` credentials

---

## Emails Sent

None during setup. The `sendEmail` utility is tested with one manual test call during verification (see testing.md) but no emails are triggered by application logic in Phase 0.

---

## Layouts Delivered

| File | Used By |
|---|---|
| `layouts/default.vue` | All marketing pages (Phase 2) |
| `layouts/dashboard.vue` | All dashboard layouts (Phases 4–6) |

---

## Config Files Delivered

| File | Purpose |
|---|---|
| `nuxt.config.ts` | Nuxt + HeroUI + module configuration |
| `tailwind.config.ts` | Tailwind with HeroUI plugin and all content paths |
| `docker-compose.yml` | Development: postgres, pgAdmin, app |
| `docker-compose.prod.yml` | Production: postgres, app, nginx, certbot |
| `Dockerfile.dev` | Development image with hot reload |
| `Dockerfile.prod` | Multi-stage production image |
| `.env` | Development environment variables (not committed) |
| `.env.example` | Template for environment variables (committed) |
| `.gitignore` | Excludes .env, node_modules, .nuxt, .output, uploads |
| `.dockerignore` | Excludes node_modules, .nuxt, .output, .env, uploads |

---

## Environment Variables Used in Phase 0

| Variable | Where Used |
|---|---|
| `DATABASE_URL` | Prisma connection in `server/utils/prisma.ts` |
| `JWT_SECRET` | `generateJWT` and `verifyJWT` in `server/utils/auth.ts` |
| `JWT_EXPIRES_IN` | `generateJWT` in `server/utils/auth.ts` |
| `RESEND_API_KEY` | Resend client in `server/utils/email.ts` |
| `RESEND_FROM_EMAIL` | `sendEmail` in `server/utils/email.ts` |
| `RESEND_FROM_NAME` | `sendEmail` in `server/utils/email.ts` |
| `SEED_ADMIN_EMAIL` | `prisma/seed.ts` |
| `SEED_ADMIN_PASSWORD` | `prisma/seed.ts` |
| `SEED_ADMIN_NAME` | `prisma/seed.ts` |
| `PGADMIN_DEFAULT_EMAIL` | `docker-compose.yml` |
| `PGADMIN_DEFAULT_PASSWORD` | `docker-compose.yml` |
| `NODE_ENV` | Prisma singleton pattern in `server/utils/prisma.ts` |

---

## What the Next Phase (Phase 1) Will Receive

- A running Docker environment with PostgreSQL accessible at `postgresql://tawasul:tawasul_pass@postgres:5432/tawasul_db`
- All database tables created and ready
- Seed admin account in the `users` table
- `server/utils/prisma.ts` — ready to import and use
- `server/utils/auth.ts` — all auth functions ready to use
- `server/utils/email.ts` — sendEmail and all templates ready to use
- `server/utils/permissions.ts` — requirePermission ready to use
- `server/middleware/auth.ts` — running on every request, attaching user to `event.context.user`
- `layouts/default.vue` and `layouts/dashboard.vue` — ready to use
- HeroUI configured with brand primary color `#E91E8C`
- All module folders exist and are ready to receive files
