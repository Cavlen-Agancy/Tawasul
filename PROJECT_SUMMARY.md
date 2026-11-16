# مشروع تواصل (Tawasul Academy) — ملخص شامل

## 📋 نظرة عامة

**تواصل (Tawasul Academy)** هي منصة إلكترونية متكاملة للاستشارات النفسية والتربوية والأسرية، توفر جلسات **أونلاين** (عبر الفيديو) و **حضورياً** بمقر الأكاديمية. المشروع مبني بأحدث التقنيات لضمان الأداء، الأمان، وقابلية التوسع.

---

## 🏗️ البنية المعمارية (Architecture)

### نمط التصميم: **Modular Monolith** مع **Nuxt 3 Modules**
- كل ميزة رئيسية معزولة في **Module مستقل** (Auth, Booking, Payment, Patient, Doctor, Admin, Session)
- كل Module يحتوي على: `pages/`، `components/`، `composables/`، `server/` (API routes, utils)
- تسجيل الوحدات تلقائياً عبر `nuxt.config.ts` (hooks: `pages:extend`, `components`, `imports`)

### تدفق البيانات (Data Flow)
```
Client (Vue 3 + Nuxt 3 SSR)
    │
    ├── API Calls → Nitro Server Routes (/server/api/**)
    │                      │
    │                      ├── Middleware (auth, permissions)
    │                      ├── Prisma ORM → PostgreSQL
    │                      ├── External Services (LiveKit, Stripe/Paymob, Resend Email)
    │                      └── Business Logic (utils, services)
    │
    └── Real-time → LiveKit WebRTC (Video/Audio sessions)
```

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

| الفئة | التقنيات |
|----------|------------|
| **Frontend Framework** | Nuxt 3 (Vue 3, Composition API, TypeScript) |
| **Styling** | Tailwind CSS + shadcn-vue (Radix UI primitives) |
| **Database** | PostgreSQL 16 + Prisma ORM |
| **Authentication** | JWT (jose) + HttpOnly Cookies + bcryptjs |
| **Real-time Video** | LiveKit (WebRTC) — livekit-client / livekit-server-sdk |
| **Payments** | Stripe + Paymob (مصري) — Webhooks للـ callbacks |
| **Email** | Resend (Transactional emails) |
| **Calendar** | FullCalendar (Vue 3 wrapper) |
| **Validation** | Zod (Schema validation) |
| **Testing** | Vitest (Unit/Integration) + Playwright (E2E) |
| **Containerization** | Docker Compose (Postgres, pgAdmin, LiveKit) |
| **Deployment** | Docker (Production) + Nuxt Build (SSR) |

### المكتبات الرئيسية (Key Dependencies)
```json
{
  "nuxt": "^3.14",
  "@prisma/client": "^5.22",
  "@nuxtjs/tailwindcss": "^6.12",
  "shadcn-vue": "^2.8",
  "livekit-client": "^2.22",
  "livekit-server-sdk": "^2.19",
  "stripe": "^22.6",
  "@stripe/stripe-js": "^9.15",
  "resend": "^3.5",
  "jose": "^6.2",
  "bcryptjs": "^2.4",
  "zod": "^3.23",
  "@fullcalendar/vue3": "^6.1",
  "@vueuse/nuxt": "^12.0"
}
```

---

## 🗄️ نموذج قاعدة البيانات (Database Schema)

### النماذج الرئيسية (Core Models)

| النموذج | الوصف | العلاقات الرئيسية |
|----------|--------|------------------|
| **User** | المستخدمون (مريض، طبيب، موظف) | 1→1 Doctor, 1→N Booking, 1→N Permission |
| **Doctor** | ملف الطبيب الشخصي | 1→N Availability, 1→N Booking, 1→N DoctorNote |
| **Booking** | الحجوزات (جلسات) | N→1 User (patient), N→1 Doctor, 1→1 Payment, 1→1 SessionRoom |
| **Availability** | مواعيد توفر الطبيب الأسبوعية | N→1 Doctor |
| **BlockedSlot** | فترات محجوبة للطبيب | N→1 Doctor |
| **Payment** | المدفوعات | 1→1 Booking |
| **SessionRoom** | غرفة LiveKit للجلسة | 1→1 Booking |
| **DoctorNote** | ملاحظات الطبيب بعد الجلسة | N→1 Booking, N→1 Doctor |
| **Settings** | إعدادات المنصة (Singleton) | — |
| **AdminSchedule** | جدول مواعيد الإدارة العامة | — |
| **GlobalBlockedDate** | تواريخ محجوبة عالمياً | — |

### Enums مهمة
```prisma
enum AccountType { PATIENT, DOCTOR, STAFF }
enum BookingStatus { PENDING, CONFIRMED, CANCELLED, IN_REVIEW }
enum PaymentStatus { PENDING, SUCCESS, FAILED, REFUNDED }
enum SessionType { ONLINE, IN_CLINIC }
enum Resource { APPOINTMENTS, PATIENTS, DOCTORS, PAYMENTS, SETTINGS, STAFF }
enum Action { CREATE, READ, UPDATE, DELETE }
```

### نظام الصلاحيات (RBAC)
- **Permission** model: يربط `User` بـ `Resource` + `Action`
- فحوصات الصلاحية في: `server/utils/permissions.ts` + Middleware (`staff-only`, `doctor-only`, `patient-only`)

---

## 🔐 نظام المصادقة والتفويض (Auth & AuthZ)

### تسجيل الدخول / التسجيل
- **Email + Password** مع bcryptjs (cost: 12)
- **JWT** موقع بـ HS256 (jose library)، مخزن في **HttpOnly Secure Cookie** (`auth_token`)
- **Email Verification**: توكن يُرسل عبر Resend، ينتهي خلال 24 ساعة
- **Password Reset**: توكن آمن ينتهي خلال ساعة واحدة

### Middleware سلسلة (Middleware Chain)
```
auth.ts (global) → يضيف event.context.user
    │
    ├── guest.ts (يمنع المسجلين من دخول login/register)
    ├── patient-only.ts (يتطلب PATIENT accountType)
    ├── doctor-only.ts (يتطلب DOCTOR + profile مكتمل)
    └── staff-only.ts (يتطلب STAFF + permission CHECK)
```

### حماية المسارات (Route Protection)
- **Client-side**: `definePageMeta({ middleware: ['auth', 'patient-only'] })`
- **Server-side**: نفس الـ middleware يعمل على API routes

---

## 📅 نظام الحجوزات (Booking System)

### أنواع الجلسات
1. **ONLINE** — عبر LiveKit Video Call
2. **IN_CLINIC** — حضورياً في مقر الأكاديمية

### تدفق الحجز (Booking Flow)
```
1. Patient يختار: الطبيب، التاريخ، الوقت، نوع الجلسة
2. التحقق من التوفر (Availability + BlockedSlot + GlobalBlockedDate)
3. إنشاء Booking بـ status: PENDING
4. إنشاء Payment record (PENDING)
5. Redirect إلى بوابة الدفع (Stripe / Paymob)
6. Webhook يتلقى النتيجة → يحدث Payment + Booking status
7. إذا SUCCESS:
   - ONLINE: إنشاء SessionRoom + LiveKit Token
   - IN_CLINIC: تأكيد بالحضور
8. إيميل تأكيد للطرفين (Resend)
```

### إدارة المواعيد (Availability Engine)
- **Weekly Schedule**: `Availability` model (dayOfWeek, startTime, endTime, sessionDuration)
- **Exceptions**: `BlockedSlot` (تواريخ محددة)، `GlobalBlockedDate` (أعياد/إجازات)
- **Admin Schedule**: `AdminSchedule` — جدول افتراضي للأطباء الجدد
- **Slot Generation**: `server/utils/availability.ts` — يحول الجدول الأسبوعي إلى فترات زمنية متاحة لحجز معين

---

## 💳 نظام المدفوعات (Payment System)

### بوابات مدعومة
| البوابة | العملة | البيئة |
|----------|--------|--------|
| **Stripe** | متعددة | International |
| **Paymob** | EGP | Egypt (Local) |

### التكامل
- **Payment Module** معزول: `modules/payment/`
- **API Routes**: `initiate.post.ts`، `webhook.post.ts`، `dev/complete.get.ts` (للاختبار)
- **Webhooks**: موقع بـ HMAC (Paymob) / Signature (Stripe) للتحقق
- **Idempotency**: استخدام `bookingId` كمفتاح فريد في `Payment` model

---

## 🎥 نظام الجلسات المباشرة (LiveKit Integration)

### البنية
```
LiveKit Server (Docker) ←──→ Nuxt App (livekit-server-sdk)
                                    │
                                    ├── createAccessToken() → Joining tokens
                                    ├── createRoom() / deleteRoom()
                                    └── Room metadata (bookingId, participants)
```

### تدفق الجلسة (Session Flow)
1. **Booking CONFIRMED + PAID** → `POST /api/session/room` ينشئ `SessionRoom` + LiveKit Room
2. **Doctor/Patient** يدخلان `/meeting/[meetingId]/lobby`
3. **Lobby Page** يطلب `accessToken` من `/api/session/token`
4. **LiveKit Client** ينضم للغرفة → Video/Audio/Data channels
5. **Session End** → Room expires (TTL) أو يدوياً

### مكونات الواجهة
- `pages/meeting/[meetingId]/lobby.vue` — شاشة الانتظار + اختبار الميكروفون/الكاميرا
- `components/doctor/session-note.vue` — ملاحظات الطبيب أثناء/بعد الجلسة
- `composables/useLiveKitSession.ts` — منطق الانضمام/المغادرة/الأخطاء

---

## 👥 الأدوار والواجهات (Roles & Interfaces)

| الدور | المسارات الرئيسية | الميزات |
|-------|------------------|---------|
| **Patient (مريض)** | `/dashboard/*`، `/book`، `/meeting/*` | حجز، تقويم، مدفوعات، جلسات، ملف شخصي |
| **Doctor (طبيب)** | `/doctor/*` | تقويم، مرضى، جلسات، ملاحظات، توفر، ملف شخصي |
| **Staff/Admin (إدارة)** | `/admin/*` | إدارة أطباء/مرضى/موظفين، حجوزات، مدفوعات، إعدادات، جدول مواعيد |

### Layouts مخصصة لكل دور
- `PatientLayout` — شريط جانبي + تنقل المريض
- `DoctorLayout` — شريط جانبي + تنقل الطبيب
- `MeetingLayout` — واجهة الجلسة (Full-screen، بدون تشتيت)
- `default` — الصفحة الرئيسية، تسجيل الدخول، الصفحات العامة

---

## 🎨 نظام التصميم (Design System)

### الألوان (Brand Colors)
```css
--primary: #E91E8C (Magenta)     /* Brand color */
--background: #121218 (Dark)      /* Dark mode default */
--card: #171722
--border: rgba(255,255,255,0.1)
```

### الخطوط
- **Arabic**: IBM Plex Sans Arabic (300-700)
- **Latin**: Inter (400-700)
- RTL مدعوم بالكامل (`dir="rtl"`, `htmlAttrs.dir: 'rtl'`)

### المكونات (Components)
- **shadcn-vue** في `components/ui/` (Button, Card, Dialog, Table, Tabs, Badge, Avatar, Input, Toast, Skeleton)
- Auto-imported عبر `shadcn-nuxt` module
- Dark mode افتراضي مع Toggle (`ThemeToggle.vue`، `useTheme.ts`، `theme.client.ts` plugin)

---

## 📁 هيكل المشروع (Project Structure)

```
Tawasul/
├── app.vue                    # Root component
├── nuxt.config.ts             # Nuxt configuration (modules, hooks, runtimeConfig)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seeding
├── docker-compose.yml         # Dev: Postgres + pgAdmin + LiveKit
├── docker-compose.prod.yml    # Production
├── livekit.yaml               # LiveKit server config
├── components/
│   ├── ui/                    # shadcn-vue components (auto-imported)
│   ├── home/                  # Homepage sections
│   ├── doctor/                # Doctor-specific components
│   ├── patient-calendar.vue
│   └── doctor-calendar.vue
├── composables/               # Global composables (useTheme, useToast, useSiteSettings, etc.)
├── lib/
│   ├── api.ts                 # API client (fetch wrapper)
│   ├── site.ts                # Site config (brand, contact, booking paths)
│   ├── home-content.ts        # Homepage content data
│   └── utils.ts               # cn() helper (clsx + tailwind-merge)
├── middleware/                # Route middleware (auth, guest, role-based)
├── pages/                     # Global pages (/, /dashboard/*, /admin/*, /meeting/*)
├── modules/                   # Feature modules (Nuxt Modules)
│   ├── auth/                  # Authentication (login, register, verify, reset)
│   ├── booking/               # Booking flow (book, success, failed)
│   ├── payment/               # Payments (Stripe, Paymob, webhooks)
│   ├── patient/               # Patient dashboard + layout
│   ├── doctor/                # Doctor dashboard + layout
│   ├── admin/                 # Admin panel + layout
│   └── session/               # LiveKit session + MeetingLayout
├── server/
│   ├── middleware/            # Server middleware (auth.ts)
│   ├── api/                   # API routes (H3/Nitro)
│   │   ├── public/            # Public endpoints
│   │   ├── doctor/            # Doctor endpoints
│   │   └── ...
│   ├── routes/                # File serving routes (uploads)
│   └── utils/                 # Server utilities
│       ├── auth.ts            # JWT verify/sign
│       ├── booking-status.ts  # Booking state machine
│       ├── livekit-token.ts   # LiveKit token generation
│       ├── payment.ts         # Payment gateway abstraction
│       ├── availability.ts    # Slot generation logic
│       ├── permissions.ts     # RBAC checks
│       └── email.ts           # Resend email templates
├── tests/
│   ├── api/                   # Vitest API tests
│   ├── e2e/                   # Playwright E2E tests
│   └── utils/                 # Unit tests for utilities
└── public/                    # Static assets (images, favicon)
```

---

## 🔧 الأوامر الرئيسية (Key Commands)

```bash
# Development
npm run dev              # Nuxt dev server (port 3000)
npm run dev:db           # Start PostgreSQL + pgAdmin + LiveKit (Docker)
npm run dev:db:stop      # Stop Docker services

# Database
npx prisma migrate dev   # Run migrations
npx prisma db push       # Push schema changes (dev)
npx prisma studio        # Visual DB browser
npm run db:seed          # Seed database (tsx prisma/seed.ts)

# Build & Preview
npm run build            # Production build (SSR)
npm run preview          # Preview production build

# Testing
npm run test             # Vitest run (unit/integration)
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Coverage report
npm run test:api         # API tests only
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Playwright UI mode
```

---

## ⚙️ متغيرات البيئة (Environment Variables)

| المتغير | مطلوب | الوصف |
|-----------|--------|---------|
| `DATABASE_URL` | نعم | PostgreSQL connection string |
| `JWT_SECRET` | نعم | Secret for JWT signing (32+ chars) |
| `JWT_EXPIRES_IN` | لا | Token expiry (default: 7d) |
| `RESEND_API_KEY` | نعم | Resend API key for emails |
| `RESEND_FROM_EMAIL` | نعم | Sender email address |
| `RESEND_FROM_NAME` | لا | Sender name (default: Tawasul Academy) |
| `LIVEKIT_API_KEY` | نعم | LiveKit API key |
| `LIVEKIT_API_SECRET` | نعم | LiveKit API secret |
| `LIVEKIT_URL` | نعم | LiveKit WebSocket URL (ws://localhost:7880 dev) |
| `STRIPE_SECRET_KEY` | نعم* | Stripe secret key (*if using Stripe) |
| `STRIPE_PUBLISHABLE_KEY` | نعم* | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | نعم* | Stripe webhook signing secret |
| `PAYMOB_API_KEY` | نعم* | Paymob API key (*if using Paymob) |
| `PAYMOB_INTEGRATION_ID` | نعم* | Paymob integration ID |
| `PAYMOB_HMAC_SECRET` | نعم* | Paymob HMAC secret for webhooks |
| `PAYMENT_GATEWAY` | لا | `stripe` أو `paymob` (default: paymob) |
| `APP_URL` | لا | Public app URL (default: http://localhost:3000) |
| `UPLOAD_PATH` | لا | Upload directory (default: ./uploads) |
| `UPLOAD_MAX_SIZE` | لا | Max upload bytes (default: 2MB) |
| `SEED_ADMIN_EMAIL` | لا | Admin user email for seeding |
| `SEED_ADMIN_PASSWORD` | لا | Admin user password for seeding |
| `SEED_ADMIN_NAME` | لا | Admin user name for seeding |

---

## 🧪 الاختبارات (Testing Strategy)

### Unit / Integration (Vitest)
- **API Tests**: `tests/api/**/*.test.ts` — تختبر API endpoints مع mock للـ Prisma
- **Utils Tests**: `tests/utils/*.test.ts` — دوال مساعدة (auth, email, availability, permissions)
- **Test Setup**: `tests/api/setup.ts` — mock Prisma client، setup test database

### E2E (Playwright)
- **Global Setup**: `tests/e2e/global-setup.ts` — ينشئ مستخدمين للاختبار
- **Test Suites**:
  - `auth.spec.ts` — تسجيل دخول/خروج/تسجيل
  - `booking.spec.ts` — تدفق الحجز الكامل
  - `patient-dashboard.spec.ts` — واجهة المريض
  - `admin-panel.spec.ts` — لوحة الإدارة

---

## 🚀 النشر (Deployment)

### Development
```bash
docker compose up -d postgres pgadmin livekit
npm run dev
```

### Production (Docker)
```bash
# Build image
docker build -t tawasul-app .

# Run with docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d
```

### متطلبات الإنتاج
- PostgreSQL 16+ (Managed service مقترح: Neon, Supabase, Railway)
- LiveKit Server (مستضاف ذاتياً أو LiveKit Cloud)
- Redis (للـ Session scaling إذا لزم)
- Object Storage (S3/R2) لرفع الملفات
- SSL/TLS (Cloudflare Tunnel أو Nginx + Certbot)
- Domain + DNS

---

## 📌 ميزات رئيسية فريدة (Key Differentiators)

1. **Hybrid Sessions**: دعم سلس لـ Online (LiveKit WebRTC) + In-Clinic
2. **Modular Architecture**: كل Feature في Module مستقل قابل للاختبار والنشر
3. **RBAC مرن**: نظام صلاحيات مبني على Resource/Action قابل للتوسع
4. **Multi-Gateway Payments**: Stripe (دولي) + Paymob (مصري) مع abstraction layer
5. **Arabic-First**: RTL كامل، خطوط عربية، تواريخ عربية، تقويم هجري/ميلادي
6. **Type-Safe End-to-End**: TypeScript + Prisma + Zod validation
7. **Comprehensive Testing**: Unit + Integration + E2E مع CI/CD ready

---

## 🗺️ خارطة الطريق المقترحة (Roadmap Ideas)

- [ ] **Notifications**: Push/Email/SMS reminders قبل الجلسات
- [ ] **Patient Portal**: تاريخ طبي، تقارير، وصفات طبية
- [ ] **Doctor Analytics**: Dashboard إيرادات، معدل الحضور، تقييمات
- [ ] **Mobile App**: React Native / Expo مع Shared composables
- [ ] **AI Features**: ملخص جلسات تلقائي، اقتراح تشخيص، Chatbot دعم
- [ ] **Group Sessions**: ورش عمل، جلسات جماعية
- [ ] **Multi-language**: English UI toggle
- [ ] **Telephony Fallback**: دمج Twilio للمكالمات الصوتية كبديل

---

## 📄 رخصة
مشروع خاص — جميع الحقوق محفوظة لفريق تواصل.

---

*تم إنشاء هذا الملخص تلقائياً بناءً على تحليل الكود المصدري. للتحديثات، راجع `git log` أو تحدث مع فريق التطوير.*