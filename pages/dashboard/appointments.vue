<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  Calendar as CalendarIcon,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next'
import type { DateClickArg, DatesSetArg, DayCellContentArg, EventClickArg } from '@fullcalendar/core'
import type { Appointment, BookingStatus } from '~/modules/patient/composables/types'
import type { Slot } from '~/modules/booking/composables/types'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

interface HolidayInfo {
  date: string
  name: string
}

const { upcomingAppointments, pastAppointments, error, fetchAllAppointments, cancelAppointment } =
  usePatientDashboard()
const { availableDates, fetchAvailableDates, fetchAvailableSlots, selectSlot } = useBooking()
const { toast } = useToast()

const holidays = ref<HolidayInfo[]>([])
const calendarKey = ref(0)
const currentMonth = ref(new Date().getMonth() + 1)
const currentYear = ref(new Date().getFullYear())
const now = ref(new Date())

// Booking dialog state
const bookingDialogOpen = ref(false)
const dialogSlots = ref<Slot[]>([])
const dialogLoading = ref(false)
const selectedISO = ref<string | null>(null)
const selectedSlot = ref<Slot | null>(null)

// Cancel dialog state
const cancelTarget = ref<Appointment | null>(null)
const cancelDialogOpen = ref(false)
const cancelling = ref(false)

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const isRTL = computed(() => typeof document !== 'undefined' && document.documentElement.dir === 'rtl')

async function loadMonth(month: number, year: number, remount = false) {
  await Promise.all([
    fetchAvailableDates(month, year),
    $fetch<{ holidays: HolidayInfo[] }>('/api/booking/holidays', { query: { month, year } }).then(
      (d) => (holidays.value = d.holidays ?? []),
      () => (holidays.value = []),
    ),
  ])
  if (remount) calendarKey.value += 1
}

async function onDatesSet(info: DatesSetArg) {
  const start = info.view.currentStart
  currentMonth.value = start.getMonth() + 1
  currentYear.value = start.getFullYear()
  await loadMonth(currentMonth.value, currentYear.value)
}

function holidayFor(dateStr: string): HolidayInfo | undefined {
  return holidays.value.find((h) => h.date === dateStr)
}

function isHolidayStr(dateStr: string): boolean {
  return Boolean(holidayFor(dateStr))
}

function isPastDate(date: Date): boolean {
  const today = new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate())
  return date.getTime() < today.getTime()
}

function dayCellClass(info: DayCellContentArg): string[] {
  const dateStr = toISODate(info.date)
  const classes: string[] = []
  if (isHolidayStr(dateStr)) classes.push('fc-tawasul-holiday')
  if (isPastDate(info.date)) classes.push('fc-tawasul-past')
  const available = availableDates.value.includes(dateStr)
  classes.push(available ? 'fc-tawasul-available' : 'fc-tawasul-unavailable')
  return classes
}

const allAppointments = computed<Appointment[]>(() => {
  const all = [...upcomingAppointments.value, ...pastAppointments.value]
  const seen = new Set<string>()
  return all.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
})

const appointmentEvents = computed(() =>
  allAppointments.value.map((a) => ({
    id: a.id,
    title: a.service,
    start: `${a.date}T${a.startTime}`,
    allDay: false,
    display: 'list-item',
    classNames: [`fc-tawasul-event-${a.id}`, `fc-tawasul-event-${statusColorKey(a.status, a.date, a.endTime)}`],
    extendedProps: { status: a.status },
  })),
)

const holidayEvents = computed(() =>
  holidays.value.map((h) => ({
    id: `holiday-${h.date}`,
    title: h.name,
    start: h.date,
    allDay: true,
    display: 'background',
    classNames: ['fc-tawasul-holiday-event'],
    extendedProps: { holiday: h.name },
  })),
)

function statusColorKey(status: BookingStatus, date: string, endTime: string): string {
  if (status === 'CANCELLED') return 'cancelled'
  if (status === 'PENDING') return 'pending'
  const isPast = parseBookingDateTime(date, endTime).getTime() < now.value.getTime()
  return isPast ? 'completed' : 'confirmed'
}

async function onMonthChange(dir: number) {
  const d = new Date(currentYear.value, currentMonth.value - 1 + dir, 1)
  currentMonth.value = d.getMonth() + 1
  currentYear.value = d.getFullYear()
  await loadMonth(currentMonth.value, currentYear.value, true)
}

function goToday() {
  const t = new Date()
  currentMonth.value = t.getMonth() + 1
  currentYear.value = t.getFullYear()
  void loadMonth(currentMonth.value, currentYear.value, true)
}

function onEventClick(info: EventClickArg) {
  const appt = allAppointments.value.find((a) => a.id === info.event.id)
  // Only route to the Lobby for joinable sessions; leave cancelled ones inert.
  if (appt && appt.status !== 'CANCELLED') {
    navigateTo(`/meeting/${appt.id}/lobby`)
  }
}

async function onDateClick(info: DateClickArg) {
  const dateStr = toISODate(info.date)
  if (isPastDate(info.date)) return
  if (isHolidayStr(dateStr)) {
    toast({ title: `Closed for ${holidayFor(dateStr)?.name}`, variant: 'info' })
    return
  }
  if (!availableDates.value.includes(dateStr)) return

  selectedISO.value = dateStr
  selectedSlot.value = null
  dialogSlots.value = []
  bookingDialogOpen.value = true
  dialogLoading.value = true
  try {
    dialogSlots.value = await fetchAvailableSlots(dateStr)
  } finally {
    dialogLoading.value = false
  }
}

function parseBookingDateTime(dateISO: string, time: string): Date {
  const [y, m, d] = dateISO.split('-').map((v) => parseInt(v, 10))
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0)
}

function isPastSlot(slot: Slot): boolean {
  if (!selectedISO.value) return false
  return parseBookingDateTime(selectedISO.value, slot.startTime).getTime() < now.value.getTime()
}

function formatTime(time: string): string {
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = hh >= 12 ? 'PM' : 'AM'
  const hour = hh % 12 === 0 ? 12 : hh % 12
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMonthLabel(): string {
  return new Date(currentYear.value, currentMonth.value - 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

function confirmBook() {
  if (!selectedISO.value || !selectedSlot.value) return
  selectSlot(selectedISO.value, selectedSlot.value)
  bookingDialogOpen.value = false
  navigateTo('/book')
}

function sessionStart(appt: Appointment): Date {
  return parseBookingDateTime(appt.date, appt.startTime)
}

function sessionEnd(appt: Appointment): Date {
  return parseBookingDateTime(appt.date, appt.endTime)
}

function windowOpen(appt: Appointment): Date {
  return new Date(sessionStart(appt).getTime() - 5 * 60 * 1000)
}

function windowClose(appt: Appointment): Date {
  return new Date(sessionEnd(appt).getTime() + 15 * 60 * 1000)
}

function canJoin(appt: Appointment): boolean {
  const t = now.value.getTime()
  return t >= windowOpen(appt).getTime() && t <= windowClose(appt).getTime()
}

function canCancel(appt: Appointment): boolean {
  return now.value.getTime() < sessionStart(appt).getTime() - 24 * 60 * 60 * 1000
}

function openCancelDialog(appt: Appointment) {
  cancelTarget.value = appt
  cancelDialogOpen.value = true
}

async function confirmCancel() {
  if (!cancelTarget.value) return
  cancelling.value = true
  try {
    await cancelAppointment(cancelTarget.value.id)
    toast({ title: 'Appointment cancelled', variant: 'success' })
    cancelDialogOpen.value = false
    cancelTarget.value = null
    void fetchAllAppointments()
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not cancel appointment',
      variant: 'destructive',
    })
  } finally {
    cancelling.value = false
  }
}

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  initialDate: new Date(currentYear.value, currentMonth.value - 1, 1),
  headerToolbar: false,
  height: 'auto',
  firstDay: 0,
  direction: isRTL.value ? 'rtl' : 'ltr',
  events: [...appointmentEvents.value, ...holidayEvents.value],
  dayCellClassNames: dayCellClass,
  dateClick: onDateClick,
  eventClick: onEventClick,
  datesSet: onDatesSet,
  eventContent: (arg: { event: { extendedProps: Record<string, unknown>; title: string } }) => {
    const status = arg.event.extendedProps.status as BookingStatus | undefined
    if (!status) return { html: '' }
    const dot = document.createElement('span')
    dot.className = `fc-tawasul-dot fc-tawasul-dot-${String(status).toLowerCase()}`
    return { domNodes: [dot, document.createTextNode(arg.event.title)] }
  },
}))

onMounted(async () => {
  now.value = new Date()
  await Promise.all([fetchAllAppointments(), loadMonth(currentMonth.value, currentYear.value)])
  window.setInterval(() => {
    now.value = new Date()
  }, 60 * 1000)
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px]">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
          My Appointments
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">Pick an available day below to book a session.</p>
      </div>
      <Button as="a" href="/book" variant="secondary" data-testid="book-session-button" class="shrink-0">
        <CalendarX2 class="size-4" />
        Book a Session
      </Button>
    </div>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <Card class="mt-6 w-full overflow-hidden">
      <CardContent class="p-3 sm:p-5">
        <div class="mb-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" aria-label="Previous month" @click="onMonthChange(-1)">
            <ChevronLeft class="size-5 rtl:rotate-180" />
          </Button>

          <div class="flex items-center gap-2 text-base font-semibold text-foreground">
            <CalendarIcon class="size-4 text-primary" />
            <span data-testid="calendar-month">{{ formatMonthLabel() }}</span>
          </div>

          <div class="flex items-center gap-1">
            <Button variant="ghost" size="sm" data-testid="calendar-today" @click="goToday">Today</Button>
            <Button variant="ghost" size="sm" aria-label="Next month" @click="onMonthChange(1)">
              <ChevronRight class="size-5 rtl:rotate-180" />
            </Button>
          </div>
        </div>

        <ClientOnly>
          <FullCalendar :key="calendarKey" :options="calendarOptions" />
          <template #fallback>
            <div class="py-10 text-center text-sm text-muted-foreground">Loading calendar…</div>
          </template>
        </ClientOnly>

        <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span class="inline-flex items-center gap-1.5">
            <span class="size-3 rounded-sm border border-border bg-white"></span>
            Available day
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="size-3 rounded-sm bg-slate-100"></span>
            Unavailable day
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-green-600"></span>
            Confirmed
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-red-600"></span>
            Awaiting review
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-slate-400"></span>
            Cancelled
          </span>
        </div>
      </CardContent>
    </Card>

    <Teleport to="body">
      <Dialog v-model:open="bookingDialogOpen">
        <DialogContent class="max-w-md overflow-hidden" data-testid="booking-dialog">
          <DialogHeader>
            <DialogTitle>Book a session</DialogTitle>
            <DialogDescription
              v-if="selectedISO"
              class="text-base font-medium text-foreground"
              data-testid="booking-dialog-date"
            >
              {{ formatDateLabel(selectedISO) }}
            </DialogDescription>
          </DialogHeader>

          <div class="max-h-[50vh] overflow-y-auto pr-1">
            <div v-if="dialogLoading" class="grid gap-2">
              <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
            </div>

            <p
              v-else-if="dialogSlots.length === 0"
              class="rounded-xl border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground"
              data-testid="dialog-no-slots"
            >
              No available times on this day.
            </p>

            <div v-else class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Button
                v-for="slot in dialogSlots"
                :key="`${slot.doctorId}-${slot.startTime}`"
                variant="outline"
                :disabled="isPastSlot(slot)"
                :data-slot-time="slot.startTime"
                :class="selectedSlot?.startTime === slot.startTime ? 'border-primary bg-primary/10 text-primary' : ''"
                @click="selectedSlot = slot"
              >
                {{ formatTime(slot.startTime) }}
              </Button>
            </div>

            <p
              v-if="dialogSlots.length > 0"
              class="mt-3 text-xs text-muted-foreground"
              data-testid="dialog-doctor-label"
            >
              {{ dialogSlots[0]?.doctorName }} · {{ dialogSlots[0]?.service }}
            </p>
          </div>

          <DialogFooter class="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" class="w-full sm:w-auto" @click="bookingDialogOpen = false">Cancel</Button>
            <Button
              class="w-full sm:flex-1"
              :disabled="!selectedSlot"
              data-testid="book-appointment"
              @click="confirmBook"
            >
              Book Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>

    <Teleport to="body">
      <Dialog v-model:open="cancelDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel appointment?</DialogTitle>
            <DialogDescription>
              This will cancel your appointment and refund your payment. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" data-testid="cancel-dialog-cancel" @click="cancelDialogOpen = false">
              Keep appointment
            </Button>
            <Button variant="destructive" data-testid="cancel-dialog-confirm" :disabled="cancelling" @click="confirmCancel">
              {{ cancelling ? 'Cancelling…' : 'Confirm cancellation' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>

<style>
.fc-tawasul-available .fc-daygrid-day-number {
  color: #e91e8c;
  font-weight: 600;
}
/* Available days keep the normal calendar background — only the day number is
   tinted with the brand colour as the "bookable" affordance. */
.fc-tawasul-available.fc-day .fc-daygrid-day-frame {
  cursor: pointer;
}
/* Unavailable days get a very light gray fill — subtle, not dominant. */
.fc .fc-daygrid-day.fc-tawasul-unavailable:not(.fc-tawasul-holiday) .fc-daygrid-day-frame {
  background-color: rgba(226, 232, 240, 0.4);
}
.fc-tawasul-unavailable:not(.fc-tawasul-available),
.fc .fc-daygrid-day.fc-tawasul-unavailable:not(.fc-tawasul-available) .fc-daygrid-day-number {
  color: #c4c4c4;
}
.fc .fc-daygrid-day.fc-tawasul-unavailable:not(.fc-tawasul-available) {
  opacity: 1;
}
.fc .fc-daygrid-day.fc-tawasul-unavailable:not(.fc-tawasul-available):not(.fc-tawasul-past) {
  cursor: not-allowed;
}
.fc-tawasul-past,
.fc .fc-daygrid-day.fc-tawasul-past {
  pointer-events: none;
}
.fc .fc-daygrid-day.fc-tawasul-holiday .fc-daygrid-day-frame {
  background: repeating-linear-gradient(
    -45deg,
    rgba(245, 158, 11, 0.06),
    rgba(245, 158, 11, 0.06) 5px,
    rgba(245, 158, 11, 0.12) 5px,
    rgba(245, 158, 11, 0.12) 10px
  );
}
.fc .fc-daygrid-day.fc-tawasul-holiday .fc-daygrid-day-number {
  color: #d97706;
  font-weight: 600;
}
.fc-tawasul-holiday-event {
  background-color: transparent !important;
  border: none !important;
}
.fc .fc-daygrid-body-unbalanced .fc-daygrid-day-events {
  min-height: 0;
}
.fc-tawasul-event-confirmed,
.fc-tawasul-event-completed {
  background-color: #16a34a;
  border-color: #16a34a;
}
/* PENDING = awaiting admin review (IN_REVIEW) → red */
.fc-tawasul-event-pending {
  background-color: #dc2626;
  border-color: #dc2626;
}
.fc-tawasul-event-cancelled {
  background-color: #94a3b8;
  border-color: #94a3b8;
}
.fc .fc-daygrid-event {
  transition: filter 0.15s ease;
}
.fc .fc-daygrid-event:hover {
  filter: brightness(0.95);
}
.fc-tawasul-dot {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  margin-inline-end: 0.25rem;
  border-radius: 9999px;
  vertical-align: middle;
}
.fc-tawasul-dot-cancelled,
.fc-tawasul-dot-completed {
  background-color: #94a3b8;
}
.fc-tawasul-dot-pending {
  background-color: #dc2626;
}
.fc-tawasul-dot-confirmed {
  background-color: #16a34a;
}
.fc .fc-daygrid-event {
  font-size: 0.7rem;
  cursor: pointer;
}
@media (max-width: 640px) {
  .fc .fc-daygrid-day-number {
    font-size: 0.75rem;
    padding: 2px;
  }
  .fc .fc-daygrid-event {
    font-size: 0.6rem;
    margin: 0 1px;
    padding: 0 2px;
  }
  .fc .fc-col-header-cell {
    font-size: 0.7rem;
  }
  .fc .fc-daygrid-more-link {
    font-size: 0.6rem;
  }
}
</style>