# Gap Report – Tawasul Academy

## Phase 0 – Setup

### API Endpoints
- No endpoints required – no check performed.

### Pages
- `/` – ⚠️ Partially implemented (file: `pages/index.vue`, layout: `default`, middleware: none; renders H1 `Tawasul Academy — Setup Complete`, `Button` `Primary Color Test`, `Card`; matches temporary test page content, retained after Phase 2 scope where it should have been replaced by marketing home).

### Components
- `Button` – ✅ Implemented correctly (file: `components/ui/button/button.vue`).
- `Card` (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) – ✅ Implemented correctly (files: `components/ui/card/*.vue`).
- `Input` – ✅ Implemented correctly (file: `components/ui/input/input.vue`).
- `Dialog` – ✅ Implemented correctly (files: `components/ui/dialog/*.vue`).
- `Table` – ✅ Implemented correctly (files: `components/ui/table/*.vue`).
- `Tabs` – ✅ Implemented correctly (files: `components/ui/tabs/*.vue`).
- `Avatar` – ✅ Implemented correctly (files: `components/ui/avatar/*.vue`).
- `Badge` – ✅ Implemented correctly (file: `components/ui/badge/badge.vue`).
- `Skeleton` – ✅ Implemented correctly (file: `components/ui/skeleton/skeleton.vue`).
- `Toast`/`Toaster` – ✅ Implemented correctly (files: `components/ui/toast/toast.vue`, `components/ui/toast/toaster.vue`).

### Composables
- No composables required – no check performed.

### Server Utilities
- `server/utils/prisma.ts` – ✅ Implemented correctly (exports `prisma` via `globalThis.__prisma` singleton; sets `globalThis.__prisma` when `NODE_ENV !== 'production'`).
- `server/utils/auth.ts` – ✅ Implemented correctly (exports `hashPassword` via `bcrypt.hash(pw,12)`, `comparePassword` via `bcrypt.compare`, `generateJWT` via `jwt.sign` with `jwtSecret`/`jwtExpiresIn`, `verifyJWT` via `jwt.verify`, `generateToken` via `crypto.randomBytes(32).toString('hex')`, `requireAuth(event, accountTypes?)` with 401 `Unauthorized` and 403 `Forbidden`).
- `server/utils/email.ts` – ✅ Implemented correctly (exports `sendEmail`, `emailVerificationTemplate`, `passwordResetTemplate`, `bookingConfirmationTemplate`, `bookingReceivedTemplate`, `bookingCancellationTemplate`, `doctorWelcomeTemplate`, `sessionReminderTemplate`).
- `server/utils/permissions.ts` – ✅ Implemented correctly (exports `requirePermission(event, resource, action)`; calls `requireAuth(event,['STAFF'])` then `prisma.permission.findMany({where:{userId, resource, action}})` every request; throws 403 `You do not have permission to perform this action` if empty).
- `server/utils/runtime.ts` – ✅ Implemented correctly (exports `getServerRuntimeConfig()` via `useRuntimeConfig()`).
- `server/utils/validation.ts` – ✅ Implemented correctly (exports `authRegisterSchema`, `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `availableDatesQuerySchema`, `availableSlotsQuerySchema`, `createBookingSchema`, `initiatePaymentSchema`, `patientProfileSchema`, `patientAppointmentsQuerySchema`, `scheduleSchema`, `scheduleUpdateSchema`, `blockedDateSchema`, `assignDoctorSchema`, `validationMessage`, `parseBody`).
- `prisma/seed.ts` – ✅ Implemented correctly (file: `prisma/seed.ts`; `prisma.settings.upsert where:{id:'singleton'}` with `platformName`, `paymentGateway:'paymob'`, `sessionPricePerHour:0`, `defaultSessionDuration:60`, `defaultWorkingStart:'09:00'`, `defaultWorkingEnd:'17:00'`, `jitsiDomain:'meet.jit.si'`; `prisma.user.upsert where:{email:SEED_ADMIN_EMAIL}` with `accountType:'STAFF'`, `emailVerified:true`, `isActive:true`, `bcrypt.hash(...,12)`; throws `Missing seed environment variables` if missing; grants 14 permissions via `prisma.permission.upsert`; seeds `AdminSchedule` Mon–Fri `09:00-17:00`, `60`, `isActive:true`).
- `package.json` – ⚠️ Partially implemented (file: `package.json`; missing dependency `shadcn-vue` although `components/ui/*` vendored and `nuxt.config.ts:85` references shadcn-vue; present: `nuxt ^3`, `prisma ^5`, `@prisma/client ^5`, `bcryptjs`, `jsonwebtoken`, `resend ^3`, `zod ^3`, `typescript ^5`, `vitest ^2`, `@vueuse/nuxt`, `@nuxt/image`, `@fullcalendar/* ^6`, `stripe`, `@stripe/stripe-js`, `tsx`; seed script `tsx prisma/seed.ts` present).
- `nuxt.config.ts` – ⚠️ Partially implemented (file: `nuxt.config.ts`; `ssr:true`, `typescript.strict:true`, `runtimeConfig` with `jwtSecret/jwtExpiresIn/resendApiKey/resendFromEmail/resendFromName/databaseUrl/uploadPath/uploadMaxSize/paymentGateway/paymob*/stripe*/jitsiAppId/jitsiAppSecret/seedAdmin*` and `public.appUrl/jitsiDomain/stripePublishableKey` present; `modules` contains `@nuxtjs/tailwindcss`, `@vueuse/nuxt`, `@nuxt/image`; missing `shadcn-vue` plugin wiring `plugins:[shadcnVue()]`; `css` is `~/assets/css/main.css` only).
- `tailwind.config.ts` – ⚠️ Partially implemented (file: `tailwind.config.ts`; `darkMode:'class'`, `content` covers `components/layouts/pages/plugins/modules/app.vue`; `theme.extend.colors` uses CSS-variable tokens plus `success #22C55E`/`warning #F59E0B`; does not contain `plugins:[shadcnVue()]` with `require('shadcn-vue')` nor `./node_modules/shadcn-vue/dist` content entry).
- `docker-compose.yml` – ✅ Implemented correctly (file: `docker-compose.yml`; services `postgres:16-alpine` with `5433:5432`, `pgadmin` with `5050:80`, volumes `postgres_data/uploads_data`, network `tawasul_network`).
- `Dockerfile.dev` – ✅ Implemented correctly (file: `Dockerfile.dev`; `node:20-alpine`, `openssl`, `npm install`, `EXPOSE 3000`, `CMD npm run dev`).
- `.dockerignore` – ✅ Implemented correctly (file: `.dockerignore`; contains `node_modules,.nuxt,.output,.env,uploads,*.log,.git` variants).
- `.gitignore` – ✅ Implemented correctly (file: `.gitignore`; ignores `.env`, `node_modules/`, `.nuxt/`, `.output/`, `uploads/`).
- `layouts/default.vue` – ⚠️ Partially implemented (file: `layouts/default.vue`; header with logo `/logo.png`→`/`, center links `Home,About,Services,Our Experts,Contact` (`/,/about,/services,/experts,/contact`), right Login→`/login` + Book Now→`/book`, mobile hamburger menu, `<slot/>`, footer `© 2024 Tawasul Academy`; contact email/phone are hardcoded `contact@tawasul.com · +20 100 000 0000`, not dynamic from Settings).
- `layouts/dashboard.vue` – ✅ Implemented correctly (file: `layouts/dashboard.vue`; `aside` `slot:sidebar`, `main` default slot, mobile header/nav, `slot:mobile-nav`).
- `public/logo.png` – ✅ Implemented correctly (file: `public/logo.png`).
- `public/favicon.png` – ✅ Implemented correctly (file: `public/favicon.png`).
- `assets/css/tailwind.css` – ✅ Implemented correctly (file: `assets/css/tailwind.css`).
- `assets/css/main.css` – ✅ Implemented correctly (file: `assets/css/main.css`).

### Database Models
- `User` – ✅ Implemented correctly (file: `prisma/schema.prisma`; fields `emailVerificationToken String?`, `emailVerificationExpiry DateTime?`, `passwordResetToken String?`, `passwordResetExpiry DateTime?`, `accountType`, `emailVerified`, `isActive` present).
- `Booking.doctorId` – ✅ Implemented correctly (file: `prisma/schema.prisma`; `doctorId String?` nullable, relation `onDelete:SetNull`).
- `Booking.status` enum – ✅ Implemented correctly (file: `prisma/schema.prisma`; `BookingStatus` includes `PENDING`, `CONFIRMED`, `CANCELLED`, plus reserved `IN_REVIEW`).
- `AdminSchedule` – ✅ Implemented correctly (file: `prisma/schema.prisma`; fields `dayOfWeek`, `startTime`, `endTime`, `sessionDuration`, `isActive`).
- `GlobalBlockedDate` – ✅ Implemented correctly (file: `prisma/schema.prisma`; fields `date @db.Date`, `reason?`).
- `Availability` – ✅ Implemented correctly (file: `prisma/schema.prisma`).
- `BlockedSlot` – ✅ Implemented correctly (file: `prisma/schema.prisma`).
- `SessionRoom` – ✅ Implemented correctly (file: `prisma/schema.prisma`; fields `bookingId @unique`, `roomName @unique`, `expiresAt`).
- `Permission` – ✅ Implemented correctly (file: `prisma/schema.prisma`; fields `resource`, `action`, `userId`, `@@unique([userId, resource, action])`).
- `Settings` – ✅ Implemented correctly (file: `prisma/schema.prisma`; `id @default("singleton")`, `platformName`, `contactEmail`, `contactPhone`, `whatsappNumber`, `paymentGateway`, `paymentGatewayKey/Secret`, `sessionPricePerHour`, `defaultSessionDuration`, `defaultWorkingStart/End`, `jitsiDomain`).
- `Payment` – ✅ Implemented correctly (file: `prisma/schema.prisma`; fields `status`, `amount Decimal(10,2)`, `currency`, `gatewayReference?`).

### Middleware
- `server/middleware/auth.ts` – ✅ Implemented correctly (file: `server/middleware/auth.ts`; no cookie → `event.context.user=null` and continue; valid `auth_token` → `event.context.user=verifyJWT(token)`; invalid → `deleteCookie(event,'auth_token')` + `user=null` and continue).

### Emails
- No emails required – no check performed.

### Environment Variables
- `DATABASE_URL` – ✅ Implemented correctly (file: `.env.example:26`).
- `JWT_SECRET` – ✅ Implemented correctly (file: `.env.example:35`).
- `JWT_EXPIRES_IN` – ✅ Implemented correctly (file: `.env.example:38`).
- `RESEND_API_KEY` – ✅ Implemented correctly (file: `.env.example:46`).
- `RESEND_FROM_EMAIL` – ✅ Implemented correctly (file: `.env.example:50`).
- `RESEND_FROM_NAME` – ✅ Implemented correctly (file: `.env.example:53`).
- `JITSI_DOMAIN` – ✅ Implemented correctly (file: `.env.example:92`).
- `APP_URL` – ✅ Implemented correctly (file: `.env.example:14`).
- `UPLOAD_PATH` – ✅ Implemented correctly (file: `.env.example:109`).
- `NODE_ENV` – ✅ Implemented correctly (file: `.env.example:17`).
- `SEED_ADMIN_EMAIL` – ✅ Implemented correctly (file: `.env.example:127`).
- `SEED_ADMIN_PASSWORD` – ✅ Implemented correctly (file: `.env.example:128`).
- `SEED_ADMIN_NAME` – ✅ Implemented correctly (file: `.env.example:129`).
- `PAYMENT_GATEWAY` – ✅ Implemented correctly (file: `.env.example:60`).
- `PAYMOB_API_KEY` / `PAYMOB_INTEGRATION_ID` / `PAYMOB_HMAC_SECRET` – ✅ Implemented correctly (files: `.env.example:65,68,71`; concrete equivalents of gateway key/secret/webhook secret for Paymob).
- `STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` – ✅ Implemented correctly (files: `.env.example:76,79,83`; concrete equivalents for Stripe).
- `PAYMENT_GATEWAY_KEY` (generic name) – ❌ Missing (expected in `.env.example`; no line with that literal name).
- `PAYMENT_GATEWAY_SECRET` (generic name) – ❌ Missing (expected in `.env.example`; no line with that literal name).
- `PAYMENT_WEBHOOK_SECRET` (generic name) – ❌ Missing (expected in `.env.example`; no line with that literal name).
- `UPLOAD_MAX_SIZE` – ✅ Implemented correctly (file: `.env.example:113`).

## Phase 1 – Auth

### API Endpoints
- `POST /api/auth/register` – ✅ Implemented correctly (file: `modules/auth/server/api/auth/register.post.ts`; Zod `name min2/max100`, `email`, `phone? max30`, `password min8/max128`; 400 `Email already in use` on duplicate; `hashPassword`; `generateToken()` +24h expiry; creates `User accountType:PATIENT, emailVerified:false`; `sendEmail(emailVerificationTemplate)` with `${APP_URL}/verify-email?token=`; 201 `{message:"Registration successful. Please check your email."}`).
- `GET /api/auth/verify-email` – ⚠️ Partially implemented (file: `modules/auth/server/api/auth/verify-email.get.ts`; validates `?token`, finds by `emailVerificationToken`, checks expiry, sets `emailVerified:true` + clears token; gap: returns 400 `Invalid or expired link` for unknown/missing token and never returns 404).
- `POST /api/auth/login` – ⚠️ Partially implemented (file: `modules/auth/server/api/auth/login.post.ts`; Zod `email`+`password min1`; 401 `Invalid credentials`, 403 `Please verify your email before logging in`, 403 `Your account has been deactivated`, JWT `auth_token` cookie `httpOnly/sameSite strict/maxAge 7d/path /`; gap: response includes extra `phone` field `{id,name,email,phone?,photo?,accountType}` beyond documented `{id,name,email,accountType,photo?}`, and unverified/deactivated checks run before `comparePassword`).
- `POST /api/auth/logout` – ✅ Implemented correctly (file: `modules/auth/server/api/auth/logout.post.ts`; `deleteCookie auth_token path /`; 200 `{message:"Logged out successfully"}`).
- `GET /api/auth/me` – ✅ Implemented correctly (file: `modules/auth/server/api/auth/me.get.ts`; `requireAuth(event)` first line; returns `{id,name,email,phone?,photo?,accountType,permissions?}` with `permissions` only for STAFF; 401 if not found).
- `POST /api/auth/forgot-password` – ✅ Implemented correctly (file: `modules/auth/server/api/auth/forgot-password.post.ts`; Zod `email`; always 200 `{message:"If this email exists, a reset link has been sent."}`; if user exists sets `generateToken()` +1h expiry and `sendEmail(passwordResetTemplate)` with `${APP_URL}/reset-password?token=`).
- `POST /api/auth/reset-password` – ✅ Implemented correctly (file: `modules/auth/server/api/auth/reset-password.post.ts`; Zod `token`, `newPassword min8`; 400 `Invalid or expired link` / `Link has expired`; hashes and clears token; 200 `{message:"Password updated successfully."}`).

### Pages
- `/register` – ✅ Implemented correctly (file: `modules/auth/pages/register.vue`; layout `default`; middleware `guest`; fields name/email/phone/password/confirm; `POST /api/auth/register`; success card `Check your email` + link `/login`; error below form).
- `/login` – ✅ Implemented correctly (file: `modules/auth/pages/login.vue`; layout `default`; middleware `guest`; email/password; redirect by accountType on success; links `/forgot-password`, `/register`).
- `/verify-email` – ✅ Implemented correctly (file: `modules/auth/pages/verify-email.vue`; layout `default`; middleware none; reads `?token` on mount, `GET /api/auth/verify-email`; loading/success + link `/login` / error + link `/login`).
- `/forgot-password` – ✅ Implemented correctly (file: `modules/auth/pages/forgot-password.vue`; layout `default`; middleware `guest`; email field; `POST /api/auth/forgot-password`; always success message).
- `/reset-password` – ✅ Implemented correctly (file: `modules/auth/pages/reset-password.vue`; layout `default`; middleware none; reads `?token`; new+confirm with match/min8; `POST /api/auth/reset-password {token,newPassword}`; success redirect `/login` after delay).

### Components
- `Input`, `Button`, `Card` on auth pages – ⚠️ Partially implemented (files: `modules/auth/pages/*.vue` use `Input`, `Button`, `Card*`, `NuxtLink`; gap: documented `CardBody` and `Link` component names do not exist in codebase; `NuxtLink` and `CardContent` used instead).

### Composables
- `useAuth` – ✅ Implemented correctly (file: `modules/auth/composables/useAuth.ts`; state `user` via `useState('auth-user')`; computed `isLoggedIn`, `isPatient`, `isDoctor`, `isStaff`; methods `fetchMe` (`GET /api/auth/me`), `login` (`POST /api/auth/login` + redirect by type), `logout` (`POST /api/auth/logout` + clear + `/login`), `hasPermission(resource, action)` checking `user.permissions` array, false for non-STAFF).

### Server Utilities
- `server/utils/prisma.ts`, `server/utils/auth.ts`, `server/utils/email.ts` (`sendEmail`, `emailVerificationTemplate`, `passwordResetTemplate`), `server/middleware/auth.ts` – ✅ Implemented correctly (reused from Phase 0; see Phase 0 entries).

### Database Models
- No migration required – `User.emailVerificationToken?`, `User.emailVerificationExpiry?`, `User.passwordResetToken?`, `User.passwordResetExpiry?` – ✅ Implemented correctly (file: `prisma/schema.prisma`).

### Middleware
- `middleware/auth.ts` – ✅ Implemented correctly (file: `middleware/auth.ts`; redirects to `/login` if `!isLoggedIn`).
- `middleware/guest.ts` – ✅ Implemented correctly (file: `middleware/guest.ts`; if logged in redirects PATIENT→`/dashboard`, DOCTOR→`/doctor`, STAFF→`/admin`).
- `middleware/patient-only.ts` – ✅ Implemented correctly (file: `middleware/patient-only.ts`; unauthenticated→`/login`; non-PATIENT→ own dashboard).
- `middleware/doctor-only.ts` – ✅ Implemented correctly (file: `middleware/doctor-only.ts`; unauthenticated→`/login`; non-DOCTOR→ own dashboard).
- `middleware/staff-only.ts` – ✅ Implemented correctly (file: `middleware/staff-only.ts`; unauthenticated→`/login`; non-STAFF→ own dashboard).
- `plugins/auth.ts` – ⚠️ Partially implemented (file: `plugins/auth.ts`; calls `fetchMe()` on load and clears on 401; gap: runs on both server (via `useRequestFetch`) and client, not client-only).

### Emails
- Registration → `emailVerificationTemplate` – ✅ Implemented correctly (file: `modules/auth/server/api/auth/register.post.ts:42`; to new user email after `prisma.user.create`).
- Forgot password → `passwordResetTemplate` – ✅ Implemented correctly (file: `modules/auth/server/api/auth/forgot-password.post.ts:37`; to `user.email` after `passwordResetToken` update, only if user exists).

### Environment Variables
- `APP_URL` – ✅ Implemented correctly (file: `.env.example:14`; used in `register.post.ts` and `forgot-password.post.ts` for email URLs).
- `JWT_SECRET`, `JWT_EXPIRES_IN` – ✅ Implemented correctly (files: `.env.example:35,38`; used in `server/utils/auth.ts`).
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` – ✅ Implemented correctly (files: `.env.example:46,50,53`; used in `server/utils/email.ts`).

## Phase 2 – Marketing

### API Endpoints
- `GET /api/public/doctors` – ❌ Missing (expected file: `modules/marketing/server/api/public/doctors.get.ts` or `server/api/public/doctors.get.ts`; no file found; `Grep public/doctors` matches only docs).
- `GET /api/public/doctors/:slug` – ❌ Missing (expected file: `modules/marketing/server/api/public/doctors/[slug].get.ts` or `server/api/public/doctors/[slug].get.ts`; no file found).
- `POST /api/public/contact` – ❌ Missing (expected file: `modules/marketing/server/api/public/contact.post.ts` or `server/api/public/contact.post.ts`; no file found).

### Pages
- `/` (marketing home) – ⚠️ Partially implemented (file: `pages/index.vue`; layout `default`; middleware none; gap: renders setup placeholder `Tawasul Academy — Setup Complete` + `Primary Color Test` + card instead of documented Hero `Your Path to Mental Wellness Starts Here`, Services 5-card grid, Experts `GET doctors?limit=4` grid, Testimonials, CTA `Ready to Start Your Journey?`).
- `/about` – ❌ Missing (expected file: `pages/about.vue`; nav link in `layouts/default.vue:9` points to dead route).
- `/services` – ❌ Missing (expected file: `pages/services.vue`; nav link in `layouts/default.vue:9` points to dead route).
- `/experts` – ❌ Missing (expected file: `pages/experts.vue`; nav link in `layouts/default.vue:9` points to dead route).
- `/experts/[slug]` – ❌ Missing (expected file: `pages/experts/[slug].vue`; no `pages/experts/` directory).
- `/contact` – ❌ Missing (expected file: `pages/contact.vue`; nav link in `layouts/default.vue:9` points to dead route).

### Components
- No marketing components required as separate files – no check performed.

### Composables
- No composables required – no check performed.

### Server Utilities
- Reuse `server/utils/prisma.ts`, `server/utils/email.ts` (`sendEmail`) – ✅ Implemented correctly (files exist; no new utilities required; no marketing-specific utility file found or required).

### Database Models
- No model change required (`Doctor`, `User`, `Settings` reads) – ✅ Implemented correctly (file: `prisma/schema.prisma`; models exist).

### Middleware
- No new middleware required (reuse `guest`) – ✅ Implemented correctly (file: `middleware/guest.ts` exists).

### Emails
- Contact submit → admin `contactEmail` custom HTML – ❌ Missing (no `sendEmail` call with contact subject found in `server/` or `modules/`; `Grep sendEmail + contact` returns zero matches).

### Environment Variables
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` – ✅ Implemented correctly (files: `.env.example:46,50,53`; present though contact endpoint absent).
- `APP_URL` – ✅ Implemented correctly (file: `.env.example:14`).

## Phase 3 – Booking

### API Endpoints
- `GET /api/booking/available-dates` – ✅ Implemented correctly (file: `modules/booking/server/api/booking/available-dates.get.ts`; validates `month 1-12`, `year 1000-9999` else 400 `Invalid month or year`; calls `getAdminAvailableDates`; returns `{dates}`).
- `GET /api/booking/available-slots` – ✅ Implemented correctly (file: `modules/booking/server/api/booking/available-slots.get.ts`; validates `date YYYY-MM-DD` else 400 `Invalid date format`; calls `getAdminAvailableSlots`; returns `{slots}` without `doctorId`).
- `POST /api/booking/create` – ✅ Implemented correctly (file: `modules/booking/server/api/booking/create.post.ts`; `requireAuth PATIENT`; Zod `{date YYYY-MM-DD, startTime HH:MM}` with no `doctorId`; re-checks `getAdminAvailableSlots(date)` else 400 `This slot is no longer available`; computes `endTime`/`amount` from `AdminSchedule`+`Settings.sessionPricePerHour` (`EGP`); creates `Booking{userId, doctorId:null, status:PENDING}` + `Payment{PENDING}`; 201 `{bookingId,amount,currency}`).
- `POST /api/payment/initiate` – ✅ Implemented correctly (file: `modules/payment/server/api/payment/initiate.post.ts`; `requireAuth PATIENT`; `{bookingId}`; 400 `Booking not found`, 403 non-owner, 400 `Booking already confirmed`, 400 missing payment, 500 gateway error; returns `{paymentUrl}` or `{clientSecret}` from `createPaymentSession`).
- `POST /api/payment/webhook` – ⚠️ Partially implemented (file: `modules/payment/server/api/payment/webhook.post.ts`; no auth; verifies Paymob `hmac` SHA512 / Stripe `stripe-signature` SHA256 else 400 `Invalid signature`; SUCCESS → `Payment SUCCESS`, `Booking` stays `PENDING`, `sendEmail(bookingReceivedTemplate)`; FAILED → `Payment FAILED`; returns 200 `{message:"Webhook received"}`; gap: HMAC computed over `JSON.stringify(body)` instead of raw request body, and signature check skipped entirely when secrets unconfigured).
- `GET /api/booking/:id` – ⚠️ Partially implemented (file: `modules/booking/server/api/booking/[id].get.ts`; `requireAuth` any role, STAFF requires `APPOINTMENTS READ`; 404 `Booking not found`; 403 non-owner; returns documented fields plus extra `doctorName`; gap: extra `doctorName` field beyond documented shape).
- `PATCH /api/booking/:id/cancel` – ✅ Implemented correctly (file: `modules/booking/server/api/booking/[id]/cancel.patch.ts`; `requireAuth`; STAFF requires `APPOINTMENTS DELETE`; 404, 403, 400 `Booking is already cancelled`, 400 `Cannot cancel booking less than 24 hours before session` for PATIENT only; `$transaction` sets `Booking CANCELLED` + `Payment REFUNDED`; `sendEmail(bookingCancellationTemplate)`; 200 `{message:"Booking cancelled successfully"}`).

### Pages
- `/book` – ⚠️ Partially implemented (file: `modules/booking/pages/book.vue`; route `/book`; middleware `auth`; stepper 1 Choose Time / 2 Review / 3 Pay; FullCalendar + `GET available-dates`/`available-slots`; slot chips `booking-slot-{startTime}`; Review card Date/Time/Duration/Price with no doctor; `confirm-pay` → `POST create` + `POST initiate` → `paymentUrl`; gap: layout is `patient-layout` instead of documented `default`).
- `/booking/success` – ⚠️ Partially implemented (file: `modules/booking/pages/booking/success.vue`; route `/booking/success`; middleware none; heading `Booking Request Received`, summary date/time/duration/price, `Go to My Appointments`→`/dashboard`; gap: layout is `patient-layout` instead of documented `default`).
- `/booking/failed` – ⚠️ Partially implemented (file: `modules/booking/pages/booking/failed.vue`; route `/booking/failed`; middleware none; heading `Payment was not completed`, summary, `Try Again` + `Choose a Different Time`→`/book`; gap: layout is `patient-layout` instead of documented `default`).

### Components
- No booking components required as separate files – no check performed.

### Composables
- `useBooking` – ✅ Implemented correctly (file: `modules/booking/composables/useBooking.ts`; state `step`, `selectedDate`, `selectedSlot`, `availableDates`, `availableSlots`, `bookingId`, `isLoading` (`booking-loading`), `error` (`booking-error`) via `useState`; methods `fetchAvailableDates`, `fetchAvailableSlots`, `selectSlot`, `createAndPay` (`POST /api/booking/create` then `POST /api/payment/initiate`), plus extras `reset`, `backToStep1`, `retryPayment`, `fetchBookingDetail`).

### Server Utilities
- `server/utils/admin-availability.ts` – ✅ Implemented correctly (file: `server/utils/admin-availability.ts`; exports `getAdminAvailableSlots(date)` and `getAdminAvailableDates(month, year)` returning `AdminSlot{startTime, endTime, sessionDuration}` with no `doctorId`; reads `AdminSchedule isActive:true` + `GlobalBlockedDate` + `Booking CONFIRMED`; drops past-today slots, sorts `startTime asc`).
- `server/utils/availability.ts` – ✅ Implemented correctly (file: `server/utils/availability.ts`; exports per-doctor `getAvailableSlots`/`getAvailableDates` reading `Availability`+`BlockedSlot`; retained for display only, not called by booking handlers).
- `server/utils/payment.ts` – ✅ Implemented correctly (file: `server/utils/payment.ts`; exports `paymentGatewayConfigured()`, `createPaymentSession({bookingId, amount, currency})` with Paymob/Stripe/mock branches).

### Database Models
- No migration required (`Booking`, `Payment`, `AdminSchedule`, `GlobalBlockedDate`, `Settings` reads) – ✅ Implemented correctly (file: `prisma/schema.prisma`; models exist).

### Middleware
- `middleware/auth.ts` reused for `/book` – ✅ Implemented correctly (file: `middleware/auth.ts`; `modules/booking/pages/book.vue` declares `middleware:'auth'`).

### Emails
- Webhook SUCCESS → `bookingReceivedTemplate` ack – ✅ Implemented correctly (file: `server/utils/booking-status.ts:40`; to patient email when `Booking.status==='PENDING'`, called from `modules/payment/server/api/payment/webhook.post.ts`).
- Cancel → `bookingCancellationTemplate` – ✅ Implemented correctly (file: `modules/booking/server/api/booking/[id]/cancel.patch.ts:61`; to patient email after `CANCELLED`+`REFUNDED`).

### Environment Variables
- `PAYMENT_GATEWAY` – ✅ Implemented correctly (file: `.env.example:60`).
- `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_HMAC_SECRET` – ✅ Implemented correctly (files: `.env.example:65,68,71`).
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` – ✅ Implemented correctly (files: `.env.example:79,76,83`).
- `APP_URL` – ✅ Implemented correctly (file: `.env.example:14`; used for payment success/fail redirect URLs).
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` – ✅ Implemented correctly (files: `.env.example:46,50,53`).
- `JITSI_DOMAIN` – ✅ Implemented correctly (file: `.env.example:92`).

## Phase 4 – Patient Dashboard

### API Endpoints
- `GET /api/patient/profile` – ✅ Implemented correctly (file: `modules/patient/server/api/patient/profile.get.ts`; `requireAuth PATIENT`; selects `id,name,email,phone,photo`; 404 if missing).
- `PATCH /api/patient/profile` – ✅ Implemented correctly (file: `modules/patient/server/api/patient/profile.patch.ts`; `requireAuth PATIENT`; Zod `name min2/max100`, `phone? max30`; 400 `Name must be at least 2 characters`; updates only `{name, phone}`; email immutable).
- `POST /api/patient/profile/photo` – ⚠️ Partially implemented (file: `modules/patient/server/api/patient/profile/photo.post.ts`; `requireAuth PATIENT`; `multipart/form-data`, allows `jpeg/png/webp` else 400, 2MB `UPLOAD_MAX_SIZE` else 400, saves `${userId}-${timestamp}.ext` to `UPLOAD_PATH/patients/`, updates `User.photo=/patients/{file}`, returns `{photoUrl}`; gap: reads `process.env.UPLOAD_PATH`/`UPLOAD_MAX_SIZE` directly instead of `useRuntimeConfig()`).
- `GET /api/patient/appointments` – ✅ Implemented correctly (file: `modules/patient/server/api/patient/appointments.get.ts`; `requireAuth PATIENT`; `?tab=upcoming|past|all` default `upcoming`; upcoming `status CONFIRMED && date>=today ASC`; past `(CANCELLED) OR (CONFIRMED && date<today) DESC`; includes `doctorName/doctorPhoto/date/startTime/endTime/service/status/sessionRoom`).
- `GET /api/patient/payments` – ✅ Implemented correctly (file: `modules/patient/server/api/patient/payments.get.ts`; `requireAuth PATIENT`; `Payment where booking.userId=me`, `createdAt DESC`; returns `{id,amount,currency,status,createdAt,booking:{doctorName,date,service}}`).
- `GET /api/patient/session/:bookingId` – ✅ Implemented correctly (file: `modules/patient/server/api/patient/session/[bookingId].get.ts`; `requireAuth PATIENT`; 403 non-owner, 403 non-`CONFIRMED`, 403 `Session is not available at this time` outside `start-5min` to `end+15min`; `SessionRoom upsert bookingId roomName=tawasul-{bookingId} expiresAt=end+15min`; returns `{roomName,jitsiDomain}` from `Settings.jitsiDomain` or `JITSI_DOMAIN`).
- `PATCH /api/booking/:id/cancel` (reuse) – ✅ Implemented correctly (file: `modules/booking/server/api/booking/[id]/cancel.patch.ts`; see Phase 3 entry).

### Pages
- `/dashboard` – ✅ Implemented correctly (file: `pages/dashboard/index.vue`; middleware `['auth','patient-only']`; `layout:false`; redirect `/dashboard/appointments`).
- `/dashboard/appointments` – ⚠️ Partially implemented (file: `pages/dashboard/appointments.vue`; layout `patient-layout`; middleware `['auth','patient-only']`; renders `FullCalendar` + booking dialog + cancel dialog with `book-appointment`/`cancel-confirm`; gap: no documented Tabs Upcoming/Past with appointment cards (doctor photo+name, `Monday, 4 March 2024` date, `10:00 AM – 11:00 AM` time, Join Session active/gray, Cancel >24h modal moving card upcoming→past), no `setInterval 60s` Join recalculation visible in template structure).
- `/dashboard/payments` – ✅ Implemented correctly (file: `pages/dashboard/payments.vue`; layout `patient-layout`; middleware `['auth','patient-only']`; desktop `Table` Date/Doctor/Service/Amount/Status with `Badge`, mobile `payment-card` list, empty `payments-empty` `No payment history`, `Skeleton` loading).
- `/dashboard/profile` – ✅ Implemented correctly (file: `pages/dashboard/profile.vue`; layout `patient-layout`; middleware `['auth','patient-only']`; circular `Avatar` + file picker `photo-input` + `upload-photo` immediate upload; `profile-name` required, `profile-phone` optional, `profile-email` read-only, `save-profile` → `PATCH profile`).
- `/dashboard/session/:bookingId` – ✅ Implemented correctly (file: `pages/dashboard/session/[bookingId].vue`; layout `patient-layout`; middleware `['auth','patient-only']`; `GET /api/patient/session/:id`; 403 → `session-waiting` `Your session starts soon` + countdown + 30s poll; success → Jitsi `#jitsi-container` with `prejoinPageEnabled:false`, muted start; `leave-session` modal → `/dashboard/appointments`).

### Components
- No patient components required as separate files – no check performed.

### Composables
- `usePatientDashboard` – ✅ Implemented correctly (file: `modules/patient/composables/usePatientDashboard.ts`; state `profile`, `upcomingAppointments`, `pastAppointments`, `payments`, `isLoading` (`patient-dashboard-loading`), `error` via `useState`; methods `fetchProfile`, `updateProfile({name,phone?})`, `uploadPhoto(file)`, `fetchAppointments()` both tabs, `cancelAppointment(bookingId)` + local move, `fetchPayments()`, plus extras `fetchAllAppointments`, `fetchSession`, `clear`).

### Server Utilities
- Reuse `server/utils/prisma.ts`, `server/utils/auth.ts` (`requireAuth`), `server/utils/meeting.ts` (`canJoinMeetingAt`, `meetingWindow`, `MEETING_OPEN_EARLY_MIN=5`, `MEETING_CLOSE_LATE_MIN=15`) – ✅ Implemented correctly (files exist; no new utilities required).

### Database Models
- No model change required (`User`, `Booking`, `Payment`, `SessionRoom` reads) – ✅ Implemented correctly (file: `prisma/schema.prisma`; models exist).

### Middleware
- `middleware/auth.ts` + `middleware/patient-only.ts` on all patient pages – ✅ Implemented correctly (files: `middleware/auth.ts`, `middleware/patient-only.ts`; `pages/dashboard/*.vue` declare `middleware:['auth','patient-only']`).
- `modules/patient/layouts/PatientLayout.vue` – ✅ Implemented correctly (file: `modules/patient/layouts/PatientLayout.vue`; registered as `patient-layout`; sidebar `My Appointments/My Payments/Profile/Logout`, mobile bottom nav, `Toaster`).

### Emails
- No new emails required (cancellation reuse on `PATCH /api/booking/:id/cancel`) – ✅ Implemented correctly (file: `modules/booking/server/api/booking/[id]/cancel.patch.ts:61` sends `bookingCancellationTemplate`).

### Environment Variables
- `UPLOAD_PATH` – ✅ Implemented correctly (file: `.env.example:109`; used in `modules/patient/server/api/patient/profile/photo.post.ts`).
- `UPLOAD_MAX_SIZE` – ✅ Implemented correctly (file: `.env.example:113`; used for 2MB check).
- `JITSI_DOMAIN` – ✅ Implemented correctly (file: `.env.example:92`; used in `modules/patient/server/api/patient/session/[bookingId].get.ts`).

## Phase 5 – Doctor Dashboard

### API Endpoints
- `GET /api/doctor/profile` – ❌ Missing (expected file: `modules/doctor/server/api/doctor/profile.get.ts`; `modules/doctor/server/api/doctor/` directory exists but is empty).
- `PATCH /api/doctor/profile` – ❌ Missing (expected file: `modules/doctor/server/api/doctor/profile.patch.ts`; directory empty).
- `POST /api/doctor/profile/photo` – ❌ Missing (expected file: `modules/doctor/server/api/doctor/profile/photo.post.ts`; directory empty).
- `GET /api/doctor/bookings` – ❌ Missing (expected file: `modules/doctor/server/api/doctor/bookings.get.ts` with `?start&end YYYY-MM-DD`; directory empty).
- `GET /api/doctor/bookings/:id` – ❌ Missing (expected file: `modules/doctor/server/api/doctor/bookings/[id].get.ts`; directory empty).
- `GET /api/doctor/session/:bookingId` – ❌ Missing (expected file: `modules/doctor/server/api/doctor/session/[bookingId].get.ts`; directory empty).

### Pages
- `/doctor` – ⚠️ Partially implemented (file: `pages/doctor.vue`; layout `dashboard`; middleware `doctor-only`; renders placeholder `Doctor Dashboard` + `Your schedule and sessions arrive in Phase 5`; gap: not a redirect to `/doctor/calendar`).
- `/doctor/calendar` – ❌ Missing (expected file: `modules/doctor/pages/calendar.vue` or `pages/doctor/calendar.vue`; `modules/doctor/pages/` directory exists but is empty).
- `/doctor/profile` – ❌ Missing (expected file: `modules/doctor/pages/profile.vue` or `pages/doctor/profile.vue`; directory empty).
- `/doctor/session/:bookingId` – ❌ Missing (expected file: `modules/doctor/pages/session/[bookingId].vue` or `pages/doctor/session/[bookingId].vue`; directory empty).

### Components
- `SpecializationsTagInput.vue` – ❌ Missing (expected file: `modules/doctor/components/SpecializationsTagInput.vue`; `modules/doctor/components/` directory exists but is empty).

### Composables
- `useDoctorDashboard` – ❌ Missing (expected file: `modules/doctor/composables/useDoctorDashboard.ts`; `modules/doctor/composables/` directory exists but is empty; no `profile`, `bookings`, `isLoading`, `error`, `fetchProfile`, `updateProfile`, `uploadPhoto`, `fetchBookings` found).

### Server Utilities
- Reuse `server/utils/prisma.ts`, `server/utils/auth.ts` – ✅ Implemented correctly (files exist; no new utilities required).

### Database Models
- No model change required (`User`, `Doctor`, `Booking`, `SessionRoom` reads) – ✅ Implemented correctly (file: `prisma/schema.prisma`; models exist).

### Middleware
- `middleware/auth.ts` + `middleware/doctor-only.ts` files – ✅ Implemented correctly (files: `middleware/auth.ts`, `middleware/doctor-only.ts`; `pages/doctor.vue` declares `middleware:'doctor-only'`).
- Doctor pages middleware usage – ❌ Missing (no `/doctor/calendar`, `/doctor/profile`, `/doctor/session/:bookingId` files to declare `auth`+`doctor-only`).
- `DoctorLayout.vue` – ❌ Missing (expected file: `modules/doctor/layouts/DoctorLayout.vue`; no layouts directory under `modules/doctor/`; no incomplete-profile yellow banner).

### Emails
- No emails required – no check performed.

### Environment Variables
- `UPLOAD_PATH`, `UPLOAD_MAX_SIZE`, `JITSI_DOMAIN` – ✅ Implemented correctly (files: `.env.example:109,113,92`; present though doctor endpoints absent).

## Phase 6 – Admin Dashboard

### API Endpoints
- `GET /api/admin/overview` – ❌ Missing (expected file: `modules/admin/server/api/admin/overview.get.ts`; no file found).
- `GET /api/admin/bookings` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/bookings/index.get.ts`; `requirePermission APPOINTMENTS READ`; filters `?start&end&doctorId&status`; includes patient/doctor; `date ASC/startTime ASC`).
- `GET /api/admin/bookings/:id` – ❌ Missing (expected file: `modules/admin/server/api/admin/bookings/[id].get.ts`; no file found).
- `PATCH /api/admin/bookings/:id/cancel` – ❌ Missing (expected file: `modules/admin/server/api/admin/bookings/[id]/cancel.patch.ts`; no file found).
- `GET /api/admin/bookings/pending` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/bookings/pending.get.ts`; `requirePermission APPOINTMENTS READ`; `status PENDING ASC`; returns `{id,patientName,patientEmail,patientPhone,date,startTime,endTime,status,createdAt}`).
- `PATCH /api/admin/bookings/:id/assign` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts`; `requirePermission APPOINTMENTS UPDATE`; Zod `{doctorId}`; requires `PENDING` else 400, doctor active else 400, no overlapping `CONFIRMED` same date/time else 400; sets `{doctorId, CONFIRMED}`; `sendEmail(bookingConfirmationTemplate)` to patient and doctor; returns `{booking:{id,doctorId,status}}`).
- `GET /api/admin/doctors` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/doctors/index.get.ts`; `requirePermission DOCTORS READ`; `?active=true` filter; includes user name/email/phone/photo; returns `{id,name,email,phone,photo,specializations,isActive,slug}`; gap: omits documented `sessionCountThisMonth/AllTime` counts).
- `GET /api/admin/doctors/:id` – ❌ Missing (expected file: `modules/admin/server/api/admin/doctors/[id].get.ts`; no file found).
- `POST /api/admin/doctors` – ❌ Missing (expected file: `modules/admin/server/api/admin/doctors/index.post.ts`; no file found).
- `PATCH /api/admin/doctors/:id` – ❌ Missing (expected file: `modules/admin/server/api/admin/doctors/[id].patch.ts`; no file found).
- `GET /api/admin/doctors/:id/availability` – ❌ Missing (expected file: `modules/admin/server/api/admin/doctors/[id]/availability.get.ts`; no file found).
- `POST /api/admin/doctors/:id/availability` – ❌ Missing (expected file: `modules/admin/server/api/admin/doctors/[id]/availability.post.ts`; no file found).
- `POST /api/admin/doctors/:id/availability/block` – ❌ Missing (expected file: `modules/admin/server/api/admin/doctors/[id]/availability/block.post.ts`; no file found).
- `DELETE /api/admin/doctors/:id/availability/block/:blockId` – ❌ Missing (expected file: `modules/admin/server/api/admin/doctors/[id]/availability/block/[blockId].delete.ts`; no file found).
- `GET /api/admin/patients` – ❌ Missing (expected file: `modules/admin/server/api/admin/patients/index.get.ts`; no file found).
- `GET /api/admin/patients/:id` – ❌ Missing (expected file: `modules/admin/server/api/admin/patients/[id].get.ts`; no file found).
- `GET /api/admin/payments` – ❌ Missing (expected file: `modules/admin/server/api/admin/payments/index.get.ts`; no file found).
- `GET /api/admin/staff` – ❌ Missing (expected file: `modules/admin/server/api/admin/staff/index.get.ts`; no file found).
- `POST /api/admin/staff` – ❌ Missing (expected file: `modules/admin/server/api/admin/staff/index.post.ts`; no file found).
- `PATCH /api/admin/staff/:id` – ❌ Missing (expected file: `modules/admin/server/api/admin/staff/[id].patch.ts`; no file found).
- `DELETE /api/admin/staff/:id` – ❌ Missing (expected file: `modules/admin/server/api/admin/staff/[id].delete.ts`; no file found).
- `GET /api/admin/settings` – ❌ Missing (expected file: `modules/admin/server/api/admin/settings.get.ts`; no file found).
- `PATCH /api/admin/settings` – ❌ Missing (expected file: `modules/admin/server/api/admin/settings.patch.ts`; no file found).
- `GET /api/admin/schedule` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/schedule/index.get.ts`; `requirePermission SETTINGS UPDATE`; `AdminSchedule orderBy dayOfWeek ASC`; returns `{schedules}`).
- `POST /api/admin/schedule` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/schedule/index.post.ts`; `requirePermission SETTINGS UPDATE`; Zod `dayOfWeek 0-6/startTime/endTime/sessionDuration 30|45|60` + `start<end`; 201 `{schedule}`).
- `PATCH /api/admin/schedule/:id` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/schedule/[id].patch.ts`; `requirePermission SETTINGS UPDATE`; partial update; 404 if missing; returns `{schedule}`).
- `DELETE /api/admin/schedule/:id` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/schedule/[id].delete.ts`; `requirePermission SETTINGS UPDATE`; 404 if missing; returns `{ok:true}`).
- `GET /api/admin/blocked-dates` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/blocked-dates/index.get.ts`; `requirePermission SETTINGS UPDATE`; future dates `ASC`; returns `{blockedDates}`).
- `POST /api/admin/blocked-dates` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/blocked-dates/index.post.ts`; `requirePermission SETTINGS UPDATE`; Zod `{date YYYY-MM-DD, reason?}`; rejects past, 409 if exists; 201 `{blockedDate}`).
- `DELETE /api/admin/blocked-dates/:id` – ✅ Implemented correctly (file: `modules/admin/server/api/admin/blocked-dates/[id].delete.ts`; `requirePermission SETTINGS UPDATE`; 404 if missing; returns `{ok:true}`).

### Pages
- `/admin` – ⚠️ Partially implemented (file: `pages/admin.vue`; layout `admin`; middleware `staff-only`; renders stat cards Active weekly slots/Blocked days/Pending bookings + links `/admin/appointments`, `/admin/settings`; gap: serves overview content at `/admin` instead of redirecting to `/admin/overview`).
- `/admin/overview` – ❌ Missing (expected file: `pages/admin/overview.vue`; overview served at `pages/admin.vue` instead).
- `/admin/appointments` – ✅ Implemented correctly (file: `pages/admin/appointments.vue`; layout `admin`; middleware `staff-only`; Tabs calendar/pending; `FullCalendar`; pending list with `assign-{id}` + `assign-dialog` with `assign-doctor-select` + assign confirm).
- `/admin/doctors` – ❌ Missing (expected file: `pages/admin/doctors.vue`; no file found).
- `/admin/doctors/:id` – ❌ Missing (expected file: `pages/admin/doctors/[id].vue`; no file found).
- `/admin/patients` – ❌ Missing (expected file: `pages/admin/patients.vue`; no file found).
- `/admin/patients/:id` – ❌ Missing (expected file: `pages/admin/patients/[id].vue`; no file found).
- `/admin/payments` – ❌ Missing (expected file: `pages/admin/payments.vue`; no file found).
- `/admin/staff` – ❌ Missing (expected file: `pages/admin/staff.vue`; no file found).
- `/admin/settings` – ⚠️ Partially implemented (file: `pages/admin/settings.vue`; layout `admin`; middleware `staff-only`; Tabs schedule/blocked with weekly schedule list + Add slot + blocked dates list + Block modal + delete dialog; gap: missing documented PlatformInfo (name/contact/whatsapp), Pricing (price/duration), DefaultHours, Gateway (selector/masked keys) sections).

### Components
- `PermissionBuilder.vue` – ❌ Missing (expected file: `modules/admin/components/PermissionBuilder.vue`; `modules/admin/components/` directory exists but is empty).
- `DoctorColorChip.vue` – ❌ Missing (expected file: `modules/admin/components/DoctorColorChip.vue`; directory empty).
- `StatsCard.vue` – ❌ Missing (expected file: `modules/admin/components/StatsCard.vue`; directory empty).

### Composables
- `useAdminDashboard` – ⚠️ Partially implemented (file: `modules/admin/composables/useAdminDashboard.ts`; state `schedules`, `blockedDates`, `pendingBookings`, `activeDoctors`, `bookings`, `loading` (named `loading`, not `isLoading`), `error`; methods `fetchSchedules/addSchedule/updateSchedule/deleteSchedule/fetchBlockedDates/blockDate/unblockDate/fetchPendingBookings/fetchBookings/assignDoctor/fetchActiveDoctors`; gap: missing `overview`, `doctors` (only `activeDoctors`), `patients`, `payments`, `staff`, `settings` state; missing `fetchOverview/fetchDoctors/fetchPatients/fetchPayments/fetchStaff/fetchSettings/updateSettings/getDoctorColor`; contains `updateBookingStatus(id)` calling `PATCH /api/admin/bookings/:id/status` which has no corresponding server file).

### Server Utilities
- `server/utils/permissions.ts` (`requirePermission`) – ✅ Implemented correctly (file: `server/utils/permissions.ts`; used by all present admin endpoints; DB lookup every request).

### Database Models
- `AdminSchedule` – ✅ Implemented correctly (file: `prisma/schema.prisma`).
- `GlobalBlockedDate` – ✅ Implemented correctly (file: `prisma/schema.prisma`).
- `Booking.doctorId` nullable + `BookingStatus` – ✅ Implemented correctly (file: `prisma/schema.prisma`).

### Middleware
- `middleware/auth.ts` + `middleware/staff-only.ts` files – ✅ Implemented correctly (files: `middleware/auth.ts`, `middleware/staff-only.ts`; `pages/admin.vue`, `pages/admin/appointments.vue`, `pages/admin/settings.vue` declare `middleware:'staff-only'`).
- `layouts/admin.vue` – ⚠️ Partially implemented (file: `layouts/admin.vue`; layout name `admin`; sidebar Overview `/admin`, Appointments `/admin/appointments`, Settings `/admin/settings` + Logout; gap: missing documented `AdminLayout.vue` with permission-filtered items `Overview/All Appointments/Manage Doctors/Manage Patients/Manage Payments/Manage Staff/Settings` via `hasPermission(resource,'READ')`).

### Emails
- Admin assigns doctor → `bookingConfirmationTemplate` to patient – ✅ Implemented correctly (file: `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts:75`; after `PENDING→CONFIRMED`).
- Admin assigns doctor → `bookingConfirmationTemplate` to doctor – ✅ Implemented correctly (file: `modules/admin/server/api/admin/bookings/[id]/assign.patch.ts:85`; to `doctor.user.email`).
- Admin cancels → `bookingCancellationTemplate` – ❌ Missing (no `PATCH /api/admin/bookings/:id/cancel` file to trigger it).
- Doctor created → `doctorWelcomeTemplate` – ❌ Missing (no `POST /api/admin/doctors` file; zero `sendEmail(doctorWelcomeTemplate)` calls in codebase).
- Staff created → welcome email – ❌ Missing (no `POST /api/admin/staff` file; zero staff welcome `sendEmail` calls).

### Environment Variables
- `SEED_ADMIN_EMAIL` – ✅ Implemented correctly (file: `.env.example:127`; seed protects/grants permissions; no `DELETE /api/admin/staff/:id` file to enforce seed-delete protection).
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` – ✅ Implemented correctly (files: `.env.example:46,50,53`).

## Phase 7 – QA-Deploy

### API Endpoints
- No new endpoints required – no check performed.

### Pages
- No new pages required – no check performed.

### Components
- No new components required – no check performed.

### Composables
- No new composables required – no check performed.

### Server Utilities
- No new utilities required – no check performed.

### Database Models
- No model change required – no check performed.

### Middleware
- No new middleware required – no check performed.

### Emails
- Session reminder → `sessionReminderTemplate` (24h reminder) – ❌ Missing (template exported in `server/utils/email.ts:167`; zero `sendEmail(sessionReminderTemplate)` calls in codebase).

### Environment Variables
- `.env.prod` – ❌ Missing (expected file: `.env.prod`; no file in repo root; `.gitignore` lists `.env.prod` as ignored).
- `docker-compose.prod.yml` – ✅ Implemented correctly (file: `docker-compose.prod.yml`; services `postgres`, `app` (`Dockerfile.prod`, `env_file .env.prod`, `uploads_data:/app/uploads`), `nginx:alpine` (`80:80 443:443`, `nginx.conf`/`conf.d`/`certbot` volumes), `certbot`).
- `Dockerfile.prod` – ✅ Implemented correctly (file: `Dockerfile.prod`; multi-stage `builder` (`npm ci`, `npm run build`) + `runner` (`.output`, `prisma`, `npm ci --omit=dev`, `EXPOSE 3000`, `node .output/server/index.mjs`)).
- `nginx/nginx.conf` – ❌ Missing (expected file: `nginx/nginx.conf`; no `nginx/` directory).
- `nginx/conf.d/tawasul.conf` – ❌ Missing (expected file: `nginx/conf.d/tawasul.conf`; no `nginx/` directory).
- `scripts/deploy.sh` – ❌ Missing (expected file: `scripts/deploy.sh`; no `scripts/` directory).

## Out of Scope

- 🚫 Out of scope (file: `modules/session/server/api/meeting/lobby/[meetingId].get.ts`; role-aware `patient|doctor|staff` meeting lobby returning `{meetingId,role,status,canJoin,patientName,doctorName,date,startTime,endTime,service,jitsiDomain,roomName}`; not mentioned in any phase document).
- 🚫 Out of scope (file: `pages/meeting/[meetingId]/lobby.vue`; route `/meeting/:meetingId/lobby`, layout `MeetingLayout`, middleware `auth`; lobby UI with `meeting-role/status/doctor/patient` + `join-meeting`; not in sitemap).
- 🚫 Out of scope (file: `modules/session/layouts/MeetingLayout.vue`; layout `MeetingLayout` with Back/Logout header; not in phase layouts).
- 🚫 Out of scope (file: `modules/session/composables/useMeetingLobby.ts`; `fetchMeeting(meetingId)` → `GET /api/meeting/lobby/:id`; not in phase composables).
- 🚫 Out of scope (file: `server/utils/meeting.ts`; `MEETING_OPEN_EARLY_MIN=5`, `MEETING_CLOSE_LATE_MIN=15`, `meetingWindow`, `canJoinMeetingAt`; not in phase expected-output utils).
- 🚫 Out of scope (file: `server/utils/booking-status.ts`; `handleSuccessfulPayment`/`handleFailedPayment` with idempotent updates + ack email; not in phase expected-output utils).
- 🚫 Out of scope (file: `server/utils/holidays.ts`; `getEgyptianHolidays`/`isHoliday` with fixed/Easter/Islamic tables 2024-2027; not in phase documents; blocks `getAdminAvailableSlots/Dates`).
- 🚫 Out of scope (file: `modules/booking/server/api/booking/holidays.get.ts`; `GET /api/booking/holidays` returning `{holidays}`; not in endpoint checklist).
- 🚫 Out of scope (file: `modules/payment/server/api/payment/dev/complete.get.ts`; `GET /api/payment/dev/complete?bookingId=` calling `handleSuccessfulPayment` then `302 /booking/success?bookingId=` when gateway unconfigured; not in phase documents).
- 🚫 Out of scope (file: `server/routes/patients/[filename].get.ts`; serves `UPLOAD_PATH/patients/<filename>` `jpg/jpeg/png/webp` with `Cache-Control immutable`; not in phase documents).
- 🚫 Out of scope (file: `server/utils/payment.ts` extra `createPaymentError`; `server/utils/validation.ts` extra schemas consumed by implemented code; `lib/api.ts`; `composables/use-toast.ts`; `layouts/admin.vue` as concrete `admin` layout instead of documented `AdminLayout.vue`).
