# Session Task — الملفات المطلوبة

Bundled context for session/lobby task. Paths are repo-relative.

## 1. Infrastructure

### `docker-compose.yml`

```yaml
# Tawasul Academy — Docker Compose (Development)
#
# Development architecture:
#   Docker: PostgreSQL (+ pgAdmin for browsing)
#   Host:   Nuxt app via `npm run dev` (uses DATABASE_URL @ localhost:5433)
#
# The Nuxt app is NOT run as a container during local development, so no
# container ever writes to the host's .nuxt/ directory (avoids permission
# conflicts). Production uses docker-compose.prod.yml.

services:

  # ─────────────────────────────────────────
  # PostgreSQL Database
  # ─────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: tawasul_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: tawasul_db
      POSTGRES_USER: tawasul
      POSTGRES_PASSWORD: tawasul_pass
    ports:
      # 5433 on host because the default host port 5432 is occupied by another container
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tawasul -d tawasul_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - tawasul_network

  # ─────────────────────────────────────────
  # pgAdmin (Development Only)
  # ─────────────────────────────────────────
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: tawasul_pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_DEFAULT_EMAIL}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_DEFAULT_PASSWORD}
    ports:
      - "5050:80"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - tawasul_network

# ─────────────────────────────────────────
# Volumes
# ─────────────────────────────────────────
volumes:
  postgres_data:
  uploads_data:

# ─────────────────────────────────────────
# Networks
# ─────────────────────────────────────────
networks:
  tawasul_network:
    driver: bridge
```

### `.env.example`

```bash
# ─────────────────────────────────────────
# Tawasul Academy — Environment Variables
# ─────────────────────────────────────────
# Copy this file to .env and fill in all values
# Never commit .env to Git

# ─────────────────────────────────────────
# APP
# ─────────────────────────────────────────

# Base URL of the application
# Development: http://localhost:3000
# Production: https://yourdomain.com
APP_URL=http://localhost:3000

# Node environment
NODE_ENV=development

# ─────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────

# Full PostgreSQL connection string
# Development (app runs on host, DB in Docker): postgresql://tawasul:tawasul_pass@localhost:5433/tawasul_db
# Production (both in Docker network): postgresql://USER:PASSWORD@postgres:5432/tawasul_db
DATABASE_URL=postgresql://tawasul:tawasul_pass@localhost:5433/tawasul_db

# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────

# Secret key used to sign JWT tokens
# Must be a long random string — minimum 32 characters
# Generate with: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_here

# JWT token expiry duration
JWT_EXPIRES_IN=7d

# ─────────────────────────────────────────
# EMAIL — RESEND
# ─────────────────────────────────────────

# API key from your Resend account
# Get it from: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Verified sender email address on Resend
# Must be from a domain you have verified in Resend
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Display name shown in the From field of emails
RESEND_FROM_NAME=Tawasul Academy

# ─────────────────────────────────────────
# PAYMENT GATEWAY
# ─────────────────────────────────────────

# Choose one: paymob or stripe
PAYMENT_GATEWAY=paymob

# ── Paymob (use if PAYMENT_GATEWAY=paymob) ──

# API key from your Paymob account
PAYMOB_API_KEY=your_paymob_api_key

# Integration ID for the payment channel
PAYMOB_INTEGRATION_ID=your_paymob_integration_id

# HMAC secret for webhook signature verification
PAYMOB_HMAC_SECRET=your_paymob_hmac_secret

# ── Stripe (use if PAYMENT_GATEWAY=stripe) ──

# Publishable key from your Stripe dashboard
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx

# Secret key from your Stripe dashboard
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx

# Webhook signing secret
# Get it from: Stripe Dashboard > Webhooks > your endpoint > Signing secret
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# ── Generic payment gateway variables (for documentation compliance) ──

# Generic placeholder for the gateway API key
PAYMENT_GATEWAY_KEY=change_me

# Generic placeholder for the gateway secret
PAYMENT_GATEWAY_SECRET=change_me

# Generic placeholder for the webhook verification secret
PAYMENT_WEBHOOK_SECRET=change_me

# ─────────────────────────────────────────
# VIDEO SESSION — JITSI
# ─────────────────────────────────────────

# Jitsi domain to use for video sessions
# MVP: use meet.jit.si (free, no setup required)
# Production later: use your own self-hosted Jitsi instance
JITSI_DOMAIN=meet.jit.si

# App ID for Jitsi JWT authentication (only needed for self-hosted)
# Leave empty when using meet.jit.si
JITSI_APP_ID=

# Secret for signing Jitsi JWT tokens (only needed for self-hosted)
# Leave empty when using meet.jit.si
JITSI_APP_SECRET=

# ─────────────────────────────────────────
# FILE UPLOADS
# ─────────────────────────────────────────

# Path where uploaded photos are stored
# Development: ./uploads
# Production: /var/www/tawasul/uploads
UPLOAD_PATH=./uploads

# Maximum allowed file size for uploads in bytes
# Default: 2097152 (2MB)
UPLOAD_MAX_SIZE=2097152

# ─────────────────────────────────────────
# PGADMIN (development only)
# ─────────────────────────────────────────

PGADMIN_DEFAULT_EMAIL=admin@tawasul.com
PGADMIN_DEFAULT_PASSWORD=pgadmin_pass

# ─────────────────────────────────────────
# SEED
# ─────────────────────────────────────────

# Initial admin account created by prisma/seed.ts
SEED_ADMIN_EMAIL=admin@tawasul.com
SEED_ADMIN_PASSWORD=Change_this_immediately_123
SEED_ADMIN_NAME=Platform Admin
```

## 2. Schema

### `prisma/schema.prisma`

```prisma
// Tawasul Academy — Prisma Schema v2
// Database: PostgreSQL
// ORM: Prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

enum AccountType {
  PATIENT
  DOCTOR
  STAFF
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  IN_REVIEW // reserved for future use
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

enum SessionType {
  ONLINE
  IN_CLINIC
}

// ─────────────────────────────────────────
// PERMISSIONS
// ─────────────────────────────────────────

// Resources that can have permissions assigned
enum Resource {
  APPOINTMENTS
  PATIENTS
  DOCTORS
  PAYMENTS
  SETTINGS
  STAFF
}

// Actions available per resource
enum Action {
  CREATE
  READ
  UPDATE
  DELETE
}

// ─────────────────────────────────────────
// USER (all account types)
// ─────────────────────────────────────────

model User {
  id          String      @id @default(cuid())
  email       String      @unique
  password    String
  name        String
  phone       String?
  photo       String?
  accountType AccountType @default(PATIENT)

  emailVerified           Boolean   @default(false)
  emailVerificationToken  String?
  emailVerificationExpiry DateTime?

  passwordResetToken  String?
  passwordResetExpiry DateTime?

  isActive  Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  doctor       Doctor?
  permissions  Permission[]
  bookings     Booking[]     @relation("PatientBookings")

  @@map("users")
}

// ─────────────────────────────────────────
// PERMISSION
// ─────────────────────────────────────────

model Permission {
  id       String   @id @default(cuid())
  userId   String
  resource Resource
  action   Action

  createdAt DateTime @default(now())

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, resource, action])
  @@map("permissions")
}

// ─────────────────────────────────────────
// DOCTOR
// ─────────────────────────────────────────

model Doctor {
  id              String   @id @default(cuid())
  userId          String   @unique
  bio             String?
  slug            String   @unique
  specializations String[]
  isActive        Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  availability Availability[]
  blockedSlots BlockedSlot[]
  bookings     Booking[]     @relation("DoctorBookings")
  doctorNotes  DoctorNote[]

  @@map("doctors")
}

// ─────────────────────────────────────────
// AVAILABILITY
// ─────────────────────────────────────────

model Availability {
  id              String @id @default(cuid())
  doctorId        String
  dayOfWeek       Int    // 0 = Sunday, 6 = Saturday
  startTime       String // "09:00"
  endTime         String // "17:00"
  sessionDuration Int    // minutes: 30, 45, or 60

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  doctor Doctor @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@unique([doctorId, dayOfWeek])
  @@map("availability")
}

// ─────────────────────────────────────────
// BLOCKED SLOT
// ─────────────────────────────────────────

model BlockedSlot {
  id        String   @id @default(cuid())
  doctorId  String
  date      DateTime @db.Date
  startTime String   // "10:00"
  endTime   String   // "11:00"

  createdAt DateTime @default(now())

  // Relations
  doctor Doctor @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@map("blocked_slots")
}

// ─────────────────────────────────────────
// ADMIN SCHEDULE (global booking availability)
// ─────────────────────────────────────────

// Single source of truth for what patients can book. Admin-controlled.
model AdminSchedule {
  id              String  @id @default(cuid())
  dayOfWeek       Int     // 0 = Sunday, 6 = Saturday
  startTime       String  // "09:00"
  endTime         String  // "17:00"
  sessionDuration Int     // minutes: 30, 45, or 60
  isActive        Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([dayOfWeek])
  @@map("admin_schedules")
}

// ─────────────────────────────────────────
// GLOBAL BLOCKED DATE (admin-controlled date blocks)
// ─────────────────────────────────────────

model GlobalBlockedDate {
  id     String  @id @default(cuid())
  date   DateTime @db.Date
  reason String?

  createdAt DateTime @default(now())

  @@unique([date])
  @@map("global_blocked_dates")
}

// ─────────────────────────────────────────
// BOOKING
// ─────────────────────────────────────────

model Booking {
  id          String        @id @default(cuid())
  userId      String
  doctorId    String?
  date        DateTime      @db.Date
  startTime   String        // "10:00"
  endTime     String        // "11:00"
  service     String
  status      BookingStatus @default(PENDING)
  sessionType SessionType   @default(ONLINE)
  notes       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user        User         @relation("PatientBookings", fields: [userId], references: [id], onDelete: Cascade)
  doctor      Doctor?      @relation("DoctorBookings", fields: [doctorId], references: [id], onDelete: SetNull)
  payment     Payment?
  sessionRoom SessionRoom?
  doctorNotes DoctorNote[]

  @@map("bookings")
}

// ─────────────────────────────────────────
// DOCTOR NOTE (doctor-authored session notes; Booking.notes left untouched)
// ─────────────────────────────────────────

model DoctorNote {
  id        String   @id @default(cuid())
  content   String
  bookingId String
  doctorId  String
  booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  doctor    Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([bookingId, doctorId])
  @@map("doctor_notes")
}

// ─────────────────────────────────────────
// PAYMENT
// ─────────────────────────────────────────

model Payment {
  id               String        @id @default(cuid())
  bookingId        String        @unique
  amount           Decimal       @db.Decimal(10, 2)
  currency         String        @default("EGP")
  status           PaymentStatus @default(PENDING)
  gatewayReference String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@map("payments")
}

// ─────────────────────────────────────────
// SESSION ROOM (Jitsi)
// ─────────────────────────────────────────

model SessionRoom {
  id        String   @id @default(cuid())
  bookingId String   @unique
  roomName  String   @unique // Jitsi room name — used to construct the meeting URL
  expiresAt DateTime

  createdAt DateTime @default(now())

  // Relations
  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@map("session_rooms")
}

// ─────────────────────────────────────────
// SETTINGS (singleton)
// ─────────────────────────────────────────

model Settings {
  id String @id @default("singleton")

  platformName   String @default("Tawasul Academy")
  contactEmail   String @default("")
  contactPhone   String @default("")
  whatsappNumber String @default("")

  paymentGateway       String  @default("paymob") // "paymob" or "stripe"
  paymentGatewayKey    String  @default("")
  paymentGatewaySecret String  @default("")

  sessionPricePerHour    Decimal @default(0) @db.Decimal(10, 2)
  defaultSessionDuration Int     @default(60) // minutes
  defaultWorkingStart    String  @default("09:00")
  defaultWorkingEnd      String  @default("17:00")

  // Jitsi config
  jitsiDomain String @default("meet.jit.si") // use meet.jit.si for MVP, self-hosted later

  updatedAt DateTime @updatedAt

  @@map("settings")
}
```

## 3. Session-related files

### `modules/patient/server/api/patient/session/[bookingId].get.ts`

```ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { canJoinMeetingAt, meetingWindow } from '~/server/utils/meeting'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['PATIENT'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { sessionRoom: true },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  if (booking.userId !== auth.userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  if (booking.status !== 'CONFIRMED') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  if (booking.sessionType === 'IN_CLINIC') {
    throw createError({ statusCode: 400, message: 'This is an in-clinic session.' })
  }

  const now = Date.now()
  if (!canJoinMeetingAt(booking, now)) {
    throw createError({ statusCode: 403, message: 'Session is not available at this time' })
  }

  const jitsiDomain = (await getJitsiDomain()) || 'meet.jit.si'

  let room = booking.sessionRoom
  if (!room) {
    const { closeAt } = meetingWindow(booking)
    const expiresAt = new Date(closeAt)
    const roomName = `tawasul-${bookingId}`
    room = await prisma.sessionRoom.upsert({
      where: { bookingId },
      create: { bookingId, roomName, expiresAt },
      update: {},
    })
  }

  return { roomName: room.roomName, jitsiDomain }
})

async function getJitsiDomain(): Promise<string> {
  const setting = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  return (setting?.jitsiDomain ?? process.env.JITSI_DOMAIN) || 'meet.jit.si'
}
```

### `modules/doctor/server/api/doctor/session/[bookingId].get.ts`

```ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { canJoinMeetingAt, meetingWindow } from '~/server/utils/meeting'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['DOCTOR'])

  const bookingId = getRouterParam(event, 'bookingId')
  if (!bookingId) {
    throw createError({ statusCode: 400, message: 'Booking ID is required' })
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: auth.userId } })
  if (!doctor) {
    throw createError({ statusCode: 404, message: 'Doctor profile not found' })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { sessionRoom: true },
  })

  if (!booking) {
    throw createError({ statusCode: 404, message: 'Booking not found' })
  }

  if (booking.doctorId !== doctor.id) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  if (booking.status !== 'CONFIRMED') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const now = Date.now()
  if (!canJoinMeetingAt(booking, now)) {
    throw createError({ statusCode: 403, message: 'Session is not available' })
  }

  const setting = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const jitsiDomain = (setting?.jitsiDomain ?? process.env.JITSI_DOMAIN) || 'meet.jit.si'

  let room = booking.sessionRoom
  if (!room) {
    const { closeAt } = meetingWindow(booking)
    const expiresAt = new Date(closeAt)
    const roomName = `tawasul-${bookingId}`
    room = await prisma.sessionRoom.upsert({
      where: { bookingId },
      create: { bookingId, roomName, expiresAt },
      update: {},
    })
  }

  return { roomName: room.roomName, jitsiDomain }
})
```

### `pages/dashboard/session/[bookingId].vue`

```vue
<script setup lang="ts">
import type { SessionRoomResponse } from '~/modules/patient/composables/types'
import { LogOut, Video } from 'lucide-vue-next'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')
const { user } = useAuth()

const { toast } = useToast()

const status = ref<'loading' | 'lobby' | 'waiting' | 'ready' | 'error'>('loading')
const message = ref('')
const session = ref<SessionRoomResponse | null>(null)
const leaveDialogOpen = ref(false)
const leaveDialogShown = ref(false)

let jitsiApi: { dispose: () => void } | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null
let lobbyTimer: ReturnType<typeof setTimeout> | null = null

async function checkSession() {
  if (status.value === 'ready' || status.value === 'lobby') return
  try {
    const data = await $fetch<SessionRoomResponse>(`/api/patient/session/${bookingId}`)
    session.value = data
    // Lobby waiting room: show immediately, connect to Jitsi after 3 seconds.
    // Jitsi handles the native "waiting for host" state once connected.
    status.value = 'lobby'
    stopPolling()
    if (lobbyTimer) clearTimeout(lobbyTimer)
    lobbyTimer = setTimeout(() => {
      if (status.value !== 'lobby') return
      status.value = 'ready'
      window.setTimeout(() => initJitsi(data), 0)
    }, 3000)
  } catch (e) {
    const msg = (e as { data?: { message?: string } }).data?.message || 'Something went wrong'
    if (msg.includes('not available at this time')) {
      status.value = 'waiting'
      message.value = msg
    } else {
      status.value = 'error'
      message.value = msg
      stopPolling()
    }
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

function leaveLobby() {
  if (lobbyTimer) {
    clearTimeout(lobbyTimer)
    lobbyTimer = null
  }
  stopPolling()
  navigateTo('/dashboard/appointments')
}

function loadJitsiScript(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI) {
      resolve((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI)
      return
    }
    const existing = document.querySelector('script[data-jitsi]')
    if (existing) {
      existing.addEventListener('load', () => resolve((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://meet.jit.si/external_api.js'
    script.async = true
    script.dataset.jitsi = 'true'
    script.onload = () => resolve((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI)
    script.onerror = () => reject(new Error('Failed to load Jitsi'))
    document.head.appendChild(script)
  })
}

async function initJitsi(data: SessionRoomResponse) {
  const container = document.getElementById('jitsi-container')
  if (!container) return
  try {
    await loadJitsiScript()
    const JitsiMeetExternalAPI = (window as unknown as Record<string, unknown>).JitsiMeetExternalAPI as new (
      domain: string,
      options: Record<string, unknown>,
    ) => { dispose: () => void }
    jitsiApi = new JitsiMeetExternalAPI(data.jitsiDomain, {
      roomName: data.roomName,
      width: '100%',
      height: '100%',
      parentNode: container,
      userInfo: { displayName: user?.name || 'Patient' },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: true,
        startWithVideoMuted: true,
      },
    })
  } catch {
    status.value = 'error'
    message.value = 'Could not load the video session. Please try again.'
  }
}

function openLeaveDialog() {
  leaveDialogShown.value = true
  leaveDialogOpen.value = true
}

function leaveSession() {
  if (jitsiApi) {
    jitsiApi.dispose()
    jitsiApi = null
  }
  stopPolling()
  navigateTo('/dashboard/appointments')
}

onMounted(() => {
  checkSession()
  pollTimer = setInterval(checkSession, 30 * 1000)
})

onBeforeUnmount(() => {
  if (lobbyTimer) {
    clearTimeout(lobbyTimer)
    lobbyTimer = null
  }
  stopPolling()
  if (jitsiApi) {
    jitsiApi.dispose()
    jitsiApi = null
  }
})
</script>

<template>
  <div>
    <div v-if="status === 'loading'" class="flex flex-col gap-4">
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-96 w-full" />
    </div>

    <div v-else-if="status === 'lobby'" class="flex flex-col items-center justify-center rounded-2xl border border-border p-10 text-center" data-testid="session-lobby" style="background: linear-gradient(180deg, #FCE4F3 0%, #FFFFFF 100%)">
      <Avatar class="size-16 shrink-0">
        <AvatarImage :src="user?.photo || undefined" :alt="user?.name || 'Patient'" />
        <AvatarFallback class="text-xl">{{ (user?.name || 'P').slice(0, 1).toUpperCase() }}</AvatarFallback>
      </Avatar>
      <h2 class="mt-4 text-xl font-semibold text-foreground">Welcome, {{ user?.name || 'there' }}</h2>
      <p class="mt-2 text-sm text-muted-foreground">Please wait while we connect you with your doctor.</p>
      <div class="mt-4 flex items-center gap-1.5" aria-hidden="true">
        <span class="lobby-dot size-2.5 rounded-full bg-primary"></span>
        <span class="lobby-dot size-2.5 rounded-full bg-primary"></span>
        <span class="lobby-dot size-2.5 rounded-full bg-primary"></span>
      </div>
      <p class="mt-4 text-xs text-muted-foreground">The doctor will admit you when they are ready.</p>
      <Button variant="outline" class="mt-6" data-testid="leave-lobby" @click="leaveLobby">
        Leave Lobby
      </Button>
    </div>

    <div v-else-if="status === 'waiting'" class="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center" data-testid="session-waiting">
      <Video class="size-12 text-primary" />
      <h2 class="mt-4 text-xl font-semibold text-foreground">Your session starts soon</h2>
      <p class="mt-2 text-sm text-muted-foreground">This page will refresh automatically when your session is ready to join.</p>
      <p class="mt-4 text-xs text-muted-foreground">{{ message }}</p>
    </div>

    <div v-else-if="status === 'error'" class="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center" data-testid="session-error">
      <h2 class="text-xl font-semibold text-destructive">Session unavailable</h2>
      <p class="mt-2 text-sm text-muted-foreground">{{ message }}</p>
    </div>

    <div v-else class="relative flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div class="absolute right-4 top-4 z-10">
        <Button variant="destructive" data-testid="leave-session" @click="openLeaveDialog">
          <LogOut class="size-4" />
          Leave Session
        </Button>
      </div>
      <div id="jitsi-container" class="h-full w-full" data-testid="jitsi-container" />
    </div>

    <Teleport to="body">
      <Dialog v-model:open="leaveDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave session?</DialogTitle>
            <DialogDescription>You will be disconnected from the video session and returned to your appointments.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" data-testid="leave-cancel" @click="leaveDialogOpen = false">
              Stay
            </Button>
            <Button variant="destructive" data-testid="leave-confirm" @click="leaveSession">
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>

<style>
.lobby-dot {
  animation: lobby-pulse 1.2s ease-in-out infinite;
}
.lobby-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.lobby-dot:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes lobby-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1); }
}
</style>
```

### `modules/doctor/pages/doctor/session/[bookingId].vue`

```vue
<script setup lang="ts">
import { LogOut, Video } from 'lucide-vue-next'

definePageMeta({
  layout: 'doctor-layout',
  middleware: ['auth', 'doctor-only'],
})

interface DoctorSessionResponse {
  roomName: string
  jitsiDomain: string
}

const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')
const { user } = useAuth()

const status = ref<'loading' | 'waiting' | 'ready' | 'error'>('loading')
const message = ref('')
const session = ref<DoctorSessionResponse | null>(null)
const leaveDialogOpen = ref(false)

let jitsiApi: { dispose: () => void } | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

async function checkSession() {
  if (status.value === 'ready') return
  try {
    const data = await $fetch<DoctorSessionResponse>(`/api/doctor/session/${bookingId}`)
    session.value = data
    status.value = 'ready'
    stopPolling()
    window.setTimeout(() => initJitsi(data), 0)
  } catch (e) {
    const msg = (e as { data?: { message?: string } }).data?.message || 'Something went wrong'
    if (msg.includes('Session is not available')) {
      status.value = 'waiting'
      message.value = msg
    } else {
      status.value = 'error'
      message.value = msg
      stopPolling()
    }
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function loadJitsiScript(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI) {
      resolve((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI)
      return
    }
    const existing = document.querySelector('script[data-jitsi]')
    if (existing) {
      existing.addEventListener('load', () => resolve((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://meet.jit.si/external_api.js'
    script.async = true
    script.dataset.jitsi = 'true'
    script.onload = () => resolve((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI)
    script.onerror = () => reject(new Error('Failed to load Jitsi'))
    document.head.appendChild(script)
  })
}

async function initJitsi(data: DoctorSessionResponse) {
  const container = document.getElementById('jitsi-container')
  if (!container) return
  try {
    await loadJitsiScript()
    const JitsiMeetExternalAPI = (window as unknown as Record<string, unknown>).JitsiMeetExternalAPI as new (
      domain: string,
      options: Record<string, unknown>,
    ) => { dispose: () => void }
    jitsiApi = new JitsiMeetExternalAPI(data.jitsiDomain, {
      roomName: data.roomName,
      width: '100%',
      height: '100%',
      parentNode: container,
      userInfo: { displayName: user?.name || 'Doctor' },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: true,
        startWithVideoMuted: true,
      },
    })
  } catch {
    status.value = 'error'
    message.value = 'Could not load the video session. Please try again.'
  }
}

function leaveSession() {
  if (jitsiApi) {
    jitsiApi.dispose()
    jitsiApi = null
  }
  stopPolling()
  navigateTo('/doctor/calendar')
}

onMounted(() => {
  checkSession()
  pollTimer = setInterval(checkSession, 30 * 1000)
})

onBeforeUnmount(() => {
  stopPolling()
  if (jitsiApi) {
    jitsiApi.dispose()
    jitsiApi = null
  }
})
</script>

<template>
  <div>
    <div v-if="status === 'loading'" class="flex flex-col gap-4">
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-96 w-full" />
    </div>

    <div v-else-if="status === 'waiting'" class="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center" data-testid="session-waiting">
      <Video class="size-12 text-primary" />
      <h2 class="mt-4 text-xl font-semibold text-foreground">Your session starts soon</h2>
      <p class="mt-2 text-sm text-muted-foreground">This page will refresh automatically when your session is ready to join.</p>
      <p class="mt-4 text-xs text-muted-foreground">{{ message }}</p>
    </div>

    <div v-else-if="status === 'error'" class="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center" data-testid="session-error">
      <h2 class="text-xl font-semibold text-destructive">Session unavailable</h2>
      <p class="mt-2 text-sm text-muted-foreground">{{ message }}</p>
    </div>

    <div v-else class="relative flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div class="absolute right-4 top-4 z-10">
        <Button variant="destructive" data-testid="leave-session" @click="leaveDialogOpen = true">
          <LogOut class="size-4" />
          Leave Session
        </Button>
      </div>
      <div id="jitsi-container" class="h-full w-full" data-testid="jitsi-container" />
    </div>

    <Teleport to="body">
      <Dialog v-model:open="leaveDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave session?</DialogTitle>
            <DialogDescription>You will be disconnected from the video session and returned to your calendar.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" data-testid="leave-cancel" @click="leaveDialogOpen = false">
              Stay
            </Button>
            <Button variant="destructive" data-testid="leave-confirm" @click="leaveSession">
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>
```

## 4. Config

### `nuxt.config.ts`

```ts
// Tawasul Academy — Nuxt Configuration

import { readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

interface ModulePage {
  name: string
  path: string
  file: string
}

function registerModulePages(pages: ModulePage[], dir: string, moduleName: string, prefix = ''): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue
      registerModulePages(pages, resolve(dir, entry.name), moduleName, `${prefix}${entry.name}/`)
      continue
    }
    if (!entry.name.endsWith('.vue')) continue
    const base = entry.name.replace(/\.vue$/, '')
    if (base.startsWith('_')) continue
    const routePath = `/${prefix}${base}`.replace(/\[(\w+)\]/g, ':$1')
    pages.push({
      name: `${moduleName}-${prefix.replace(/\//g, '-')}${base}`,
      path: routePath,
      file: resolve(dir, entry.name),
    })
  }
}

export default defineNuxtConfig({

  // ─────────────────────────────────────────
  // General
  // ─────────────────────────────────────────
  devtools: { enabled: process.env.NODE_ENV === 'development' },
  ssr: true,

  // ─────────────────────────────────────────
  // TypeScript
  // ─────────────────────────────────────────
  typescript: {
    strict: true,
    typeCheck: false, // enable after initial setup to avoid slowing down dev
  },

  // ─────────────────────────────────────────
  // Runtime Config
  // All server-only secrets go under "private"
  // Anything the frontend needs goes under the root
  // ─────────────────────────────────────────
  runtimeConfig: {
    // Server-only (never exposed to the browser)
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
    resendFromName: process.env.RESEND_FROM_NAME || 'Tawasul Academy',
    databaseUrl: process.env.DATABASE_URL,
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '2097152'),
    paymentGateway: process.env.PAYMENT_GATEWAY || 'paymob',
    paymobApiKey: process.env.PAYMOB_API_KEY,
    paymobIntegrationId: process.env.PAYMOB_INTEGRATION_ID,
    paymobHmacSecret: process.env.PAYMOB_HMAC_SECRET,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    jitsiAppId: process.env.JITSI_APP_ID,
    jitsiAppSecret: process.env.JITSI_APP_SECRET,
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL,
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
    seedAdminName: process.env.SEED_ADMIN_NAME,

    // Public (safe to expose to the browser)
    public: {
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      jitsiDomain: process.env.JITSI_DOMAIN || 'meet.jit.si',
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    },
  },

  // ─────────────────────────────────────────
  // Modules
  // ─────────────────────────────────────────
  // UI library: shadcn-vue components in ./components/ui, auto-imported via shadcn-nuxt.
  // NOTE: original plan referenced @heroui/nuxt which does not exist for Vue — see phase-0/notes.md
  // NOTE: 'shadcn-vue/nuxt' does not exist in shadcn-vue v2 (CLI-only package);
  // the official Nuxt module is the separate 'shadcn-nuxt' package.
  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@nuxt/image',
    'shadcn-nuxt',
  ],
  shadcn: {
    prefix: '',
    componentDir: './components/ui',
  },

  // ─────────────────────────────────────────
  // Tailwind CSS
  // @nuxtjs/tailwindcss defaults are used:
  // cssPath = ~/assets/css/tailwind.css, configPath = tailwind.config.ts
  // ─────────────────────────────────────────

  // ─────────────────────────────────────────
  // Pages & Routing
  // Module-based page directories registered here
  // ─────────────────────────────────────────
  hooks: {
    'pages:extend'(pages) {
      // Register pages kept inside module directories (modules/*/pages/)
      // Each module page file maps to a flat URL from its filename.
      for (const moduleName of readdirSync(resolve(process.cwd(), 'modules'))) {
        const pagesDir = resolve(process.cwd(), 'modules', moduleName, 'pages')
        if (!existsSync(pagesDir)) continue
        registerModulePages(pages, pagesDir, moduleName)
      }
    },
  },

  dir: {
    pages: 'pages',
  },

  // Register module page dirs as additional page sources
  // Each module exposes its pages through the global pages dir via symlink or re-export
  // Alternatively, use Nuxt Layers for full module isolation

  // ─────────────────────────────────────────
  // Server (Nitro)
  // Module server directories are registered by each module's index.ts
  // via addServerScanDir (see modules/*/index.ts).
  // ─────────────────────────────────────────

  // ─────────────────────────────────────────
  // Components
  // Auto-import components from module component dirs
  // ─────────────────────────────────────────
  components: [
    { path: '~/components', pathPrefix: false },
    { path: '~/modules/auth/components', pathPrefix: false },
    { path: '~/modules/booking/components', pathPrefix: false },
    { path: '~/modules/payment/components', pathPrefix: false },
    { path: '~/modules/patient/components', pathPrefix: false },
    { path: '~/modules/doctor/components', pathPrefix: false },
    { path: '~/modules/admin/components', pathPrefix: false },
    { path: '~/modules/session/components', pathPrefix: false },
  ],

  // ─────────────────────────────────────────
  // Composables
  // Auto-import composables from module composable dirs
  // ─────────────────────────────────────────
  imports: {
    dirs: [
      'composables',
      'modules/auth/composables',
      'modules/booking/composables',
      'modules/payment/composables',
      'modules/patient/composables',
      'modules/doctor/composables',
      'modules/admin/composables',
      'modules/session/composables',
    ],
  },

  // ─────────────────────────────────────────
  // CSS
  // ─────────────────────────────────────────
  css: [
    '~/assets/css/main.css',
  ],

  // ─────────────────────────────────────────
  // Image
  // ─────────────────────────────────────────
  image: {
    dir: 'public',
    quality: 80,
    format: ['webp', 'jpg'],
  },

  // ─────────────────────────────────────────
  // App Head
  // ─────────────────────────────────────────
  app: {
    head: {
      title: 'Tawasul Academy',
      titleTemplate: '%s | Tawasul Academy',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Online mental health counseling platform' },
        { name: 'theme-color', content: '#E91E8C' },
      ],
      script: [
        {
          innerHTML: `(function(){try{var m=localStorage.getItem('tawasul-color-mode')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
        },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
        },
      ],
    },
  },

  // ─────────────────────────────────────────
  // Compatibility
  // ─────────────────────────────────────────
  compatibilityDate: '2024-11-01',
})
```
