<script setup lang="ts">
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  EyeOff,
  Mail,
  Phone,
  Stethoscope,
  UserX,
} from 'lucide-vue-next'
import DoctorSessionNote from '~/components/doctor/session-note.vue'

definePageMeta({
  layout: 'doctor-layout',
  middleware: ['auth', 'doctor-only'],
})

interface SessionNote {
  id: string
  content: string
  updatedAt: string
}

interface PatientSession {
  bookingId: string
  doctorId?: string
  date: string
  startTime: string
  endTime: string
  service: string
  sessionType: string
  status: string
  note: SessionNote | null
}

interface PatientDetail {
  id: string
  name: string
  email: string
  phone: string | null
  photo: string | null
}

interface PeerNoteItem {
  id: string
  content: string
  bookingId: string
  doctorName: string
  createdAt: string
  isOwn: boolean
}

const route = useRoute()
const userId = computed(() => String(route.params.userId || ''))

const patient = ref<PatientDetail | null>(null)
const sessions = ref<PatientSession[]>([])
const allNotes = ref<PeerNoteItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const peerNotes = computed(() => allNotes.value.filter((n) => !n.isOwn))

// Own Doctor.id is not exposed by GET /api/doctor/profile (it returns the
// User.id), so currentDoctorId stays null unless a Doctor.id source exists.
// null = unknown → fall back to own (the sessions endpoint only returns
// this doctor's sessions via its server-side doctorId filter).
const currentDoctorId = ref<string | null>(null)
const { profile, fetchProfile } = useDoctorDashboard()

// Per-session ownership: a card carrying another doctor's id renders the
// peer read-only branch; cards without a doctorId are own sessions.
function isOwnSession(s: PatientSession): boolean {
  if (!s.doctorId) return true
  return currentDoctorId.value !== null && s.doctorId === currentDoctorId.value
}

async function fetchDetail() {
  loading.value = true
  error.value = null
  try {
    if (!profile.value) await fetchProfile()
    const res = await $fetch<{ user: PatientDetail; sessions: PatientSession[] }>(
      `/api/doctor/patients/${userId.value}`,
    )
    patient.value = res.user
    sessions.value = res.sessions ?? []
    try {
      const notesRes = await $fetch<{ notes: PeerNoteItem[] }>(
        `/api/doctor/patients/${userId.value}/notes`,
      )
      allNotes.value = notesRes.notes ?? []
    } catch {
      allNotes.value = []
    }
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || 'Could not load patient profile'
    patient.value = null
    sessions.value = []
  } finally {
    loading.value = false
  }
}

function formatDate(value: string | Date): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(time: string): string {
  if (!time) return ''
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = (hh || 0) >= 12 ? 'PM' : 'AM'
  const hour = (hh || 0) % 12 === 0 ? 12 : (hh || 0) % 12
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`
}

function statusVariant(status: string): 'success' | 'pending' | 'cancelled' {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'PENDING') return 'pending'
  return 'cancelled'
}

function goBack() {
  navigateTo('/doctor/patients')
}

onMounted(() => {
  void fetchDetail()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1360px] p-4 md:p-8">
    <!-- Back link -->
    <button
      type="button"
      class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
      data-testid="back-to-patients"
      @click="goBack"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Back to patients
    </button>

    <!-- Error state -->
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <!-- Loading Skeletons -->
    <div v-if="loading" class="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Skeleton class="h-72 w-full rounded-2xl" />
      <div class="grid gap-4">
        <Skeleton v-for="i in 3" :key="i" class="h-40 w-full rounded-2xl" />
      </div>
    </div>

    <div v-else-if="patient" class="mt-6 grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <!-- LEFT COLUMN — Patient info panel -->
      <Card class="overflow-hidden rounded-2xl border border-border shadow-soft">
        <CardContent class="p-6">
          <div class="flex flex-col items-center text-center">
            <img
              v-if="patient.photo"
              :src="patient.photo"
              :alt="patient.name"
              class="size-20 rounded-full object-cover border-2 border-border/60 shadow-xs"
            />
            <div
              v-else
              class="flex size-20 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-2xl font-bold border-2 border-border/40 shadow-xs"
            >
              {{ patient.name.slice(0, 1).toUpperCase() }}
            </div>
            <h1 class="mt-4 text-xl font-bold text-foreground" data-testid="patient-name">
              {{ patient.name }}
            </h1>
            <div class="mt-3">
              <Badge variant="default" class="gap-1.5" data-testid="total-sessions-badge">
                <CalendarDays class="size-3.5" aria-hidden="true" />
                {{ sessions.length }} session{{ sessions.length === 1 ? '' : 's' }}
              </Badge>
            </div>
          </div>

          <div class="my-5 border-t border-border/80" />

          <div class="space-y-2.5 text-sm text-muted-foreground">
            <div class="flex items-center gap-2.5">
              <Mail class="size-4 shrink-0 text-muted-foreground/80" aria-hidden="true" />
              <span class="truncate">{{ patient.email }}</span>
            </div>
            <div class="flex items-center gap-2.5">
              <Phone class="size-4 shrink-0 text-muted-foreground/80" aria-hidden="true" />
              <span class="truncate">{{ patient.phone || 'No phone' }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- RIGHT COLUMN — Session timeline -->
      <div class="min-w-0">
      <section v-if="peerNotes.length > 0" aria-label="Notes from other doctors" class="mb-6">
        <h2 class="text-sm font-semibold text-foreground">
          Notes from other doctors
        </h2>
        <p class="mt-0.5 text-xs text-muted-foreground">Visible to assigned doctors and admin only.</p>

        <div class="mt-4 grid gap-3">
          <Card
            v-for="n in peerNotes"
            :key="n.id"
            class="overflow-hidden rounded-xl border border-border/60 bg-muted/20 shadow-soft"
            :data-testid="`peer-note-${n.id}`"
          >
            <CardContent class="p-4">
              <p class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <EyeOff class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                Dr. {{ n.doctorName }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ formatDate(n.createdAt) }}</p>
              <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{{ n.content }}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <div class="mb-6 border-t border-border/40" />

      <section aria-label="Session timeline">
        <h2 class="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Session timeline
        </h2>

        <div v-if="sessions.length === 0" class="mt-4 flex flex-col items-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft">
          <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserX class="size-7" aria-hidden="true" />
          </div>
          <p class="mt-4 text-sm font-semibold text-foreground">No sessions with this patient yet</p>
        </div>

        <div v-else class="mt-4 grid gap-4">
          <Card
            v-for="s in sessions"
            :key="s.bookingId"
            class="overflow-hidden rounded-2xl border border-border shadow-soft"
            :data-testid="`session-card-${s.bookingId}`"
          >
            <CardContent class="p-5">
              <!-- Session details -->
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-bold text-foreground">{{ formatDate(s.date) }}</p>
                  <p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock class="size-3.5 shrink-0" aria-hidden="true" />
                    <span class="tabular-nums">{{ formatTime(s.startTime) }} – {{ formatTime(s.endTime) }}</span>
                  </p>
                  <p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Stethoscope class="size-3.5 shrink-0" aria-hidden="true" />
                    {{ s.service }}
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <Badge variant="default">
                    {{ s.sessionType === 'IN_CLINIC' ? 'In-Clinic' : 'Online' }}
                  </Badge>
                  <Badge :variant="statusVariant(s.status)">
                    {{ s.status === 'CONFIRMED' ? 'Confirmed' : s.status === 'PENDING' ? 'Pending' : 'Cancelled' }}
                  </Badge>
                </div>
              </div>

              <div class="my-4 border-t border-border/60" />

              <!-- Session note -->
              <DoctorSessionNote
                :booking-id="s.bookingId"
                :patient-user-id="userId"
                :is-own-session="isOwnSession(s)"
              />
            </CardContent>
          </Card>
        </div>
      </section>
      </div>
    </div>
  </div>
</template>
