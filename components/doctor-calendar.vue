<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { DatesSetArg, EventClickArg, EventContentArg, DayCellContentArg } from '@fullcalendar/core'
import type { DoctorBooking } from '~/modules/doctor/composables/useDoctorDashboard'

definePageMeta({
  layout: 'doctor-layout',
  middleware: ['auth', 'doctor-only'],
})

const { bookings, error, fetchBookings } = useDoctorDashboard()

const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<{
  id: string
  patientName: string
  patientEmail: string
  date: string
  startTime: string
  endTime: string
  service: string
  status: string
  paymentStatus: string | null
} | null>(null)

const now = ref(Date.now())
let datesSetTimer: ReturnType<typeof setTimeout> | null = null

type MainView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
const currentView = ref<MainView>('dayGridMonth')
const anchorDate = ref(new Date())
const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)
const calendarKey = ref(0)

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayStr(): string {
  return toISODate(new Date())
}

function isPastStr(dateStr: string): boolean {
  return dateStr < todayStr()
}

function parseDateTime(dateISO: string, time: string): Date {
  const [y, m, d] = dateISO.split('-').map((v) => parseInt(v, 10))
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  return new Date(y, (m || 1) - 1, d, hh || 0, mm || 0, 0, 0)
}

function formatTime(time: string): string {
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = (hh || 0) >= 12 ? 'PM' : 'AM'
  const hour = (hh || 0) % 12 === 0 ? 12 : (hh || 0) % 12
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`
}

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function canJoinBooking(b: { date: string; startTime: string; endTime: string }): boolean {
  const t = now.value
  const open = parseDateTime(b.date, b.startTime).getTime() - 5 * 60 * 1000
  const close = parseDateTime(b.date, b.endTime).getTime() + 15 * 60 * 1000
  return t >= open && t <= close
}

const headerLabel = computed(() => {
  const d = anchorDate.value
  if (currentView.value === 'dayGridMonth') {
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  if (currentView.value === 'timeGridWeek') {
    const start = new Date(d)
    const day = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - day)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)} ${end.getFullYear()}`
  }
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

const calendarEvents = computed(() =>
  bookings.value.map((b: DoctorBooking) => ({
    id: b.id,
    title: `${formatTime(b.startTime)} · ${b.patientName}`,
    start: `${b.date}T${b.startTime}`,
    end: `${b.date}T${b.endTime}`,
    classNames: [b.status === 'CANCELLED' ? 'fc-tawasul-event-cancelled' : 'fc-tawasul-event-confirmed'],
    extendedProps: { bookingId: b.id },
  })),
)

// ⚠️ Chip wrapper classes copied from patient-calendar.vue; doctor title/color inputs preserved.
function renderEventContent(arg: EventContentArg) {
  const el = arg.event
  const isCancelled = el.classNames.includes('fc-tawasul-event-cancelled')
  const dotBg = isCancelled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'
  const strike = isCancelled ? 'line-through opacity-60' : ''
  if (arg.view.type === 'dayGridMonth') {
    return {
      html: `
        <div class="fc-chip flex items-center gap-1.5 px-2 py-0.5 rounded text-xs truncate w-full cursor-pointer ${strike}">
          <span class="size-2 rounded-full shrink-0" style="background-color: ${dotBg}"></span>
          <span class="font-medium truncate text-foreground">${el.title}</span>
        </div>
      `,
    }
  }
  return {
    html: `
      <div class="fc-chip h-full w-full p-2 flex flex-col justify-between overflow-hidden leading-snug cursor-pointer ${strike}">
        <div class="min-w-0">
          <div class="font-bold text-xs text-foreground truncate">${el.title}</div>
        </div>
        <div class="flex items-center justify-between text-[10px] opacity-75 font-mono mt-1">
          <span>${formatTime(el.startStr.slice(11, 16))}</span>
        </div>
      </div>
    `,
  }
}

// ⚠️ Visual-only day-cell marker (past-day tint); doctor fetch logic untouched.
function dayCellClass(info: DayCellContentArg): string[] {
  const dateStr = toISODate(info.date)
  if (isPastStr(dateStr)) return ['fc-past', 'bg-white/[0.02]']
  return []
}

function calendarApi() {
  return (calendarRef.value as unknown as { getApi?: () => { prev: () => void; next: () => void; today: () => void; gotoDate: (d: string) => void; changeView: (v: string) => void; getDate: () => Date } } | null)?.getApi?.() ?? null
}

// ⚠️ Adds view/anchor sync for the patient-style header; debounced doctor fetch range preserved.
function onDatesSet(info: DatesSetArg) {
  anchorDate.value = info.view.calendar.getDate()
  if (currentView.value !== (info.view.type as MainView)) {
    currentView.value = (info.view.type as MainView)
  }
  if (datesSetTimer) clearTimeout(datesSetTimer)
  datesSetTimer = setTimeout(() => {
    const start = toISODate(info.view.activeStart)
    const end = toISODate(info.view.activeEnd)
    void fetchBookings(start, end)
  }, 100)
}

// ⚠️ New: patient-style header controls wired to the existing FullCalendar instance.
function changeView(view: MainView) {
  currentView.value = view
  calendarApi()?.changeView(view)
}

function onNav(dir: number) {
  if (dir === 0) {
    goToday()
    return
  }
  if (dir < 0) calendarApi()?.prev()
  else calendarApi()?.next()
}

function goToday() {
  anchorDate.value = new Date()
  calendarApi()?.today()
}

// Month view "+N more" click behavior (same as patient-calendar.vue).
function handleMoreLinkClick(info: { date: Date }) {
  const dateStr = toISODate(info.date)
  anchorDate.value = info.date
  changeView('timeGridDay')
  calendarApi()?.gotoDate(dateStr)
  return 'none'
}

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: currentView.value,
  headerToolbar: false,
  allDaySlot: false,
  slotMinTime: '07:00:00',
  slotMaxTime: '21:00:00',
  slotDuration: '00:30:00',
  expandRows: true,
  stickyHeaderDates: true,
  height: 'auto',
  nowIndicator: true,
  dayMaxEvents: 3,
  moreLinkClick: handleMoreLinkClick,
  firstDay: 6,
  weekends: true,
  events: calendarEvents.value,
  eventContent: renderEventContent,
  dayCellClassNames: dayCellClass,
  datesSet: onDatesSet,
  eventClick: onEventClick,
}))

async function onEventClick(info: EventClickArg) {
  const bookingId = (info.event.extendedProps as { bookingId?: string }).bookingId || info.event.id
  detail.value = null
  detailLoading.value = true
  detailOpen.value = true
  try {
    detail.value = await $fetch(`/api/doctor/bookings/${bookingId}`)
  } catch {
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

function joinSession() {
  if (!detail.value) return
  navigateTo(`/doctor/session/${detail.value.id}`)
}

onMounted(() => {
  const t = new Date()
  const start = toISODate(new Date(t.getFullYear(), t.getMonth(), 1))
  const end = toISODate(new Date(t.getFullYear(), t.getMonth() + 1, 0))
  void fetchBookings(start, end)
  window.setInterval(() => {
    now.value = Date.now()
  }, 60 * 1000)
})

onBeforeUnmount(() => {
  if (datesSetTimer) clearTimeout(datesSetTimer)
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1200px]">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-balance text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
          My Calendar
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">Your sessions, all in one calendar.</p>
      </div>
    </div>
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div class="mt-6">
      <section class="flex min-w-0 flex-1 flex-col">
        <Card class="flex flex-1 flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-5 shadow-soft overflow-hidden">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div class="flex flex-wrap items-center gap-2 sm:gap-3">
              <div class="flex items-center rounded-xl border border-border bg-background p-0.5 shadow-soft">
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                  aria-label="Previous"
                  data-testid="cal-prev"
                  @click="onNav(-1)"
                >
                  <ChevronLeft class="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:text-primary active:scale-95"
                  data-testid="calendar-today"
                  @click="goToday"
                >
                  Today
                </button>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                  aria-label="Next"
                  data-testid="cal-next"
                  @click="onNav(1)"
                >
                  <ChevronRight class="size-4" aria-hidden="true" />
                </button>
              </div>

              <div class="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarIcon class="size-4 text-primary" aria-hidden="true" />
                <span data-testid="calendar-label">{{ headerLabel }}</span>
              </div>
            </div>

            <div class="flex items-center rounded-xl border border-border bg-background p-0.5 shadow-soft">
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                :class="currentView === 'dayGridMonth'
                  ? 'bg-primary text-primary-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'"
                data-testid="view-monthly"
                :aria-pressed="currentView === 'dayGridMonth'"
                @click="changeView('dayGridMonth')"
              >
                Monthly
              </button>
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                :class="currentView === 'timeGridWeek'
                  ? 'bg-primary text-primary-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'"
                data-testid="view-weekly"
                :aria-pressed="currentView === 'timeGridWeek'"
                @click="changeView('timeGridWeek')"
              >
                Weekly
              </button>
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                :class="currentView === 'timeGridDay'
                  ? 'bg-primary text-primary-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'"
                data-testid="view-daily"
                :aria-pressed="currentView === 'timeGridDay'"
                @click="changeView('timeGridDay')"
              >
                Daily
              </button>
            </div>
          </div>

          <ClientOnly>
            <FullCalendar :key="calendarKey" ref="calendarRef" :options="calendarOptions" />
            <template #fallback>
              <div class="py-10 text-center text-sm text-muted-foreground">Loading calendar schedule…</div>
            </template>
          </ClientOnly>

          <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground" data-testid="calendar-legend">
            <span class="font-semibold text-foreground/80">Status:</span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-primary" />
              <span>Confirmed</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-muted-foreground" />
              <span>Cancelled</span>
            </span>
          </div>
        </Card>
      </section>
    </div>

    <Teleport to="body">
      <Dialog v-model:open="detailOpen">
        <DialogContent class="max-w-md" data-testid="booking-dialog">
          <DialogHeader>
            <DialogTitle>Booking details</DialogTitle>
          </DialogHeader>
          <div v-if="detailLoading" class="grid gap-2">
            <Skeleton v-for="i in 4" :key="i" class="h-10 w-full" />
          </div>
          <dl v-else-if="detail" class="grid gap-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Patient</dt>
              <dd class="font-medium text-foreground">{{ detail.patientName }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Date</dt>
              <dd class="font-medium text-foreground">{{ formatDateLabel(detail.date) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Time</dt>
              <dd class="font-medium text-foreground">{{ formatTime(detail.startTime) }} – {{ formatTime(detail.endTime) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Service</dt>
              <dd class="font-medium text-foreground">{{ detail.service }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted-foreground">Status</dt>
              <dd><Badge>{{ detail.status }}</Badge></dd>
            </div>
          </dl>
          <p v-else class="text-sm text-muted-foreground">Could not load booking details.</p>
          <DialogFooter>
            <Button variant="outline" @click="detailOpen = false">Close</Button>
            <Button
              v-if="detail"
              data-testid="join-session"
              :disabled="!canJoinBooking(detail)"
              :title="detail && !canJoinBooking(detail) ? 'Available 5 minutes before your session' : undefined"
              @click="joinSession"
            >
              Join Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>

<style>
/* FullCalendar styling matching patient calendar */
.fc {
  font-family: inherit;
  --fc-border-color: hsl(var(--border) / 0.8);
  --fc-button-text-color: hsl(var(--foreground));
  --fc-button-bg-color: transparent;
  --fc-button-border-color: transparent;
  --fc-today-bg-color: hsl(var(--primary) / 0.04);
}
.fc-theme-standard td,
.fc-theme-standard th {
  border-color: hsl(var(--border) / 0.8) !important;
}
.fc .fc-col-header-cell-cushion {
  padding-top: 10px !important;
  padding-bottom: 10px !important;
  font-weight: 600;
  font-size: 0.825rem;
  color: hsl(var(--foreground));
  text-decoration: none !important;
}
.fc .fc-daygrid-day-frame {
  min-height: 5.5rem;
  padding: 2px;
}
.fc .fc-daygrid-day-top {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  position: relative;
  padding: 6px 8px 0;
}
.fc .fc-daygrid-day-number {
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  text-decoration: none !important;
  padding: 2px 4px;
}
.fc .fc-daygrid-day.fc-day-today {
  background-color: hsl(var(--primary) / 0.04) !important;
}
.fc .fc-timegrid-col.fc-day-today {
  background-color: hsl(var(--primary) / 0.04) !important;
}
.fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
  font-weight: 700 !important;
  color: hsl(var(--primary)) !important;
}
.fc .fc-daygrid-day.fc-day-other .fc-daygrid-day-number {
  color: hsl(var(--muted-foreground) / 0.5) !important;
}
.fc .fc-timegrid-slot {
  height: 2.5rem;
}
.fc .fc-timegrid-col-events {
  margin: 0 2px;
}
.fc .fc-timegrid-slot-label-cushion {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.fc .fc-timegrid-axis-cushion {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}
.fc .fc-timegrid-now-indicator-line {
  border-color: hsl(var(--primary)) !important;
  border-width: 2px !important;
}
.fc .fc-timegrid-now-indicator-arrow {
  border-color: hsl(var(--primary)) !important;
}
.fc .fc-daygrid-more-link {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  color: hsl(var(--primary)) !important;
  text-decoration: none !important;
  padding: 2px 4px;
}
.fc .fc-daygrid-more-link:hover {
  text-decoration: underline !important;
}

/* Doctor status colors (doctor-specific logic preserved; tokens only) */
.fc-tawasul-event-confirmed {
  background-color: hsl(var(--primary)) !important;
  border-color: hsl(var(--primary)) !important;
}
.fc-tawasul-event-cancelled {
  background-color: hsl(var(--muted-foreground)) !important;
  border-color: hsl(var(--muted-foreground)) !important;
  opacity: 0.6;
}

.fc-past {
  background-color: rgba(255, 255, 255, 0.02) !important;
}
.fc-past .fc-daygrid-day-frame {
  background-color: rgba(255, 255, 255, 0.02) !important;
}
.fc-chip {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  padding: 1px 4px;
  border-radius: 6px;
}
@media (max-width: 640px) {
  .fc .fc-daygrid-day-number {
    font-size: 0.75rem;
    padding: 2px;
  }
  .fc .fc-toolbar-title {
    font-size: 1rem;
  }
}
</style>
