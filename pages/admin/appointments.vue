<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Filter,
} from 'lucide-vue-next'
import type { AdminBooking } from '~/modules/admin/composables/types'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'APPOINTMENTS', action: 'READ' },
})

interface EventMap {
  [key: string]: AdminBooking
}

const {
  bookings,
  pendingBookings,
  activeDoctors,
  loading,
  error,
  fetchAll,
  fetchActiveDoctors,
  fetchPendingBookings,
  fetchBookings,
  assignDoctor,
  cancelBooking,
} = useAdminDashboard()
const { toast } = useToast()
const { hasPermission } = useAuth()

const canAssign = computed(() => hasPermission('APPOINTMENTS', 'UPDATE'))
const canDelete = computed(() => hasPermission('APPOINTMENTS', 'DELETE'))

const activeTab = ref('calendar')
const calendarKey = ref(0)
const currentMonth = ref(new Date().getMonth() + 1)
const currentYear = ref(new Date().getFullYear())

const assignTarget = ref<AdminBooking | null>(null)
const assignDialogOpen = ref(false)
const selectedDoctorId = ref<string>('')
const assigning = ref(false)

const detailTarget = ref<AdminBooking | null>(null)
const detailOpen = ref(false)
const cancelling = ref(false)

// Doctor filter & color coding
const selectedDoctorFilter = ref<string>('')
const selectedStatusFilter = ref<string>('')
const hasActiveFilters = computed(() => !!selectedDoctorFilter.value || !!selectedStatusFilter.value)

function clearFilters() {
  selectedDoctorFilter.value = ''
  selectedStatusFilter.value = ''
}

const DOCTOR_PALETTE = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2']

const doctorColorMap = computed(() => {
  const map = new Map<string, string>()
  activeDoctors.value.forEach((d, idx) => {
    map.set(d.id, DOCTOR_PALETTE[idx % DOCTOR_PALETTE.length])
  })
  return map
})

function getDoctorColor(doctorId: string | null): string {
  if (!doctorId) return '#64748B'
  return doctorColorMap.value.get(doctorId) || '#475569'
}

const isRTL = computed(() => typeof document !== 'undefined' && document.documentElement.dir === 'rtl')

function statusColorKey(status: string): string {
  switch (status) {
    case 'CANCELLED':
      return 'cancelled'
    case 'PENDING':
      return 'pending'
    case 'CONFIRMED':
      return 'confirmed'
    default:
      return 'completed'
  }
}

const filteredBookings = computed(() =>
  bookings.value.filter((b) => {
    if (selectedDoctorFilter.value && b.doctorId !== selectedDoctorFilter.value) {
      return false
    }
    if (selectedStatusFilter.value && b.status !== selectedStatusFilter.value) {
      return false
    }
    return true
  }),
)

const bookingEvents = computed(() =>
  filteredBookings.value.map((b) => {
    const docColor = getDoctorColor(b.doctorId)
    const isCancelled = b.status === 'CANCELLED'
    const isPending = b.status === 'PENDING'

    return {
      id: b.id,
      title: isCancelled
        ? `[Cancelled] ${b.patientName} — ${b.doctorName || 'Unassigned'}`
        : isPending
          ? `[Pending] ${b.patientName} — ${b.doctorName || 'Unassigned'}`
          : `${b.patientName} — ${b.doctorName || 'Unassigned'}`,
      start: `${b.date}T${b.startTime}`,
      end: `${b.date}T${b.endTime}`,
      display: 'block',
      backgroundColor: isCancelled ? '#94a3b8' : isPending ? '#dc2626' : docColor,
      borderColor: isCancelled ? '#64748b' : isPending ? '#b91c1c' : docColor,
      textColor: '#FFFFFF',
      classNames: [
        `fc-tawasul-event-${statusColorKey(b.status)}`,
        isCancelled ? 'opacity-60 line-through' : '',
      ].filter(Boolean),
      extendedProps: {
        status: b.status,
        doctorId: b.doctorId,
        doctorColor: docColor,
      },
    }
  }),
)

const eventIndex = computed<EventMap>(() =>
  filteredBookings.value.reduce((acc, b) => {
    acc[b.id] = b
    return acc
  }, {} as EventMap),
)

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  initialDate: new Date(currentYear.value, currentMonth.value - 1, 1),
  headerToolbar: false,
  height: 'auto',
  firstDay: 0,
  direction: isRTL.value ? 'rtl' : 'ltr',
  events: bookingEvents.value,
  eventClick: (info: { event: { id: string } }) => {
    const booking = eventIndex.value[info.event.id]
    if (booking) void openDetail(booking)
  },
}))

async function onMonthChange(dir: number) {
  const d = new Date(currentYear.value, currentMonth.value - 1 + dir, 1)
  currentMonth.value = d.getMonth() + 1
  currentYear.value = d.getFullYear()
  calendarKey.value += 1
}

function formatMonthLabel(): string {
  return new Date(currentYear.value, currentMonth.value - 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(time: string): string {
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = hh >= 12 ? 'PM' : 'AM'
  const hour = hh % 12 === 0 ? 12 : hh % 12
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`
}

function formatDateTime(dateISO: string, time: string): string {
  const d = new Date(`${dateISO}T00:00:00`)
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatTime(time)}`
}

async function openAssign(booking: AdminBooking) {
  assignTarget.value = booking
  selectedDoctorId.value = ''
  assignDialogOpen.value = true
  await fetchActiveDoctors()
}

async function openDetail(booking: AdminBooking) {
  detailTarget.value = booking
  selectedDoctorId.value = ''
  detailOpen.value = true
  if (booking.status === 'PENDING' && canAssign.value) {
    await fetchActiveDoctors()
  }
}

async function confirmCancel() {
  if (!detailTarget.value) return
  cancelling.value = true
  try {
    const ok = await cancelBooking(detailTarget.value.id)
    if (ok) {
      toast({ title: 'Booking cancelled', variant: 'success' })
      detailOpen.value = false
      detailTarget.value = null
      await Promise.all([fetchPendingBookings(), fetchBookings()])
    }
  } catch {
    toast({ title: 'Could not cancel booking', variant: 'destructive' })
  } finally {
    cancelling.value = false
  }
}

async function confirmAssign() {
  if (!assignTarget.value || !selectedDoctorId.value) return
  assigning.value = true
  try {
    const ok = await assignDoctor(assignTarget.value.id, selectedDoctorId.value)
    if (ok) {
      toast({ title: 'Doctor assigned', variant: 'success' })
      assignDialogOpen.value = false
      assignTarget.value = null
      await Promise.all([fetchPendingBookings(), fetchBookings()])
    }
  } catch {
    toast({ title: 'Could not assign doctor', variant: 'destructive' })
  } finally {
    assigning.value = false
  }
}

async function confirmDetailAssign() {
  if (!detailTarget.value || !selectedDoctorId.value) return
  assignTarget.value = detailTarget.value
  await confirmAssign()
  detailOpen.value = false
  detailTarget.value = null
}

onMounted(() => {
  void fetchAll()
  void fetchActiveDoctors()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
        Appointments
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">Master schedule and pending bookings.</p>
    </div>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <Tabs v-model="activeTab" class="mt-6 w-full" data-testid="appointments-tabs">
      <TabsList>
        <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
        <TabsTrigger value="pending" data-testid="tab-pending">Pending Bookings</TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" class="mt-4">
        <!-- Filter Bar -->
        <Card class="mb-4">
          <CardContent class="flex flex-wrap items-center justify-between gap-3 p-4">
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-2">
                <Filter class="size-4 text-muted-foreground" />
                <span class="text-xs font-medium text-muted-foreground">Filter:</span>
              </div>

              <!-- Doctor dropdown filter -->
              <select
                id="filter-doctor"
                v-model="selectedDoctorFilter"
                data-testid="calendar-doctor-filter"
                aria-label="Filter by doctor"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">All Doctors</option>
                <option v-for="doctor in activeDoctors" :key="doctor.id" :value="doctor.id">
                  {{ doctor.name }}
                </option>
              </select>

              <!-- Status dropdown filter -->
              <select
                id="filter-status"
                v-model="selectedStatusFilter"
                data-testid="calendar-status-filter"
                aria-label="Filter by status"
                class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <!-- Clear button -->
              <Button
                v-if="hasActiveFilters"
                variant="ghost"
                size="sm"
                data-testid="calendar-clear-filters"
                @click="clearFilters"
              >
                Clear filters
              </Button>
            </div>

            <p class="text-xs text-muted-foreground">
              Showing {{ filteredBookings.length }} of {{ bookings.length }} appointments
            </p>
          </CardContent>
        </Card>

        <Card class="w-full overflow-hidden">
          <CardContent class="p-3 sm:p-5">
            <div class="mb-3 flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" aria-label="Previous month" @click="onMonthChange(-1)">
                <ChevronLeft class="size-5 rtl:rotate-180" />
              </Button>

              <div class="flex items-center gap-2 text-base font-semibold text-foreground">
                <CalendarIcon class="size-4 text-primary" />
                <span data-testid="calendar-month">{{ formatMonthLabel() }}</span>
              </div>

              <Button variant="ghost" size="sm" aria-label="Next month" @click="onMonthChange(1)">
                <ChevronRight class="size-5 rtl:rotate-180" />
              </Button>
            </div>

            <ClientOnly>
              <FullCalendar :key="calendarKey" :options="calendarOptions" />
              <template #fallback>
                <div class="py-10 text-center text-sm text-muted-foreground">Loading calendar…</div>
              </template>
            </ClientOnly>

            <p
              v-if="filteredBookings.length === 0 && hasActiveFilters"
              class="mt-4 rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground"
              data-testid="calendar-empty-filter"
            >
              No appointments found for the selected filter criteria.
            </p>

            <!-- Color Palette & Status Legend -->
            <div class="mt-6 border-t border-border pt-4 space-y-3">
              <!-- Doctor color legend -->
              <div v-if="activeDoctors.length > 0" class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <span class="font-medium text-muted-foreground">Doctors:</span>
                <span
                  v-for="doc in activeDoctors"
                  :key="doc.id"
                  class="inline-flex items-center gap-1.5"
                  :data-testid="`legend-doctor-${doc.id}`"
                >
                  <span
                    class="size-3 rounded-full"
                    :style="{ backgroundColor: getDoctorColor(doc.id) }"
                  ></span>
                  <span :class="{ 'font-semibold': selectedDoctorFilter === doc.id }">{{ doc.name }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span class="size-3 rounded-full bg-slate-500"></span>
                  Unassigned
                </span>
              </div>

              <!-- Status legend -->
              <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span class="font-medium">Status:</span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2.5 rounded-full bg-primary"></span>
                  Confirmed (Doctor color)
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2.5 rounded-full bg-red-600"></span>
                  Pending
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="size-2.5 rounded-full bg-slate-400"></span>
                  Cancelled (Faded / Strikethrough)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pending" class="mt-4">
        <Card class="w-full overflow-hidden">
          <CardContent class="p-0">
            <div v-if="loading" class="grid gap-2 p-4">
              <Skeleton v-for="i in 4" :key="i" class="h-16 w-full" />
            </div>
            <p
              v-else-if="pendingBookings.length === 0"
              class="px-4 py-10 text-center text-sm text-muted-foreground"
              data-testid="no-pending-bookings"
            >
              No pending bookings to review.
            </p>
            <div v-else class="divide-y divide-border">
              <div
                v-for="booking in pendingBookings"
                :key="booking.id"
                class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-foreground" data-testid="patient-name">
                    {{ booking.patientName }}
                  </p>
                  <p class="truncate text-sm text-muted-foreground" data-testid="booking-time">
                    {{ formatDateTime(booking.date, booking.startTime) }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">{{ booking.patientEmail }}</p>
                </div>
                <div class="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    :data-testid="`assign-${booking.id}`"
                    @click="openAssign(booking)"
                  >
                    <UserCheck class="size-4" />
                    Assign Doctor
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    <Teleport to="body">
      <Dialog v-model:open="assignDialogOpen">
        <DialogContent class="max-w-md" data-testid="assign-dialog">
          <DialogHeader>
            <DialogTitle>Assign Doctor</DialogTitle>
            <DialogDescription v-if="assignTarget">
              {{ assignTarget.patientName }} · {{ formatDateTime(assignTarget.date, assignTarget.startTime) }}
            </DialogDescription>
          </DialogHeader>

          <div v-if="assigning && activeDoctors.length === 0" class="text-sm text-muted-foreground">
            Loading doctors…
          </div>

          <div v-else-if="activeDoctors.length === 0" class="text-sm text-muted-foreground">
            No active doctors available. Add doctors before assigning bookings.
          </div>

          <div v-else>
            <label class="mb-1.5 block text-sm font-medium text-foreground" for="doctor-select">
              Choose a doctor
            </label>
            <select
              id="doctor-select"
              v-model="selectedDoctorId"
              class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              data-testid="assign-doctor-select"
            >
              <option value="" disabled>Select a doctor…</option>
              <option v-for="doctor in activeDoctors" :key="doctor.id" :value="doctor.id">
                {{ doctor.name }}
              </option>
            </select>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="assignDialogOpen = false">Cancel</Button>
            <Button :disabled="!selectedDoctorId || assigning" data-testid="assign-confirm" @click="confirmAssign">
              {{ assigning ? 'Assigning…' : 'Assign' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>

    <Teleport to="body">
      <Dialog v-model:open="detailOpen">
        <DialogContent class="max-w-md" data-testid="booking-detail-dialog">
          <DialogHeader>
            <DialogTitle>Booking details</DialogTitle>
            <DialogDescription v-if="detailTarget">
              {{ detailTarget.patientName }} · {{ formatDateTime(detailTarget.date, detailTarget.startTime) }}
            </DialogDescription>
          </DialogHeader>

          <dl v-if="detailTarget" class="grid gap-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Patient</dt>
              <dd class="font-medium text-foreground">{{ detailTarget.patientName }} ({{ detailTarget.patientEmail }})</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Doctor</dt>
              <dd class="font-medium text-foreground">{{ detailTarget.doctorName || 'Unassigned' }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Service</dt>
              <dd class="font-medium text-foreground">{{ detailTarget.service }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Status</dt>
              <dd><Badge>{{ detailTarget.status }}</Badge></dd>
            </div>
          </dl>

          <div v-if="detailTarget?.status === 'PENDING' && canAssign">
            <label class="mb-1.5 block text-sm font-medium text-foreground" for="detail-doctor-select">
              Assign a doctor
            </label>
            <div class="flex gap-2">
              <select
                id="detail-doctor-select"
                v-model="selectedDoctorId"
                class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                data-testid="detail-assign-doctor-select"
              >
                <option value="" disabled>Select a doctor…</option>
                <option v-for="doctor in activeDoctors" :key="doctor.id" :value="doctor.id">
                  {{ doctor.name }}
                </option>
              </select>
              <Button
                :disabled="!selectedDoctorId || assigning"
                data-testid="detail-assign-confirm"
                @click="confirmDetailAssign"
              >
                {{ assigning ? 'Assigning…' : 'Assign' }}
              </Button>
            </div>
          </div>

          <DialogFooter class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" @click="detailOpen = false">Close</Button>
            <Button
              v-if="detailTarget && detailTarget.status !== 'CANCELLED' && canDelete"
              variant="destructive"
              :disabled="cancelling"
              data-testid="cancel-booking"
              @click="confirmCancel"
            >
              {{ cancelling ? 'Cancelling…' : 'Cancel Booking' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>