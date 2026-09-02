# Phase 1 Notes — Authentication Module: Completion & Deviations

The Phase 1 spec (`project overview/phases/phase-1-auth/*`) is fully implemented and
verified. The 7 API routes, `useAuth` composable, 5 middleware files, auth plugin, and
5 auth pages were already written in a prior session and match the spec. This session's
remaining work was the **end-to-end testing gap** plus the supporting verification and
infrastructure. The deviations noted below.

## 1. Added a Playwright e2e suite (was the missing deliverable)

- The Phase 1 spec requires Playwright e2e coverage (registration, verification, login,
  logout, guest/auth middleware redirects, forgot/reset password). Playwright was not
  installed and there were no tests or config.
- **Installed** `@playwright/test` 1.62.1 + bundled Chromium (v151).
- **`package.json`**: added `test:e2e` (`playwright test`) and `test:e2e:ui`
  (`playwright test --ui`) scripts.
- **`.gitignore`**: added `test-results/`, `playwright-report/`, `.blob-report/`.
- Created `playwright.config.ts`, `tests/e2e/global-setup.ts`, and
  `tests/e2e/auth.spec.ts` (11 flows).
- **Vitest exclusion:** `vitest.config.ts` previously matched `tests/**/*.{test,spec}.ts`,
  which caused `npm test` to try to execute the Playwright spec. Added
  `exclude: ['tests/e2e/**', ...]`.

## 2. Nuxt hydration detection — `data-v-app` is NOT set on `#__nuxt`

- **Problem:** The initial `gotoReady()` helper waited for `#__nuxt[data-v-app]`, but
  that attribute never appears in this Nuxt version. The root `#__nuxt` element keeps
  only its `id` attribute after mount (`window.__NUXT__` and mounted content are present,
  but no `data-v-app`). Every test timed out waiting for the marker.
- **Fix:** Detect hydration via the `__vue_app__` property that Vue's `createApp().mount()`
  sets on the mount container:
  ```ts
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt')
    return root && '__vue_app__' in root
  })
  ```

## 3. Native form GET-submit race on first hit

- **Problem:** If a form is filled/submitted before Vue's `@submit.prevent` is attached,
  the browser performs a native GET submit (URL gets `?name=...&password=...` query
  params) and registration never calls the API. This surfaced only on the very first
  cold hit of `/register` (later tests were already warmed).
- **Fix:** Guard the registration flow by awaiting the actual API response instead of just
  clicking:
  ```ts
  const apiDone = page.waitForResponse((r) => r.url().includes('/api/auth/register'))
  await page.getByTestId('register-submit').click()
  await apiDone
  ```
  This deterministically proves the SPA submitted via `$fetch` rather than a native GET.

## 4. Assertion text aligned to the real UI

- `verify-email.vue` renders the success link as **"Go to login"** (not "Log in"), so the
  e2e assertion was changed to `getByRole('link', { name: 'Go to login' })`.
- All other assertions already matched the actual page copy.

## 5. Placeholder dashboards added (deferred dashboards)

- The `useAuth.dashboardFor()` composable routes each role to `/dashboard` (patient),
  `/doctor` (doctor), and `/admin` (staff/admin). The real dashboards are delivered in
  Phases 4–6 (per the spec), but e2e redirect assertions need concrete targets.
- Added bare skeleton pages `pages/dashboard.vue`, `pages/doctor.vue`,
  `pages/admin.vue` (heading + `layout: 'dashboard'` + the role middleware) so login and
  middleware-redirect flows have landing pages. To be replaced by real dashboards later.

## 6. bcrypt must be imported statically in e2e setup

- **Problem:** `import('bcryptjs')` (dynamic) returned a module without `hash`
  (`TypeError: bcrypt.hash is not a function`), breaking verify-email and reset-password
  flows that pre-create test users.
- **Fix:** Use a top-level `import bcrypt from 'bcryptjs'` in `tests/e2e/auth.spec.ts`
  (and the same pattern in `tests/e2e/global-setup.ts`).

## 7. Playwright dev server — bind host explicitly

- **Problem:** The `webServer` port used `localhost:3456` which, with Nuxt's default
  binding, served only on `[::1]` (IPv6) in some runs — an inconsistency with the CLI.
- **Fix:** Config binds to `127.0.0.1` explicitly for both the dev command
  (`npx nuxt dev --host 127.0.0.1 --port 3456`) and the health-check URL
  (`http://127.0.0.1:3456`).

## 8. e2e fixtures

- `tests/e2e/global-setup.ts` upserts three role fixtures (password `TestPass123!`):
  `e2e.patient@test.com` (PATIENT), `e2e.doctor@test.com` (DOCTOR),
  `e2e.staff@test.com` (STAFF) so login flows do not depend on the seed data.

## Verification summary

| Check | Command | Result |
|---|---|---|
| Unit + API tests | `npm test` | 80/80 passed |
| API tests (dedicated) | `npm run test:api` | 26/26 passed |
| End-to-end (Playwright) | `npx playwright test` | 11/11 passed |
| TypeScript check | `npx tsc --noEmit` | clean |
| Production build | `npm run build` | succeeds |
