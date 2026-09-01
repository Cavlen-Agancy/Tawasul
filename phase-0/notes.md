# Phase 0 Notes — Deviations & Fixes

All items from the Phase 0 checklist were completed. The following deviations from the
original guidelines were required to make the stack actually work.

## 1. UI library: HeroUI → shadcn-vue

- **Problem:** The original plan bundled `@heroui/nuxt`. This package does not exist on npm.
  HeroUI (previously NextUI) is a React-only component library; there is no Vue/Nuxt
  integration (`@heroui/react` is the real package and cannot render inside Nuxt templates).
- **Fix (user-approved):** Switched the UI layer to **shadcn-vue** — a Tailwind-based
  copy-in component library for Vue (Button, Card, Input, etc.).
- **What changed:**
  - `nuxt.config.ts`: removed `@heroui/nuxt` module and the `heroui:` theme block.
  - `tailwind.config.ts`: shadcn-vue theme tokens (CSS variables) mapped to the Tawasul
    brand palette from `UI-RULES.md` (primary `#E91E8C`, deep `#C4157A`, soft `#FCE4F3`,
    ink `#2D2D2D`, canvas `#FFFFFF`, hairline `#EBEBEB`, etc.).
  - Added `lib/utils.ts` (`cn` helper, clsx + tailwind-merge) and `components/ui/`
    (Button, Card + CardHeader/Title/Description/Content/Footer).
  - Removed the explicit `tailwindcss:` block from `nuxt.config.ts` — the
    `@nuxtjs/tailwindcss` defaults already point to `~/assets/css/tailwind.css` and
    `tailwind.config.ts`.

## 2. Postgres host port mapping 5432 → 5433

- **Problem:** The default port `5432` on this machine was already published by another
  running container (`marketos-db-1`), so `docker compose up` would fail with a port
  conflict.
- **Fix:** In `docker-compose.yml`, the postgres service publishes `5433:5432` on the host.
  No change is needed by the app — it connects inside the Docker network via the
  `postgres` hostname, which is unaffected.

## 3. Prisma inside the Alpine container needs OpenSSL

- **Problem:** `npx prisma db push` inside the `node:20-alpine` container failed with
  "Prisma failed to detect the libssl/openssl version" because Alpine node images do not
  ship OpenSSL.
- **Fix:** Added `RUN apk add --no-cache openssl` to `Dockerfile.dev`.

## 4. Seed runner ts-node → tsx

- **Problem:** `prisma db seed` configured with `ts-node --project tsconfig.json` failed
  against the Nuxt-generated tsconfig: first with typed `process.env` diagnostics
  (TS2591), then with `ERR_UNKNOWN_FILE_EXTENSION` because Nuxt sets module resolution
  that Node's CommonJS loader cannot run.
- **Fix:** `package.json` seed command is now `tsx prisma/seed.ts` (`tsx` added as a dev
  dependency). Idempotent — verified by running `prisma db seed` twice.

## 5. Placeholder logo/favicon

- **Problem:** `@nuxt/image` resolves `public/logo.png` from `layouts/default.vue` and the
  production build failed because the file did not exist.
- **Fix:** Generated placeholder brand-magenta `public/logo.png` and `public/favicon.png`.
  Replace with the real Tawasul logo before launch.

## 6. TypeScript check (`npx tsc --noEmit`)

- **Problem:** Plain `tsc` reports false positives on `nuxt.config.ts` (module
  `@heroui/nuxt` config key removed, but Nuxt module augmentations for `tailwindcss`/
  `nitro` are also not visible to plain `tsc` with the default generated tsconfig).
- **Fix:** `nuxt.config.ts` is type-checked by Nuxt itself at build time (build passes).
  It is excluded from the plain `tsc` pass in `tsconfig.json`. All application and server
  source still type-checks cleanly with `npx tsc --noEmit` (0 errors).

## Verification summary

- `docker compose up -d --build` — 3 containers healthy (postgres healthcheck passing).
- `prisma db push` — 9 tables created: users, doctors, availability, blocked_slots,
  bookings, payments, session_rooms, permissions, settings.
- `prisma db seed` — settings singleton + STAFF admin created; re-run is idempotent.
- `npm test` — 53/53 unit tests pass (auth, email templates, permissions).
- `npx tsc --noEmit` — 0 errors.
- `npm run build` — production build completes successfully.
- App serves `http://localhost:3000` (200, test page renders).
- pgAdmin at `http://localhost:5050`, postgres reachable on host at `localhost:5433`.

## 7. Post-review amendments (user-approved)

Recorded after the Phase 0 implementation review. These decisions supersede parts of the
original Phase 0 spec, so the spec docs and today's reality stay aligned.

- **Dev environment separation (dev runs on the host).** `docker-compose.yml` now contains
  only `postgres` (host port `5433`) and `pgAdmin`. The `app` service was removed by user
  request — the Nuxt dev server runs directly on the host with `npm run dev`.
  - `DATABASE_URL` in `.env` / `.env.example` is now
    `postgresql://tawasul:tawasul_pass@localhost:5433/tawasul_db` (host-facing).
  - `Dockerfile.dev` is retained but no longer referenced by `docker-compose.yml`.
  - Added scripts `dev:db` / `dev:db:stop` and the `dev-start.sh` helper for the new
    host-based workflow (see `phase-0-setup/testing.md` for the updated checklist).
- **Git branches collapsed to a single `main`.** The original three-branch plan
  (`main`, `dev`, `feature/phase-0-setup`) was replaced by one `main` branch during the
  user-requested repository cleanup. No history rewrite or force-push was involved.
- **Unit test location.** Tests are written in `tests/utils/` (the paths listed under
  testing.md), not `phase-0/tests/`. The leftover empty `phase-0/tests/` placeholder was
  removed. Vitest includes `tests/**/*.{test,spec}.ts`.

## 8. Environment variable access — useRuntimeConfig() refactor

`server/utils/auth.ts` and `server/utils/email.ts` now resolve configuration through
`useRuntimeConfig()` at runtime (values are bootstrapped from env in `nuxt.config.ts`).
`server/utils/runtime.ts` exposes `getServerRuntimeConfig()`, which returns the Nuxt/Nitro
runtime config when available and `null` under the standalone, bare-node Vitest
environment mandated by testing.md.

Remaining `process.env` accesses are confined to three documented cases:

1. **Vitest-only fallbacks** — `getServerRuntimeConfig()?.... ?? process.env.*` in
   `server/utils/auth.ts`, `server/utils/email.ts`, and the two auth routes
   (`register.post.ts`, `forgot-password.post.ts` read the public app URL that way).
   These branches only run when the file is executed without the Nuxt/Nitro runtime
   (unit/API tests per testing.md). Under the real Nitro runtime the value always comes
   from `useRuntimeConfig()`.
2. **`process.env.NODE_ENV`** — a build/deployment-time variable, not app config. Used by
   the Prisma hot-reload singleton guard in `server/utils/prisma.ts` (original spec code)
   and the cookie `secure` flag in `modules/auth/server/api/auth/login.post.ts`.
3. **`nuxt.config.ts`** — env → `runtimeConfig` bootstrapping at build/start time. This is
   the intended place to map `process.env` into config.

## 9. doctorWelcomeTemplate signature

`doctorWelcomeTemplate(doctorName, email, temporaryPassword, loginUrl)` now receives the
login URL explicitly instead of reading `APP_URL` from inside the template. Callers must
pass the app base URL (e.g. `getServerRuntimeConfig()?.public?.appUrl`); Phase 6 will
supply it from route context. Tests and the spec tables were updated to match.

## 10. Resend live-delivery check — deferred (external)

The "test email sent and received" completion criterion is still not verifiable because it
requires a real Resend account with a verified sender domain. `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` are empty, so `sendEmail` logs a warning and skips the send. To enable:
fill both values in `.env`, restart the dev server, then run the manual test in
`phase-0-setup/testing.md`.

## 11. Legacy spec file

`project overview/phases/phase-0-setup.md` is the original full-draft Phase 0 doc and is
superseded by the split docs in `project overview/phases/phase-0-setup/` (overview, flow,
expected-output, testing). It still describes the pre-separation state (HeroUI, `ts-node`
seed, three Docker services, three branches) and is intentionally left as the original
draft.