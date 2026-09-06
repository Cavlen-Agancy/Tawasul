<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-vue-next'
import type { AdminBooking } from '~/modules/admin/composables/types'

definePageMeta({ layout: 'admin', middleware: 'staff-only' })

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

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

const bookingEvents = computed(() =>
  bookings.value.map((b) => ({
    id: b.id,
    title: `${b.patientName} — ${b.doctorName || 'Unassigned'}`,
    start: `${b.date}T${b.startTime}`,
    end: `${b.date}T${b.endTime}`,
    display: 'block',
    classNames: [`fc-tawasul-event-${statusColorKey(b.status)}`],
    extendedProps: { status: b.status },
  })),
)

const eventIndex = computed<EventMap>(() =>
  bookings.value.reduce((acc, b) => {
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

async function onDatesSet(info: { view: { currentStart: Date } }) {
  const start = info.view.currentStart
  currentMonth.value = start.getMonth() + 1
  currentYear.value = start.getFullYear()
}

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

            <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1.5">
                <span class="size-2.5 rounded-full bg-green-600"></span>
                Confirmed
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="size-2.5 rounded-full bg-red-600"></span>
                Pending
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="size-2.5 rounded-full bg-slate-400"></span>
                Cancelled / Completed
              </span>
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