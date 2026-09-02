# Phase 3 Notes — Booking & Payment Module: Completion & Deviations

The Phase 3 spec (`project overview/phases/phase-3-booking/*`) is implemented and verified.
This session's deliverable also covered the missing end-to-end verification plus the
supporting infrastructure. The deviations and notable findings are documented below.

## 1. Dynamic booking route `[id]` — parameter not extracted (root cause + fix)

- **Symptom:** `GET /api/booking/:id` returned **400 "Booking ID is required"** at runtime
  in both dev and production, even though the route was registered correctly as
  `/api/booking/:id` (verified in `.nuxt/types/nitro-routes.d.ts`). `getRouterParam(event, 'id')`
  returned `null`, breaking the success page's booking-details fetch and the e2e flow.
- **Root cause (confirmed via temporary debug log in prod):** the handler was receiving
  `params: { "id.cancel": "...id..." }` — the param key was `id.cancel`, NOT `id`.
  Because the cancel route lived in the **same directory** as the GET route as
  `[id].cancel.patch.ts`, Nitro parsed the file name `[id].cancel` as a single dynamic
  segment and fused the `.cancel` suffix into the param name. This "poisoned" the sibling
  `[id].get.ts` route, making `getRouterParam(event, 'id')` return `null`.
- **Fix:** moved the cancel route into a subdirectory:
  `modules/booking/server/api/booking/[id].cancel.patch.ts`
  → `modules/booking/server/api/booking/[id]/cancel.patch.ts`.
  This both removes the `.cancel`-fusion bug AND matches the API shape already specified in
  `testing.md` (`PATCH /api/booking/:id/cancel`). After the move, `GET /api/booking/:id`
  returns `{ ... }` (404 only for unknown ids) and the cancel route registers as
  `/api/booking/:id/cancel`. The cancel test import path was updated accordingly.

## 2. Payment gateway uses a mocked, dev-only flow by default

- Real Paymob (intention API, redirect) and Stripe (Checkout Sessions) integrations are
  implemented, but the stored keys are placeholders (markers `your_`, `sk_test_xxxxxxxx`,
  `pk_test_xxxxxxxx`, `whsec_xxxxxxxx`, `x_`).
- `createPaymentSession` (in `server/utils/payment.ts`) detects a placeholder key and returns
  a **mock** `paymentUrl` of `/api/payment/dev/complete?bookingId=...` (a **relative** URL so it
  resolves to the current origin). The front end redirects there, which marks the payment
  SUCCESS and the booking CONFIRMED.
- Webhooks (`/api/payment/webhook`) use raw JSON-body HMAC signing (Paymob `sha512`,
  Stripe `sha256`) and always return 200 to the gateway first, then process internally.
- **Not tested for real:** actual Paymob/Stripe credentials and outbound network calls. Swap
  in real keys and unset the placeholders to exercise the live flow. `PAYMENT_GATEWAY` unset →
  500 "Payment gateway not configured" (per the spec test).

## 3. E2E must navigate protected pages via SPA router push, not full page load

- `plugins/auth.ts` restores the session **only on the client** (`import.meta.client` →
  `fetchMe()`). During SSR `useAuth().isLoggedIn` is false, so a full `page.goto()` of the
  `auth`-guarded `/book` triggers a 302 → `/login` bounce (then guest middleware sends the
  user to `/dashboard`).
- Existing e2e only navigate protected pages from an already-authenticated SPA session. The
  booking e2e therefore pushes `/book` client-side after login:
  ```ts
  await page.evaluate(() =>
    document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push('/book'))
  ```
- The redirect assertion (`/book` → `/login` when logged out) uses a full `page.goto` and is
  covered separately.

## 4. FullCalendar Vue v6 integration details

- The FullCalendar Vue v6 component takes only `props.options` and does **not** re-emit
  `dateClick` / `datesSet` as Vue component events; handlers must live inside the `options`
  object.
- `datesSet` `info.start` is the visible grid start (includes trailing previous-month cells),
  so the month is derived from `info.view.currentStart`.
- Month navigation is wired through a reactive `computed` `calendarOptions` whose
  `initialDate` comes from `currentMonth/currentYear` state; `onMonthChange` calls
  `loadDates(..., true)` to remount the calendar. `loadDates` only remounts on an explicit
  month change to avoid fetch/remount loops.
- `dayCellClassNames` expects `string[]` (not `{ class: [...] }`).
- Added `data-testid="booking-slot-{startTime}"` and `data-testid="confirm-pay"` for stable e2e
  selectors.

## 5. Production note (not a bug): `node .output/server` needs its env

- Running the production build directly (`node .output/server/index.mjs`) requires the
  `DATABASE_URL`/secrets environment loaded; Nuxt's dev server auto-loads `.env`, but the raw
  prod entry does not. Sourcing only the needed keys from `.env` before starting prod makes
  login/API work (an earlier "prod login 500" was simply the missing `DATABASE_URL`).

## 6. TypeScript errors fixed to reach a clean `tsc --noEmit`

- `useBooking.ts` referenced `getApiMessage` (extracting the API `{ message }` from an ofetch
  error) but never defined it — at runtime any failed booking call would throw a
  `ReferenceError`. Added a local `getApiMessage` helper.
- `webhook.post.ts` typed its helper handlers as
  `Parameters<typeof defineEventHandler>[0]` (a handler-function type) instead of `H3Event`,
  causing casts/assignability errors. Retyped them as `H3Event` (imported from `h3`).
- `npx tsc --noEmit` is clean and `npx nuxt build` succeeds.

## Verification summary

| Check | Command | Result |
|---|---|---|
| Server-utils unit tests | `npx vitest run tests/utils` | 62/62 passed (4 files) |
| API tests | `npm run test:api` | 56/56 passed (14 files) |
| End-to-end booking (Playwright) | `npx playwright test tests/e2e/booking.spec.ts` | 2/2 passed |
| Production build | `npx nuxt build` | succeeds |
| TypeScript check | `npx tsc --noEmit` | clean |

E2E main flow assertions confirmed against the DB: booking `status=CONFIRMED` and payment
`status=SUCCESS` after the mocked payment completes, and the success page renders the booking
summary fetched via `GET /api/booking/:id`.
