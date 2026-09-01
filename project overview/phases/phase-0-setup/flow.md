# Phase 0 — Project Setup
## flow.md

> **Post-Phase-0 amendments (user-approved)** — see `phase-0/notes.md` §7–§9. Steps that
> describe the original build ("inside Docker", three branches, `ts-node` seed,
> HeroUI, `process.env` reads) are superseded: dev now runs on the host
> (`npm run dev` + postgres/pgAdmin in Docker, port 5433), Git has a single `main`
> branch, the seed uses `tsx`, the UI layer is shadcn-vue, and server config is read via
> `useRuntimeConfig()` with a Vitest-only fallback. Follow the up-to-date checklists in
> overview.md / expected-output.md / testing.md.

---

## Feature 1 — Nuxt Project Initialization

**Action:** Run Nuxt project initialization command.

**Steps:**
1. Run `npx nuxi@latest init tawasul` and select TypeScript.
2. Replace the generated `nuxt.config.ts` with the provided `nuxt.config.ts` file exactly as-is. Do not modify it.
3. Install all dependencies listed in overview.md using `npm install`.
4. Verify `package.json` contains all required packages after install.

**Edge cases:**
- If `nuxi init` creates conflicting config files, remove them and use the provided file.
- If any package install fails, check Node.js version — must be Node 20+.

---

## Feature 2 — Docker Setup

**Action:** Set up the Docker development environment.

**Steps:**
1. Copy `docker-compose.yml`, `docker-compose.prod.yml`, `Dockerfile.dev`, `Dockerfile.prod` into project root.
2. Create `.dockerignore` with the following content:
   ```
   node_modules
   .nuxt
   .output
   .env
   uploads
   *.log
   .git
   ```
3. Run `docker compose up -d` to start postgres and pgAdmin.
4. Wait for the postgres healthcheck to pass before proceeding (check with `docker compose ps`).

**Edge cases:**
- If port 5432 is already in use, stop any local PostgreSQL instance before running Docker.
- If port 5050 is in use, change the pgAdmin port mapping in docker-compose.yml to `5051:80`.

---

## Feature 3 — Environment Variables

**Action:** Create `.env` from `.env.example`.

**Steps:**
1. Copy `.env.example` to `.env`.
2. Fill in the following values for development:
   - `DATABASE_URL=postgresql://tawasul:tawasul_pass@postgres:5432/tawasul_db`
   - `NODE_ENV=development`
   - `APP_URL=http://localhost:3000`
   - `JWT_SECRET` — run `openssl rand -base64 32` and paste the output
   - `JWT_EXPIRES_IN=7d`
   - `RESEND_API_KEY` — paste from Resend dashboard
   - `RESEND_FROM_EMAIL` — paste verified sender email
   - `RESEND_FROM_NAME=Tawasul Academy`
   - `JITSI_DOMAIN=meet.jit.si`
   - `UPLOAD_PATH=./uploads`
   - `UPLOAD_MAX_SIZE=2097152`
   - `PGADMIN_DEFAULT_EMAIL=admin@tawasul.com`
   - `PGADMIN_DEFAULT_PASSWORD=pgadmin_pass`
   - `SEED_ADMIN_EMAIL=admin@tawasul.com`
   - `SEED_ADMIN_PASSWORD=TawasulAdmin2024!`
   - `SEED_ADMIN_NAME=Platform Admin`
   - Leave all payment gateway values empty for now.
3. Verify `.env` is listed in `.gitignore`.

**Edge cases:**
- Never commit `.env` to Git. The `.gitignore` must block it.
- `JWT_SECRET` must be at least 32 characters.

---

## Feature 4 — Prisma Setup

**Action:** Apply the database schema and run the seed.

**Steps:**

**4a — Copy schema:**
Copy the provided `schema.prisma` into `prisma/schema.prisma` exactly as-is.

**4b — Apply schema:**
Run inside the app Docker container:
```
docker compose exec app npx prisma db push
```
This creates all tables in the PostgreSQL database.

**4c — Write seed file:**
Create `prisma/seed.ts`. This file does two things:

*Create Settings singleton:*
- Use `prisma.settings.upsert` with `where: { id: 'singleton' }`.
- `create` and `update` both use: `platformName: 'Tawasul Academy'`, `defaultSessionDuration: 60`, `defaultWorkingStart: '09:00'`, `defaultWorkingEnd: '17:00'`, `jitsiDomain: 'meet.jit.si'`, all other string fields set to empty string, `sessionPricePerHour: 0`.

*Create seed admin account:*
- Read `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` from `process.env`.
- If any is missing, throw an error: "Missing seed environment variables".
- Hash the password using bcryptjs with salt rounds 12.
- Use `prisma.user.upsert` with `where: { email: process.env.SEED_ADMIN_EMAIL }`.
- `create`: `{ email, password: hashedPassword, name, accountType: 'STAFF', emailVerified: true, isActive: true }`.
- `update`: `{ name, isActive: true }` — do not update password on re-run.
- Log "✓ Settings created" and "✓ Admin account created" after each upsert.
- Log "Seed complete." at the end.

**4d — Add seed script to package.json:**
```json
"prisma": {
  "seed": "ts-node --project tsconfig.json prisma/seed.ts"
}
```

**4e — Run seed:**
```
docker compose exec app npx prisma db seed
```

**Edge cases:**
- Running seed twice must not throw errors — upsert handles this.
- If `ts-node` is not found, install it: `npm install -D ts-node`.
- If the postgres container is not healthy yet, `prisma db push` will fail with a connection error. Wait for healthcheck before running.

---

## Feature 5 — Server Utilities

**Action:** Create the four shared utility files.

---

### `server/utils/prisma.ts`

Exports a single `prisma` constant that is a PrismaClient instance.

Uses a global variable to prevent multiple connections during Nuxt hot reload:
```
declare global { var __prisma: PrismaClient | undefined }
export const prisma = globalThis.__prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma
```

No other logic in this file.

---

### `server/utils/auth.ts`

Imports: `bcryptjs`, `jsonwebtoken`, `crypto`, `H3Event` from `h3`, `prisma` from `./prisma`.

Exports the following functions:

**`hashPassword(password: string): Promise<string>`**
- Call `bcrypt.hash(password, 12)`.
- Return the hash string.

**`comparePassword(plain: string, hashed: string): Promise<boolean>`**
- Call `bcrypt.compare(plain, hashed)`.
- Return the boolean result.

**`generateJWT(payload: { userId: string; email: string; accountType: string }): string`**
- Read the config via `getServerRuntimeConfig()` from `server/utils/runtime.ts`
  (`jwtSecret`, `jwtExpiresIn`) — falls back to `process.env` only under standalone Vitest.
- Call `jwt.sign(payload, secret, { expiresIn })`.
- Return the token string.

**`verifyJWT(token: string): { userId: string; email: string; accountType: string }`**
- Read the secret the same way (see above).
- Call `jwt.verify(token, secret)`.
- Return the decoded payload cast to the correct type.
- If verification fails (expired, invalid), let the error propagate — the caller handles it.

**`generateToken(): string`**
- Call `crypto.randomBytes(32).toString('hex')`.
- Return the 64-character hex string.

**`requireAuth(event: H3Event, accountTypes?: string[]): { userId: string; email: string; accountType: string }`**
- Read `event.context.user`.
- If undefined or null → throw `createError({ statusCode: 401, message: 'Unauthorized' })`.
- If `accountTypes` is provided and the user's accountType is not in the array → throw `createError({ statusCode: 403, message: 'Forbidden' })`.
- Return `event.context.user`.

---

### `server/utils/email.ts`

Imports: `Resend` from `resend`, `getServerRuntimeConfig` from `server/utils/runtime`.

Create the Resend client lazily inside the `sendEmail` helper, reading
`resendApiKey` / `resendFromEmail` / `resendFromName` via `getServerRuntimeConfig()`
(with the standalone-Vitest-only `process.env` fallback).

**`sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void>`**
- Call `resend.emails.send({ from: \`${fromName} <${fromEmail}>\`, to, subject, html })`.
- If the call throws, log the error and rethrow it.

**Email template functions — each returns an HTML string:**

`emailVerificationTemplate(name: string, verificationUrl: string): string`
- Subject line to use when calling sendEmail: `"Verify your Tawasul Academy account"`
- HTML must include: greeting with name, explanation that they need to verify their email, a prominent link/button with the verificationUrl, expiry note (link expires in 24 hours), Tawasul Academy branding.

`passwordResetTemplate(name: string, resetUrl: string): string`
- Subject: `"Reset your Tawasul Academy password"`
- HTML: greeting, explanation, reset link/button, expiry note (link expires in 1 hour), security note ("If you didn't request this, ignore this email").

`bookingConfirmationTemplate(patientName: string, doctorName: string, date: string, time: string, service: string): string`
- Subject: `"Your session is confirmed — Tawasul Academy"`
- HTML: greeting, confirmation message, session details table (doctor, date, time, service), reminder to join on time.

`bookingCancellationTemplate(patientName: string, doctorName: string, date: string, time: string): string`
- Subject: `"Your session has been cancelled — Tawasul Academy"`
- HTML: greeting, cancellation confirmation, cancelled session details, invitation to rebook.

`doctorWelcomeTemplate(doctorName: string, email: string, temporaryPassword: string, loginUrl: string): string`
- Subject: `"Welcome to Tawasul Academy — Your account is ready"`
- HTML: welcome message, login credentials (email and temporary password displayed clearly), strong instruction to change password after first login, a login button linking to `${loginUrl}/login` (the caller passes the app base URL explicitly).

`sessionReminderTemplate(recipientName: string, doctorOrPatientLabel: string, date: string, time: string): string`
- Subject: `"Reminder: Your session is tomorrow — Tawasul Academy"`
- HTML: reminder message, session details, instruction to join 5 minutes early.

**Important:** HTML templates must be complete, self-contained HTML strings with inline styles. No external CSS files — emails render in email clients that strip `<style>` tags. Use a clean, minimal design with the brand primary color `#E91E8C` for headings and buttons.

---

### `server/utils/permissions.ts`

Imports: `H3Event` from `h3`, `prisma` from `./prisma`, `requireAuth` from `./auth`.

**`requirePermission(event: H3Event, resource: string, action: string): Promise<void>`**
- Call `requireAuth(event, ['STAFF'])` — this ensures the user is authenticated and is STAFF.
- Fetch `Permission` records from DB: `prisma.permission.findMany({ where: { userId: user.userId, resource, action } })`.
- If the result array is empty → throw `createError({ statusCode: 403, message: 'You do not have permission to perform this action' })`.
- If found, return void and let the route handler continue.

---

### `server/middleware/auth.ts`

This Nitro server middleware runs on every single API request.

Steps:
1. Read the `auth_token` cookie from the request using `getCookie(event, 'auth_token')`.
2. If no cookie: set `event.context.user = null` and return (call `next()` implicitly by not throwing).
3. If cookie exists: call `verifyJWT(token)` inside a try/catch.
   - If valid: set `event.context.user = decoded` (the payload with userId, email, accountType).
   - If invalid or expired: call `deleteCookie(event, 'auth_token')`, set `event.context.user = null`, and continue.

---

## Feature 6 — HeroUI and Tailwind Configuration

**Action:** Configure HeroUI with brand colors and Tailwind.

**Steps:**

**Create `tailwind.config.ts`:**
```typescript
import { heroui } from '@heroui/nuxt'
import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.ts',
    './modules/**/*.{vue,ts}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: { extend: {} },
  darkMode: 'class',
  plugins: [heroui()],
} satisfies Config
```

**Create `assets/css/tailwind.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Create `assets/css/main.css`:**
```css
@import './tailwind.css';

* { box-sizing: border-box; }

body {
  font-family: 'Inter', sans-serif;
  color: #2D2D2D;
  background-color: #ffffff;
}
```

---

## Feature 7 — Base Layouts

**Action:** Create the two base layouts.

---

### `layouts/default.vue`

Public layout used by all marketing pages.

Structure:
- `<header>` — fixed top navbar containing:
  - Left: logo image (`/logo.png`) wrapped in a NuxtLink to `/`
  - Center: navigation links (Home, About, Services, Our Experts, Contact) — use NuxtLink for each. Links are placeholder hrefs for now (`/`, `/about`, `/services`, `/experts`, `/contact`).
  - Right: Login button (HeroUI Button, variant="bordered", size="sm") linking to `/login` + Book Now button (HeroUI Button, color="primary", size="sm") linking to `/book`.
  - Mobile: hide center links and right buttons, show a hamburger icon that opens a HeroUI Drawer with the same links stacked vertically.
- `<main>` — `<slot />` where page content renders.
- `<footer>` — simple footer with: copyright text "© 2024 Tawasul Academy", placeholder contact email and phone (will be replaced with dynamic Settings data in Phase 2).

---

### `layouts/dashboard.vue`

Base layout for all dashboard pages (patient, doctor, admin). Each dashboard creates its own layout that extends this one.

Structure:
- `<div class="flex h-screen">`:
  - Left: `<aside>` — sidebar slot (`<slot name="sidebar" />`) — 240px wide on desktop, hidden on mobile.
  - Right: `<main class="flex-1 overflow-auto">` — default slot (`<slot />`) — page content area.
- Mobile: sidebar is replaced by a bottom navigation bar (`<slot name="mobile-nav" />`).

This layout provides the shell only. Each module's layout file fills the sidebar and mobile-nav slots with its specific navigation links.

---

## Feature 8 — Test Page

**Action:** Create a temporary test page to verify everything works.

Create `pages/index.vue`:
- Display a heading "Tawasul Academy — Setup Complete"
- Display a HeroUI Button with `color="primary"` and text "Primary Color Test" to verify brand color is applied
- Display a HeroUI Card with a short text inside to verify HeroUI renders
- Use the `default` layout

This page is replaced in Phase 2 with the real home page.

---

## Feature 9 — Git Setup

**Action:** Initialize Git and set up branches.

Steps:
1. `git init`
2. Create `.gitignore`:
   ```
   .env
   .env.prod
   node_modules/
   .nuxt/
   .output/
   uploads/
   *.log
   .DS_Store
   ```
3. `git add .`
4. `git commit -m "Phase 0: Project setup"`
5. `git branch -M main`
6. All Phase 0 work lives on `main` (the later branch cleanup collapsed everything to a single `main` — see notes.md §7).
