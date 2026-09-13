<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DatesSetArg, DayCellContentArg, EventClickArg, EventContentArg } from '@fullcalendar/core'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  Video,
  X,
  Filter,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-vue-next'
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
  patientPhoto?: string | null
  date: string
  startTime: string
  endTime: string
  service: string
  status: string
  paymentStatus: string | null
} | null>(null)

const now = ref(Date.now())

// Calendar instance reference
const mainCalendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)
const calendarKey = ref(0)

// Active view: default to 'timeGridWeek' (Weekly), matching admin
type CalendarViewType = 'timeGridWeek' | 'timeGridDay' | 'dayGridMonth'
const currentView = ref<CalendarViewType>('timeGridWeek')
const headerTitle = ref('')

// Selected date on calendar / mini-calendar
const selectedDate = ref<string>(new Date().toISOString().slice(0, 10))

// Left sidebar drawer on mobile / tablet
const mobileSidebarOpen = ref(false)

// Status filter (client-side; the doctor endpoint only takes a date range)
const selectedStatusFilter = ref('')
const hasActiveFilters = computed(() => !!selectedStatusFilter.value)

function clearFilters() {
  selectedStatusFilter.value = ''
}

// Visible range for bookings fetch
let currentRangeStart = ''
let currentRangeEnd = ''
let datesSetTimer: ReturnType<typeof setTimeout> | null = null

async function refetchForCurrentRange() {
  if (!currentRangeStart || !currentRangeEnd) return
  await fetchBookings(currentRangeStart, currentRangeEnd)
}

// Mini Calendar state
const todayDate = new Date()
const todayISO = todayDate.toISOString().slice(0, 10)
const miniYear = ref(todayDate.getFullYear())
const miniMonth = ref(todayDate.getMonth()) // 0-11
const datesWithBookings = computed(() => {
  const set = new Set<string>()
  for (const b of bookings.value) {
    if (b.status !== 'CANCELLED') set.add(b.date)
  }
  return set
})

const miniMonthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const miniWeekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface MiniDayCell {
  dateStr: string
  dayNum: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  hasBookings: boolean
}

const miniDays = computed<MiniDayCell[]>(() => {
  const y = miniYear.value
  const m = miniMonth.value

  const firstDayOfWeek = new Date(y, m, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const daysInPrevMonth = new Date(y, m, 0).getDate()

  const cells: MiniDayCell[] = []

  // Prev month padding
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevDate = new Date(y, m - 1, day)
    const str = prevDate.toISOString().slice(0, 10)
    cells.push({
      dateStr: str,
      dayNum: day,
      isCurrentMonth: false,
      isToday: str === todayISO,
      isSelected: str === selectedDate.value,
      hasBookings: datesWithBookings.value.has(str),
    })
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const str = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({
      dateStr: str,
      dayNum: day,
      isCurrentMonth: true,
      isToday: str === todayISO,
      isSelected: str === selectedDate.value,
      hasBookings: datesWithBookings.value.has(str),
    })
  }

  // Next month padding (make up to 42 cells = 6 rows)
  const remaining = 42 - cells.length
  for (let day = 1; day <= remaining; day++) {
    const nextDate = new Date(y, m + 1, day)
    const str = nextDate.toISOString().slice(0, 10)
    cells.push({
      dateStr: str,
      dayNum: day,
      isCurrentMonth: false,
      isToday: str === todayISO,
      isSelected: str === selectedDate.value,
      hasBookings: datesWithBookings.value.has(str),
    })
  }

  return cells
})

function prevMiniMonth() {
  if (miniMonth.value === 0) {
    miniMonth.value = 11
    miniYear.value--
  } else {
    miniMonth.value--
  }
}

function nextMiniMonth() {
  if (miniMonth.value === 11) {
    miniMonth.value = 0
    miniYear.value++
  } else {
    miniMonth.value++
  }
}

function calendarApi() {
  return mainCalendarRef.value?.getApi() ?? null
}

function updateHeaderTitle() {
  const api = calendarApi()
  if (!api) return

  const view = api.view
  if (view.type === 'dayGridMonth') {
    headerTitle.value = api.getDate().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  } else if (view.type === 'timeGridDay') {
    headerTitle.value = api.getDate().toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } else {
    // Week view: compute Sunday - Saturday or view range
    const start = view.currentStart
    const end = new Date(view.currentEnd.getTime() - 86400000)
    if (start.getMonth() === end.getMonth()) {
      headerTitle.value = `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })}`
    } else {
      headerTitle.value = `${start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} – ${end.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    }
  }
}

function onSelectMiniDate(dateStr: string) {
  selectedDate.value = dateStr
  const api = calendarApi()
  if (api) {
    api.gotoDate(dateStr)
    updateHeaderTitle()
  }
  // Sync mini calendar month if clicked an adjacent month day
  const clickedDate = new Date(dateStr)
  if (clickedDate.getMonth() !== miniMonth.value || clickedDate.getFullYear() !== miniYear.value) {
    miniMonth.value = clickedDate.getMonth()
    miniYear.value = clickedDate.getFullYear()
  }
  // Close drawer if mobile
  mobileSidebarOpen.value = false
}

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
  if (!time) return ''
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = (hh || 0) >= 12 ? 'PM' : 'AM'
  const hour = (hh || 0) % 12 === 0 ? 12 : (hh || 0) % 12
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

function formatDateLong(dateISO: string): string {
  if (!dateISO) return ''
  const d = new Date(`${dateISO}T00:00:00`)
  return d.toLocaleDateString('en-US', {
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

// Filtered Bookings for the Main Calendar (client-side; endpoint takes date range only)
const filteredBookings = computed(() =>
  bookings.value.filter((b) => {
    if (selectedStatusFilter.value && b.status !== selectedStatusFilter.value) {
      return false
    }
    return true
  }),
)

function getEventClass(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'fc-event-confirmed'
    case 'PENDING':
      return 'fc-event-pending'
    case 'CANCELLED':
      return 'fc-event-cancelled'
    default:
      return 'fc-event-confirmed'
  }
}

const calendarEvents = computed(() =>
  filteredBookings.value.map((b) => ({
    id: b.id,
    title: b.patientName,
    start: `${b.date}T${b.startTime}`,
    end: `${b.date}T${b.endTime}`,
    classNames: [getEventClass(b.status)],
    extendedProps: b,
  })),
)

// Navigation Controls
function switchView(view: CalendarViewType) {
  currentView.value = view
  const api = calendarApi()
  if (api) {
    api.changeView(view)
    updateHeaderTitle()
  }
}

function handlePrev() {
  const api = calendarApi()
  if (api) {
    api.prev()
    updateHeaderTitle()
  }
}

function handleNext() {
  const api = calendarApi()
  if (api) {
    api.next()
    updateHeaderTitle()
  }
}

function handleToday() {
  const api = calendarApi()
  if (api) {
    api.today()
    selectedDate.value = todayISO
    updateHeaderTitle()
  }
}

function handleDatesSet(arg: DatesSetArg) {
  currentRangeStart = arg.startStr.slice(0, 10)
  currentRangeEnd = arg.endStr.slice(0, 10)
  updateHeaderTitle()

  // Debounce API fetch
  if (datesSetTimer) clearTimeout(datesSetTimer)
  datesSetTimer = setTimeout(() => {
    void refetchForCurrentRange()
  }, 100)
}

function handleEventClick(arg: EventClickArg) {
  const bookingId = (arg.event.extendedProps as { id?: string }).id || arg.event.id
  void openDetailById(bookingId)
}

async function openDetailById(bookingId: string) {
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

// Custom Event Rendering (admin pattern; doctor fields only — no email/doctor rows exist on DoctorBooking)
function renderEventContent(arg: EventContentArg) {
  const props = arg.event.extendedProps as DoctorBooking
  const isCancelled = props.status === 'CANCELLED'
  const isPending = props.status === 'PENDING'
  const patientName = props.patientName || 'Unknown'
  const service = props.service || 'Mental Health Counseling'
  const timeStr = `${formatTime(props.startTime)} – ${formatTime(props.endTime)}`

  if (arg.view.type === 'dayGridMonth') {
    let dotBg = '#E91E8C'
    if (isPending) dotBg = '#F59E0B'
    if (isCancelled) dotBg = '#9CA3AF'

    const strike = isCancelled ? 'line-through opacity-60' : ''
    return {
      html: `
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs truncate w-full cursor-pointer ${strike}">
          <span class="size-2 rounded-full shrink-0" style="background-color: ${dotBg}"></span>
          <span class="font-medium truncate text-foreground">${patientName}</span>
          <span class="opacity-70 text-[10px] shrink-0 ml-auto">${props.startTime}</span>
        </div>
      `,
    }
  }

  const strike = isCancelled ? 'line-through opacity-60' : ''

  if (arg.view.type === 'timeGridDay') {
    return {
      html: `
        <div class="h-full w-full p-3 flex flex-col justify-between overflow-hidden cursor-pointer ${strike}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-bold text-sm text-foreground truncate">${patientName}</div>
              <div class="text-xs mt-1 truncate text-foreground/80">${service}</div>
            </div>
            ${isPending ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200/80 text-amber-900 dark:bg-amber-950 dark:text-amber-200 shrink-0">Pending</span>' : ''}
            ${isCancelled ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground shrink-0">Cancelled</span>' : ''}
          </div>
          <div class="flex items-center justify-between text-xs mt-2 pt-2 border-t border-border/50">
            <span class="font-mono text-xs opacity-75">${timeStr}</span>
            <span class="text-xs font-semibold text-primary">View Details →</span>
          </div>
        </div>
      `,
    }
  }

  // Week view card
  return {
    html: `
      <div class="h-full w-full p-2 flex flex-col justify-between overflow-hidden leading-snug cursor-pointer ${strike}">
        <div class="min-w-0">
          <div class="font-bold text-xs text-foreground truncate">${patientName}</div>
          <div class="text-[11px] truncate mt-0.5 text-foreground/80">${service}</div>
        </div>
        <div class="flex items-center justify-between text-[10px] opacity-75 font-mono mt-1">
          <span>${formatTime(props.startTime)}</span>
          ${isPending ? '<span class="text-amber-600 dark:text-amber-400 font-bold">⚠️</span>' : ''}
        </div>
      </div>
    `,
  }
}

// Month view "+N more" click behavior
function handleMoreLinkClick(info: { date: Date }) {
  const dateStr = info.date.toISOString().slice(0, 10)
  selectedDate.value = dateStr
  switchView('timeGridDay')
  const api = calendarApi()
  api?.gotoDate(info.date)
  return 'none'
}

// FullCalendar reactive configuration
const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: currentView.value,
  initialDate: new Date(),
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
  dayCellClassNames: (arg: { date: Date }) => {
    const classes: string[] = []
    const dateStr = arg.date.toISOString().slice(0, 10)
    if (isPastStr(dateStr)) classes.push('fc-past', 'bg-white/[0.02]')
    const hasPending = bookings.value.some((b) => b.date === dateStr && b.status === 'PENDING')
    if (hasPending) classes.push('fc-day-has-pending')
    return classes
  },
  events: calendarEvents.value,
  eventContent: renderEventContent,
  eventClick: handleEventClick,
  datesSet: handleDatesSet,
}))

function joinSession() {
  if (!detail.value) return
  navigateTo(`/doctor/session/${detail.value.id}`)
}

function onEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && detailOpen.value) detailOpen.value = false
}

onMounted(async () => {
  now.value = Date.now()
  window.setInterval(() => {
    now.value = Date.now()
  }, 60 * 1000)
  window.addEventListener('keydown', onEscapeKey)
  const t = new Date()
  await fetchBookings(toISODate(new Date(t.getFullYear(), t.getMonth(), 1)), toISODate(new Date(t.getFullYear(), t.getMonth() + 1, 0)))
  calendarKey.value += 1
  updateHeaderTitle()
})

onBeforeUnmount(() => {
  if (datesSetTimer) clearTimeout(datesSetTimer)
  window.removeEventListener('keydown', onEscapeKey)
})
</script>

<template>
  <div class="relative flex min-h-screen flex-col bg-background text-foreground">
    <!-- Top Header -->
    <div class="border-b border-border/70 bg-card/60 px-4 py-5 backdrop-blur-md lg:px-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-foreground" data-testid="page-title">
            My Calendar
          </h1>
          <p class="mt-0.5 text-sm text-muted-foreground">
            Your sessions schedule
          </p>
        </div>

        <!-- Navigation and View Switcher -->
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <!-- Left Mobile Sidebar Toggle -->
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5 lg:hidden"
            @click="mobileSidebarOpen = !mobileSidebarOpen"
          >
            <PanelLeftOpen v-if="!mobileSidebarOpen" class="size-4 text-primary" />
            <PanelLeftClose v-else class="size-4 text-primary" />
            <span>Calendar</span>
          </Button>

          <!-- Prev, Today, Next Nav Buttons -->
          <div class="flex items-center rounded-xl border border-border bg-background p-0.5 shadow-xs">
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              aria-label="Previous"
              data-testid="calendar-prev"
              @click="handlePrev"
            >
              <ChevronLeft class="size-4" />
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:text-primary active:scale-95"
              data-testid="calendar-today"
              @click="handleToday"
            >
              Today
            </button>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              aria-label="Next"
              data-testid="calendar-next"
              @click="handleNext"
            >
              <ChevronRight class="size-4" />
            </button>
          </div>

          <!-- Current Range Title Label -->
          <span
            class="hidden min-w-[140px] text-center text-sm font-semibold text-foreground sm:inline-block"
            data-testid="calendar-month"
          >
            {{ headerTitle }}
          </span>

          <!-- View Switcher (Daily / Weekly / Monthly) -->
          <div class="flex items-center rounded-xl border border-border bg-background p-0.5 shadow-xs">
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
              :class="currentView === 'timeGridDay'
                ? 'bg-primary text-primary-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground'"
              data-testid="view-daily"
              @click="switchView('timeGridDay')"
            >
              Daily
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
              :class="currentView === 'timeGridWeek'
                ? 'bg-primary text-primary-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground'"
              data-testid="view-weekly"
              @click="switchView('timeGridWeek')"
            >
              Weekly
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
              :class="currentView === 'dayGridMonth'
                ? 'bg-primary text-primary-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground'"
              data-testid="view-monthly"
              @click="switchView('dayGridMonth')"
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3 text-xs">
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <span class="flex items-center gap-1 font-medium text-muted-foreground">
            <Filter class="size-3.5" />
            Filter:
          </span>

          <!-- Status Filter -->
          <select
            v-model="selectedStatusFilter"
            class="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            data-testid="filter-status"
            :data-testid="'calendar-status-filter'"
            @change="refetchForCurrentRange"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <!-- Clear Filters -->
          <Button
            v-if="hasActiveFilters"
            variant="ghost"
            size="sm"
            class="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            data-testid="calendar-clear-filters"
            @click="clearFilters"
          >
            <RotateCcw class="size-3" />
            Clear
          </Button>
        </div>

        <!-- Appointment count -->
        <div class="text-xs text-muted-foreground font-medium">
          Showing <span class="font-semibold text-foreground">{{ filteredBookings.length }}</span> of <span class="font-semibold text-foreground">{{ bookings.length }}</span> sessions
        </div>
      </div>
    </div>

    <p v-if="error" class="px-4 pt-4 text-sm text-destructive lg:px-8">{{ error }}</p>

    <!-- Main Workspace: Left Sidebar + Main Calendar -->
    <div class="flex flex-1 gap-6 p-4 lg:p-6 overflow-hidden">
      <!-- Left Sidebar (Desktop fixed 280px / Mobile Drawer) -->
      <aside
        class="flex flex-col gap-5 shrink-0 transition-all duration-200"
        :class="[
          'w-[280px]',
          'lg:flex',
          mobileSidebarOpen
            ? 'fixed inset-y-0 left-0 z-40 flex w-[300px] border-r border-border bg-card p-4 shadow-strong overflow-y-auto'
            : 'hidden',
        ]"
      >
        <!-- Mobile close button -->
        <div v-if="mobileSidebarOpen" class="flex items-center justify-between lg:hidden border-b border-border pb-3">
          <span class="font-semibold text-sm">Navigation</span>
          <button type="button" class="p-1 rounded-md text-muted-foreground hover:text-foreground" @click="mobileSidebarOpen = false">
            <X class="size-5" />
          </button>
        </div>

        <!-- Mini Calendar Card -->
        <Card class="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
          <!-- Month Header -->
          <div class="flex items-center justify-between pb-3">
            <span class="text-sm font-bold text-foreground">
              {{ miniMonthNames[miniMonth] }} {{ miniYear }}
            </span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Previous month"
                @click="prevMiniMonth"
              >
                <ChevronLeft class="size-3.5" />
              </button>
              <button
                type="button"
                class="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Next month"
                @click="nextMiniMonth"
              >
                <ChevronRight class="size-3.5" />
              </button>
            </div>
          </div>

          <!-- Weekday Headers -->
          <div class="grid grid-cols-7 gap-1 text-center mb-1">
            <span
              v-for="(w, idx) in miniWeekdays"
              :key="idx"
              class="text-[11px] font-semibold text-muted-foreground/70"
            >
              {{ w }}
            </span>
          </div>

          <!-- Days Grid -->
          <div class="grid grid-cols-7 gap-1 text-center">
            <button
              v-for="cell in miniDays"
              :key="cell.dateStr"
              type="button"
              class="group relative flex flex-col items-center justify-center rounded-lg py-1 text-xs transition-all active:scale-90"
              :class="[
                cell.isCurrentMonth ? 'text-foreground font-medium' : 'text-muted-foreground/35 font-normal',
                cell.isToday
                  ? 'bg-primary text-primary-foreground font-bold shadow-soft'
                  : cell.isSelected
                    ? 'ring-2 ring-primary bg-primary/10 font-semibold'
                    : 'hover:bg-muted',
              ]"
              @click="onSelectMiniDate(cell.dateStr)"
            >
              <span>{{ cell.dayNum }}</span>
              <!-- Dot for bookings -->
              <span
                v-if="cell.hasBookings && !cell.isToday"
                class="mt-0.5 size-1 rounded-full bg-primary"
              />
              <span v-else class="mt-0.5 size-1" />
            </button>
          </div>
        </Card>
      </aside>

      <!-- Main Calendar Area -->
      <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Card class="flex flex-1 flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-5 shadow-soft overflow-auto">
          <ClientOnly>
            <FullCalendar
              ref="mainCalendarRef"
              :key="calendarKey"
              :options="calendarOptions"
            />
            <template #fallback>
              <div class="flex h-96 items-center justify-center">
                <div class="text-sm text-muted-foreground">Loading calendar schedule…</div>
              </div>
            </template>
          </ClientOnly>

          <!-- Calendar Status Legend -->
          <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span class="font-semibold text-foreground/80">Status:</span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-[#E91E8C]" />
              <span>Confirmed</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-[#F59E0B]" />
              <span>Pending</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-[#9CA3AF]" />
              <span>Cancelled</span>
            </span>
          </div>
        </Card>
      </main>
    </div>

    <!-- Booking Detail Slide-in Side Panel (Drawer) -->
    <Teleport to="body">
      <!-- Dimmed Backdrop -->
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="detailOpen"
          class="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
          @click="detailOpen = false"
        />
      </Transition>

      <!-- Slide-in Drawer -->
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-150 ease-in"
        leave-to-class="translate-x-full"
      >
        <aside
          v-if="detailOpen"
          class="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[380px] lg:w-[420px] flex-col border-l border-border bg-card text-card-foreground shadow-strong"
          data-testid="booking-detail-dialog"
          role="dialog"
          aria-modal="true"
        >
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-border/80 px-6 py-4">
            <div class="flex items-center gap-2.5">
              <h2 class="text-base font-bold text-foreground">Session Details</h2>
              <Badge
                v-if="detail"
                :variant="detail.status === 'CONFIRMED' ? 'default' : detail.status === 'PENDING' ? 'pending' : 'cancelled'"
                class="capitalize text-xs font-semibold"
              >
                {{ detail.status.toLowerCase() }}
              </Badge>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close panel"
              @click="detailOpen = false"
            >
              <X class="size-5" />
            </button>
          </div>

          <!-- Drawer Body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <div v-if="detailLoading" class="grid gap-2">
              <Skeleton v-for="i in 4" :key="i" class="h-10 w-full" />
            </div>
            <template v-else-if="detail">
              <!-- Patient Section -->
              <div>
                <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                  Patient
                </p>
                <div class="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-muted/20 p-3.5">
                  <Avatar class="size-11 shrink-0">
                    <AvatarImage v-if="detail.patientPhoto" :src="detail.patientPhoto" alt="" />
                    <AvatarFallback class="bg-primary/10 text-primary font-bold">
                      {{ (detail.patientName || 'U').slice(0, 1).toUpperCase() }}
                    </AvatarFallback>
                  </Avatar>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold text-foreground">{{ detail.patientName }}</p>
                    <p v-if="detail.patientEmail" class="truncate text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Mail class="size-3 shrink-0" />
                      {{ detail.patientEmail }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Session Details Section -->
              <div>
                <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                  Session Info
                </p>
                <div class="rounded-2xl border border-border/70 bg-muted/20 divide-y divide-border/60 text-xs">
                  <div class="flex items-center justify-between p-3">
                    <span class="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon class="size-3.5 text-primary" />
                      Date
                    </span>
                    <span class="font-semibold text-foreground">{{ formatDateLong(detail.date) }}</span>
                  </div>
                  <div class="flex items-center justify-between p-3">
                    <span class="flex items-center gap-2 text-muted-foreground">
                      <Clock class="size-3.5 text-primary" />
                      Time
                    </span>
                    <span class="font-semibold text-foreground">{{ formatTimeRange(detail.startTime, detail.endTime) }} (60 min)</span>
                  </div>
                  <div class="flex items-center justify-between p-3">
                    <span class="flex items-center gap-2 text-muted-foreground">
                      <Video class="size-3.5 text-primary" />
                      Service
                    </span>
                    <span class="font-semibold text-foreground">{{ detail.service || 'Mental Health Counseling' }}</span>
                  </div>
                </div>
              </div>

              <!-- Join Session -->
              <div>
                <Button
                  class="w-full"
                  data-testid="join-session"
                  :disabled="!canJoinBooking(detail)"
                  :title="detail && !canJoinBooking(detail) ? 'Available 5 minutes before your session' : undefined"
                  @click="joinSession"
                >
                  <Video class="size-4" aria-hidden="true" />
                  Join Session
                </Button>
                <p v-if="!canJoinBooking(detail)" class="mt-1.5 text-center text-xs text-muted-foreground">
                  Available 5 minutes before your session
                </p>
              </div>
            </template>
            <p v-else class="text-sm text-muted-foreground">Could not load session details.</p>
          </div>

          <!-- Drawer Footer -->
          <div class="border-t border-border/80 px-6 py-3.5 bg-muted/10 flex justify-end">
            <Button variant="outline" size="sm" class="text-xs" @click="detailOpen = false">
              Close
            </Button>
          </div>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
/* Status color styling for FullCalendar event cards (admin parity) */
.fc-event-confirmed {
  background-color: #FCE4F3 !important;
  border: 1px solid #F9A8D4 !important;
  border-left: 4px solid #E91E8C !important;
  color: #2D2D2D !important;
}
.dark .fc-event-confirmed {
  background-color: rgba(233, 30, 140, 0.22) !important;
  border: 1px solid rgba(233, 30, 140, 0.35) !important;
  border-left: 4px solid #EC4899 !important;
  color: #FFFFFF !important;
}

.fc-event-pending {
  background-color: #FEF9C3 !important;
  border: 1px solid #FDE047 !important;
  border-left: 4px solid #F59E0B !important;
  color: #2D2D2D !important;
}
.dark .fc-event-pending {
  background-color: rgba(245, 158, 11, 0.22) !important;
  border: 1px solid rgba(245, 158, 11, 0.35) !important;
  border-left: 4px solid #F59E0B !important;
  color: #FFFFFF !important;
}

.fc-event-cancelled {
  background-color: #F3F4F6 !important;
  border: 1px solid #E5E7EB !important;
  border-left: 4px solid #9CA3AF !important;
  color: #6B7280 !important;
  opacity: 0.75;
}
.dark .fc-event-cancelled {
  background-color: rgba(156, 163, 175, 0.15) !important;
  border: 1px solid rgba(156, 163, 175, 0.25) !important;
  border-left: 4px solid #6B7280 !important;
  color: #9CA3AF !important;
  opacity: 0.6;
}

/* Day cells with pending bookings in Month View */
.fc-day-has-pending {
  border-left: 3.5px solid #F59E0B !important;
}

/* Past-day cells: subtle presence, no dimming (explicit requirement; admin has no past styling) */
.fc-past {
  background-color: rgba(255, 255, 255, 0.02) !important;
}
.fc-past .fc-daygrid-day-frame {
  background-color: rgba(255, 255, 255, 0.02) !important;
}

/* FullCalendar SaaS Styling Overrides (admin parity) */
.fc {
  font-family: inherit;
}
.fc .fc-timegrid-slot {
  height: 2.5rem;
}
.fc .fc-timegrid-col-events {
  margin: 0 2px;
}
.fc-theme-standard td,
.fc-theme-standard th {
  border-color: hsl(var(--border) / 0.8) !important;
}
.fc-col-header-cell-cushion {
  padding-top: 10px !important;
  padding-bottom: 10px !important;
  font-weight: 600;
  font-size: 0.825rem;
  color: hsl(var(--foreground));
  text-decoration: none !important;
}
.fc-timegrid-slot-label-cushion {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}
.fc-timegrid-axis-cushion {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}
.fc-timegrid-now-indicator-line {
  border-color: #E91E8C !important;
  border-width: 2px !important;
}
.fc-timegrid-now-indicator-arrow {
  border-color: #E91E8C !important;
}
.fc-daygrid-more-link {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  color: #E91E8C !important;
  text-decoration: none !important;
  padding: 2px 4px;
}
.fc-daygrid-more-link:hover {
  text-decoration: underline !important;
}
</style>
