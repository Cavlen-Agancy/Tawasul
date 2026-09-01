# Phase 0 — Project Setup

## Goal
Bootstrap the full project foundation. After this phase, the dev environment runs completely inside Docker, the database is connected, Prisma schema is applied, HeroUI is configured, and the module folder structure is in place.

---

## Stack
- Nuxt.js 3 + TypeScript
- Nitro (backend API layer)
- Prisma ORM + PostgreSQL
- HeroUI + Tailwind CSS
- Resend (email)
- Docker + Docker Compose
- Jitsi (video — no setup needed for meet.jit.si)

---

## Step 1 — Initialize Nuxt Project

Create a new Nuxt 3 project with TypeScript enabled. SSR must be on. Start clean — no starter template.

Install all required dependencies:
- `@heroui/nuxt`
- `@nuxtjs/tailwindcss`
- `@vueuse/nuxt`
- `@nuxt/image`
- `prisma` + `@prisma/client`
- `bcryptjs` + `@types/bcryptjs`
- `jsonwebtoken` + `@types/jsonwebtoken`
- `resend`
- `zod` (for request validation)

Copy `nuxt.config.ts` from the provided config file exactly as-is.

---

## Step 2 — Docker Setup

Copy the provided `docker-compose.yml`, `Dockerfile.dev`, `docker-compose.prod.yml`, and `Dockerfile.prod` files into the project root exactly as-is.

Create a `.dockerignore` file excluding:
- `node_modules`
- `.nuxt`
- `.output`
- `.env`
- `uploads`

---

## Step 3 — Environment Variables

Copy `.env.example` to `.env` and fill in the development values:
- `DATABASE_URL` — use the Docker postgres connection string
- `JWT_SECRET` — generate with `openssl rand -base64 32`
- `RESEND_API_KEY` — from Resend dashboard
- `RESEND_FROM_EMAIL` — verified sender on Resend
- `JITSI_DOMAIN` — `meet.jit.si`
- Leave payment gateway values empty for now — filled in Phase 3
- `NODE_ENV=development`

---

## Step 4 — Prisma Setup

Copy the provided `schema.prisma` into `prisma/schema.prisma` exactly as-is.

Create `prisma/seed.ts`:

This file must:
1. Create the Settings singleton record using `upsert` with id `"singleton"` and all default values from the schema.
2. Create the initial admin User account using `upsert` on email. Use values from `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` environment variables. Hash the password with bcryptjs (salt rounds: 12). Set `accountType` to `STAFF`, `emailVerified` to `true`, `isActive` to `true`.
3. Log "Seed complete" when done.

Add the seed script to `package.json`:
```json
"prisma": {
  "seed": "ts-node --project tsconfig.json prisma/seed.ts"
}
```

---

## Step 5 — Module Folder Structure

Create the following folder structure. All folders must exist even if empty:

```
modules/
  auth/
    components/
    composables/
    pages/
    server/
      api/
        auth/
  booking/
    components/
    composables/
    pages/
    server/
      api/
        booking/
  payment/
    components/
    composables/
    pages/
    server/
      api/
        payment/
  patient/
    components/
    composables/
    pages/
    server/
      api/
        patient/
  doctor/
    components/
    composables/
    pages/
    server/
      api/
        doctor/
  admin/
    components/
    composables/
    pages/
    server/
      api/
        admin/
  session/
    components/
    composables/
    pages/
    server/
      api/
        session/

server/
  middleware/
  utils/

middleware/
layouts/
pages/
components/
composables/
assets/
  css/
public/
uploads/
```

---

## Step 6 — Server Utilities

Create the following utility files. These are used across all phases.

### `server/utils/prisma.ts`
Export a single shared PrismaClient instance. Use a global variable to prevent multiple instances during hot reload in development:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### `server/utils/auth.ts`
Export these functions:
- `hashPassword(password: string): Promise<string>` — bcryptjs hash, salt rounds 12
- `comparePassword(plain: string, hashed: string): Promise<boolean>` — bcryptjs compare
- `generateJWT(payload: { userId: string, email: string, accountType: string }): string` — sign with JWT_SECRET, expiry from JWT_EXPIRES_IN
- `verifyJWT(token: string): { userId: string, email: string, accountType: string }` — verify and decode, throw if invalid
- `generateToken(): string` — crypto.randomBytes(32).toString('hex')
- `requireAuth(event: H3Event, accountTypes?: string[]): { userId: string, email: string, accountType: string }` — read from event.context.user, throw 401 if missing, throw 403 if role not in allowed list

### `server/utils/email.ts`
Export:
- `sendEmail({ to, subject, html }: { to: string, subject: string, html: string }): Promise<void>` — send via Resend using RESEND_API_KEY, from RESEND_FROM_EMAIL with name RESEND_FROM_NAME

Export these email template functions (each returns an HTML string):
- `emailVerificationTemplate(name: string, verificationUrl: string): string`
- `passwordResetTemplate(name: string, resetUrl: string): string`
- `bookingConfirmationTemplate(patientName: string, doctorName: string, date: string, time: string, service: string): string`
- `bookingCancellationTemplate(patientName: string, doctorName: string, date: string, time: string): string`
- `doctorWelcomeTemplate(doctorName: string, email: string, temporaryPassword: string): string`
- `sessionReminderTemplate(recipientName: string, doctorName: string, date: string, time: string): string`

### `server/utils/permissions.ts`
Export:
- `requirePermission(event: H3Event, resource: string, action: string): Promise<void>` — fetch the user's permissions from the database, throw 403 if the required permission is not found. STAFF accountType uses this. PATIENT and DOCTOR have fixed access defined by route middleware — they do not go through the permission check.

### `server/middleware/auth.ts`
Nitro server middleware that runs on every request:
1. Read the `auth_token` cookie.
2. If no cookie, continue without setting context.
3. If cookie exists, call `verifyJWT`. If valid, attach decoded payload to `event.context.user`. If invalid, clear the cookie and continue.

---

## Step 7 — HeroUI + Tailwind Setup

Create `tailwind.config.ts`:
- Content paths must include all module page and component directories
- Include HeroUI plugin: `const { heroui } = require('@heroui/nuxt')`
- Add HeroUI to plugins array

Create `assets/css/tailwind.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `assets/css/main.css`:
- Import tailwind.css
- Set base font to Inter
- Set base text color to `#2D2D2D`
- Set base background to `#ffffff`

---

## Step 8 — Base Layouts

Create `layouts/default.vue` — public layout used by marketing pages:
- No sidebar
- Top navigation bar with logo, nav links, Login button, and Book Now CTA button (HeroUI Button, primary color)
- Footer with contact info and copyright

Create `layouts/dashboard.vue` — base dashboard layout:
- Sidebar on desktop (240px wide)
- Top bar on mobile with hamburger menu
- Main content slot
- This layout is extended by patient, doctor, and admin layouts

---

## Step 9 — Git Setup

Initialize Git repository.

Create `.gitignore` excluding:
- `.env`
- `node_modules`
- `.nuxt`
- `.output`
- `uploads`
- `*.log`

Create branches:
- `main` — production only
- `dev` — integration branch
- Start working on `feature/phase-0-setup`

---

## Checks — Phase 0 Complete

- [ ] `docker compose up` starts all three services with no errors
- [ ] pgAdmin accessible at http://localhost:5050
- [ ] Nuxt dev server accessible at http://localhost:3000
- [ ] Hot reload works inside Docker when a file is changed
- [ ] `prisma db push` runs without errors and creates all tables
- [ ] pgAdmin shows all tables from schema.prisma
- [ ] `prisma db seed` creates the admin account and settings record
- [ ] A test email sends successfully via the sendEmail utility
- [ ] HeroUI components render correctly on a test page with brand primary color
- [ ] All module folders exist in the correct structure
- [ ] `.env` is not committed to Git

---

## Notes for the AI

- Use the exact `schema.prisma`, `.env.example`, `nuxt.config.ts`, `docker-compose.yml`, and Dockerfile files provided. Do not modify them.
- The Prisma singleton pattern in `server/utils/prisma.ts` is required — without it, hot reload creates too many database connections and crashes.
- The seed file must use `upsert` not `create` — running it twice must not throw errors.
- Do not create any pages beyond a simple `/test` page to verify HeroUI renders correctly. All real pages start in Phase 1.
- If `prisma db push` fails, check that the postgres container is healthy before the app starts — the healthcheck in docker-compose.yml handles this.
