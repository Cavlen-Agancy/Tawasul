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