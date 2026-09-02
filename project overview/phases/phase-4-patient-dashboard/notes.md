# Phase 4 Notes — Patient Dashboard: Completion & Deviations

The Phase 4 spec (`project overview/phases/phase-4-patient-dashboard/*`) is implemented and
verified. This session delivered the full patient dashboard UI (`PatientLayout`, dashboard
pages, toast system), the `usePatientDashboard` composable, the patient API surface and its
tests, plus end-to-end verification. The notable fixes and deviations are documented below.

## 1. Patient layout: nested `<NuxtLayout>` never rendered (root cause + fix)

- **Symptom:** the patient dashboard pages rendered with **no sidebar, no mobile nav, and no
  toaster** — the shell was effectively missing even though `modules/patient/layouts/PatientLayout.vue`
  existed and pages declared `layout: 'PatientLayout'`.
- **Root cause:** two compounding issues.
  1. `PatientLayout.vue` wrapped its content in a nested `<NuxtLayout name="dashboard">`, but
     a page layout is only applied by the page's own `layout:` meta; the nested `<NuxtLayout>`
     never matched a layout named `dashboard` and rendered nothing.
  2. The page `layout: 'PatientLayout'` did not resolve to the module's registered layout:
     Nuxt's `addLayout(template, name)` kebab-cases the name, so `'PatientLayout'` was
     registered under the key **`'patient-layout'`**. `NuxtLayout` does an exact `l in layouts`
     lookup (no kebab normalization), so `layout: 'PatientLayout'` found nothing.
- **Fix:**
  - Rewrote `PatientLayout.vue` as a self-contained `flex h-screen` shell (desktop `<aside>`
    sidebar with `nav-*` testids, mobile header toggle + collapsible mobile nav, fixed bottom
    mobile nav with `mobile-nav-*` testids, `<Toaster />` before `<slot />`).
  - Changed every patient page to `layout: 'patient-layout'`.

## 2. Nuxt template engine gotcha: `addLayout`/`addTemplate` + `src`

- Using the `src` option of `addLayout` runs the file through lodash's template compiler, which
  treats Vue `{{ }}` interpolations as lodash expressions — a `.vue` SFC with Vue templates
  breaks with `"item is not defined"`. Fixed by switching to
  `addLayout({ getContents: () => readFileSync(path, 'utf8'), filename: 'PatientLayout.vue' }, 'PatientLayout')`
  (filename + `getContents`, **no** `src`).

## 3. Toast never appeared — `shallowReactive` vs `reactive`

- **Symptom:** the profile "Update" flow saved successfully (DB + UI pre-filled name updated)
  and `toast({ title: 'Profile updated', variant: 'success' })` ran, yet the Toaster stayed
  empty (`toastCount: 0`) and the `toast-success` assertion timed out.
- **Root cause:** `use-toast.ts` held its module state in `shallowReactive({ toasts: [] })`.
  `toast()` mutates the inner array via `state.toasts.push(item)`. `shallowReactive` only wraps
  the top level, so pushing into the nested `toasts` array is **not** tracked; the Toaster's
  `computed(() => state.toasts)` never recomputed, so no toast ever rendered. (This bug predated
  Phase 4 but had no assertion until the profile e2e test.)
- **Fix:** changed the store to `reactive(...)` in `composables/use-toast.ts` so nested array
  mutations are reactive. Only one shared module exists (concurrently a `useToast.ts` shared
  client chunk), so the Toaster and callers already shared state.

## 4. `/dashboard` redirect changed post-login expectations

- Patients now land on **`/dashboard/appointments`** (`/dashboard` redirects there), so several
  tests that waited on `**/dashboard` needed updating to `**/dashboard/**`:
  - `patient-dashboard.spec.ts`: `loginAs` waits for `**/dashboard/appointments` (all 10 spots).
  - `auth.spec.ts:110` (Logout Flow) — was `waitForURL('**/dashboard')`, a regression from the
    redirect change.
- Locator pitfalls encountered and resolved:
  - `'My Payments'` appears in the sidebar (`nav-payments`), the mobile nav
    (`mobile-nav-payments`), **and** the page heading → strict-mode ambiguous. Use
    `expect(page.getByTestId('page-title')).toHaveText('My Payments')`.
  - The amount `'EGP 250.00'` (from a non-strict `getByText`) matched hidden desktop `<td>`s on
    mobile. Scoped the mobile assertion to `page.getByTestId('payment-card').getByText(...).first()`.

## 5. `spaNavigateTo` wait-on-change (navbar/nav tests)

- The dashboard tests navigate protected pages client-side (`$router.push`) because the session
  is restored only on the client (SSR `isLoggedIn` is false). A `waitForURL('**' + path)`
  helper broke for paths that equal the current path (e.g. doctor→`/doctor`, `/dashboard`→
  `/dashboard/appointments`) because the URL didn't "change". The helper now waits for the
  **pathname to change** from the current value (while still accepting the target), which is
  robust to self-redirects.

## 6. Reset-password e2e — fixed stale-token collision

- The test used a hard-coded token `'reset-token-e2e'`. Earlier failed runs left users holding
  that token with **expired** expiries; `findFirst({ passwordResetToken })` could match a stale
  expired user and the API returned "Link has expired", failing the success assertion
  (reproducible). Fixed by generating a per-run token (`reset-token-${Date.now()}`) and passing
  it via the query string — the API code itself was correct.

## Verification summary

| Check | Command | Result |
|---|---|---|
| API tests | `npx vitest run tests/api` | **82/82 passed (20 files)** |
| End-to-end (full suite) | `npx playwright test --config playwright.prod.config.ts tests/e2e/` | **25/25 passed** (auth 11, booking 2, patient-dashboard 12) |
| TypeScript check | `npx tsc --noEmit` | clean |
| Production build | `npx nuxt build` | succeeds |

E2E was run against the production build (`node .output/server/index.mjs`, port 3456, env
loaded from `.env`) via `playwright.prod.config.ts` (spreads the base config, `webServer`
set to start the prod server with `reuseExistingServer: true`). Booking/payment state was
confirmed in the DB (booking `status=CONFIRMED`, payment `status=SUCCESS`).

## Production note: starting the prod server needs its env

The raw prod entry (`node .output/server/index.mjs`) does **not** auto-load `.env` (unlike
Nuxt dev). Source the needed keys (`DATABASE_URL JWT_SECRET JWT_EXPIRES_IN PAYMENT_GATEWAY APP_URL`)
and set `HOST=127.0.0.1 PORT=3456` before starting, or the server fails to reach the DB and any
protected/API call 500s. See phase-3 notes §5 for the original finding.