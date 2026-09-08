<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Phone,
  Mail,
  Stethoscope,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  X,
  Trash2,
  Filter,
  RotateCcw,
  Check,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-vue-next'
import type { AdminBooking, PendingBooking } from '~/modules/admin/composables/types'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'APPOINTMENTS', action: 'READ' },
})

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
  fetchDoctorDayBookings,
  assignDoctor,
  cancelBooking,
} = useAdminDashboard()

const { toast } = useToast()
const { hasPermission } = useAuth()

const canAssign = computed(() => hasPermission('APPOINTMENTS', 'UPDATE'))
const canDelete = computed(() => hasPermission('APPOINTMENTS', 'DELETE'))

// Calendar instance reference
const mainCalendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)
const calendarKey = ref(0)

// Active view: default to 'timeGridWeek' (Weekly)
type CalendarViewType = 'timeGridWeek' | 'timeGridDay' | 'dayGridMonth'
const currentView = ref<CalendarViewType>('timeGridWeek')
const headerTitle = ref('')

// Selected date on calendar / mini-calendar
const selectedDate = ref<string>(new Date().toISOString().slice(0, 10))

// Left sidebar drawer on mobile / tablet
const mobileSidebarOpen = ref(false)

// Filters
const selectedDoctorFilter = ref('')
const selectedStatusFilter = ref('')
const hasActiveFilters = computed(() => !!selectedDoctorFilter.value || !!selectedStatusFilter.value)

function clearFilters() {
  selectedDoctorFilter.value = ''
  selectedStatusFilter.value = ''
  void refetchForCurrentRange()
}

// Visible range for bookings fetch
let currentRangeStart = ''
let currentRangeEnd = ''
let datesSetTimer: ReturnType<typeof setTimeout> | null = null

function buildFilterParams(): Record<string, string> {
  const q: Record<string, string> = {}
  if (currentRangeStart) q.start = currentRangeStart
  if (currentRangeEnd) q.end = currentRangeEnd
  if (selectedDoctorFilter.value) q.doctorId = selectedDoctorFilter.value
  if (selectedStatusFilter.value) q.status = selectedStatusFilter.value
  return q
}

async function refetchForCurrentRange() {
  await fetchBookings(buildFilterParams())
}

// Mini Calendar state
const todayDate = new Date()
const todayISO = todayDate.toISOString().slice(0, 10)
const miniYear = ref(todayDate.getFullYear())
const miniMonth = ref(todayDate.getMonth()) // 0-11
const datesWithBookings = ref<Set<string>>(new Set())

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
    const currDate = new Date(y, m, day)
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

async function fetchMiniMonthBookings() {
  const y = miniYear.value
  const m = String(miniMonth.value + 1).padStart(2, '0')
  const lastDay = new Date(y, miniMonth.value + 1, 0).getDate()
  const start = `${y}-${m}-01`
  const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`

  try {
    const res = await $fetch<{ bookings: AdminBooking[] }>('/api/admin/bookings', {
      query: { start, end },
    })
    const set = new Set<string>()
    for (const b of res.bookings || []) {
      if (b.status !== 'CANCELLED') {
        set.add(b.date)
      }
    }
    datesWithBookings.value = set
  } catch {
    // Ignore error
  }
}

function prevMiniMonth() {
  if (miniMonth.value === 0) {
    miniMonth.value = 11
    miniYear.value--
  } else {
    miniMonth.value--
  }
  void fetchMiniMonthBookings()
}

function nextMiniMonth() {
  if (miniMonth.value === 11) {
    miniMonth.value = 0
    miniYear.value++
  } else {
    miniMonth.value++
  }
  void fetchMiniMonthBookings()
}

function onSelectMiniDate(dateStr: string) {
  selectedDate.value = dateStr
  const api = mainCalendarRef.value?.getApi()
  if (api) {
    api.gotoDate(dateStr)
    updateHeaderTitle()
  }
  // Sync mini calendar month if clicked an adjacent month day
  const clickedDate = new Date(dateStr)
  if (clickedDate.getMonth() !== miniMonth.value || clickedDate.getFullYear() !== miniYear.value) {
    miniMonth.value = clickedDate.getMonth()
    miniYear.value = clickedDate.getFullYear()
    void fetchMiniMonthBookings()
  }
  // Close drawer if mobile
  mobileSidebarOpen.value = false
}

// Side Detail Panel State
const detailTarget = ref<AdminBooking | null>(null)
const detailOpen = ref(false)
const selectedDoctorId = ref('')
const checkingConflict = ref(false)
const hasConflict = ref(false)
const conflictReason = ref('')
const candidateDoctorBookings = ref<AdminBooking[]>([])
const assigning = ref(false)
const assignError = ref('')
const cancelling = ref(false)
const showCancelConfirm = ref(false)

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((v) => parseInt(v, 10))
  return (h || 0) * 60 + (m || 0)
}

function hasTimeConflict(startA: string, endA: string, startB: string, endB: string): boolean {
  const aStart = timeToMinutes(startA)
  const aEnd = timeToMinutes(endA)
  const bStart = timeToMinutes(startB)
  const bEnd = timeToMinutes(endB)
  return aStart < bEnd && aEnd > bStart
}

async function onSelectCandidateDoctor(doctorId: string) {
  selectedDoctorId.value = doctorId
  candidateDoctorBookings.value = []
  hasConflict.value = false
  conflictReason.value = ''
  assignError.value = ''

  if (!doctorId || !detailTarget.value) return

  checkingConflict.value = true
  try {
    const list = await fetchDoctorDayBookings(doctorId, detailTarget.value.date)
    const confirmedList = list.filter((b) => b.status === 'CONFIRMED' && b.id !== detailTarget.value?.id)
    candidateDoctorBookings.value = confirmedList

    const targetStart = detailTarget.value.startTime
    const targetEnd = detailTarget.value.endTime
    const conflicting = confirmedList.find((b) => hasTimeConflict(b.startTime, b.endTime, targetStart, targetEnd))

    if (conflicting) {
      hasConflict.value = true
      conflictReason.value = `Already booked for session with ${conflicting.patientName} (${formatTime(conflicting.startTime)} – ${formatTime(conflicting.endTime)})`
    } else {
      hasConflict.value = false
      conflictReason.value = ''
    }
  } catch {
    hasConflict.value = false
  } finally {
    checkingConflict.value = false
  }
}

function openDetail(booking: AdminBooking) {
  detailTarget.value = { ...booking }
  selectedDoctorId.value = ''
  hasConflict.value = false
  conflictReason.value = ''
  candidateDoctorBookings.value = []
  assignError.value = ''
  showCancelConfirm.value = false
  detailOpen.value = true
  if (booking.status === 'PENDING' && canAssign.value) {
    void fetchActiveDoctors()
  }
}

function openAssignForPending(pending: PendingBooking) {
  const booking: AdminBooking = {
    id: pending.id,
    patientName: pending.patientName,
    patientEmail: pending.patientEmail,
    patientPhone: pending.patientPhone,
    doctorId: null,
    doctorName: null,
    date: pending.date,
    startTime: pending.startTime,
    endTime: pending.endTime,
    service: 'Mental Health Counseling',
    status: 'PENDING',
    createdAt: pending.createdAt,
  }
  openDetail(booking)
  mobileSidebarOpen.value = false
}

async function confirmDetailAssign() {
  if (!detailTarget.value || !selectedDoctorId.value || hasConflict.value || assigning.value) return
  assigning.value = true
  assignError.value = ''

  try {
    const ok = await assignDoctor(detailTarget.value.id, selectedDoctorId.value)
    if (ok) {
      toast({ title: 'Doctor assigned and booking confirmed', variant: 'success' })
      const assignedDoc = activeDoctors.value.find((d) => d.id === selectedDoctorId.value)

      // Update local detailTarget to reflect CONFIRMED immediately
      detailTarget.value = {
        ...detailTarget.value,
        doctorId: selectedDoctorId.value,
        doctorName: assignedDoc?.name || 'Assigned Doctor',
        status: 'CONFIRMED',
      }

      await Promise.all([
        fetchPendingBookings(),
        refetchForCurrentRange(),
        fetchMiniMonthBookings(),
      ])
    } else {
      assignError.value = error.value || 'Could not assign doctor'
    }
  } catch (e: unknown) {
    assignError.value = (e as { data?: { message?: string } })?.data?.message || 'Failed to assign doctor'
  } finally {
    assigning.value = false
  }
}

async function confirmCancel() {
  if (!detailTarget.value || cancelling.value) return
  cancelling.value = true

  try {
    const ok = await cancelBooking(detailTarget.value.id)
    if (ok) {
      toast({ title: 'Booking cancelled and payment refunded', variant: 'success' })
      detailOpen.value = false
      showCancelConfirm.value = false
      detailTarget.value = null
      await Promise.all([
        fetchPendingBookings(),
        refetchForCurrentRange(),
        fetchMiniMonthBookings(),
      ])
    } else {
      toast({ title: error.value || 'Could not cancel booking', variant: 'destructive' })
    }
  } catch {
    toast({ title: 'Could not cancel booking', variant: 'destructive' })
  } finally {
    cancelling.value = false
  }
}

// Filtered Bookings for the Main Calendar
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

// Formatting utilities
function formatTime(time: string): string {
  if (!time) return ''
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = hh >= 12 ? 'PM' : 'AM'
  const hour = hh % 12 === 0 ? 12 : hh % 12
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

function formatPendingDate(dateISO: string, time: string): string {
  if (!dateISO) return ''
  const d = new Date(`${dateISO}T00:00:00`)
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return `${dateStr} · ${formatTime(time)}`
}

function updateHeaderTitle() {
  const api = mainCalendarRef.value?.getApi()
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

// Navigation Controls
function switchView(view: CalendarViewType) {
  currentView.value = view
  const api = mainCalendarRef.value?.getApi()
  if (api) {
    api.changeView(view)
    updateHeaderTitle()
  }
}

function handlePrev() {
  const api = mainCalendarRef.value?.getApi()
  if (api) {
    api.prev()
    updateHeaderTitle()
  }
}

function handleNext() {
  const api = mainCalendarRef.value?.getApi()
  if (api) {
    api.next()
    updateHeaderTitle()
  }
}

function handleToday() {
  const api = mainCalendarRef.value?.getApi()
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
  const booking = arg.event.extendedProps as AdminBooking
  if (booking) {
    openDetail(booking)
  }
}

// Custom Event Rendering
function renderEventContent(arg: EventContentArg) {
  const props = arg.event.extendedProps as AdminBooking
  const isCancelled = props.status === 'CANCELLED'
  const isPending = props.status === 'PENDING'
  const patientName = props.patientName || 'Unknown'
  const doctorName = props.doctorName || 'Unassigned'
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

  const doctorClass = !props.doctorId
    ? 'text-amber-700 dark:text-amber-300 font-semibold'
    : 'text-foreground/80'
  const strike = isCancelled ? 'line-through opacity-60' : ''

  if (arg.view.type === 'timeGridDay') {
    return {
      html: `
        <div class="h-full w-full p-3 flex flex-col justify-between overflow-hidden cursor-pointer ${strike}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-bold text-sm text-foreground truncate">${patientName}</div>
              <div class="text-xs text-muted-foreground truncate">${props.patientEmail || ''}</div>
              <div class="text-xs mt-1 truncate ${doctorClass}">
                👨‍⚕️ ${doctorName}
              </div>
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
          <div class="text-[11px] truncate mt-0.5 ${doctorClass}">${doctorName}</div>
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
  const api = mainCalendarRef.value?.getApi()
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
    const dateStr = arg.date.toISOString().slice(0, 10)
    const hasPending = pendingBookings.value.some((b) => b.date === dateStr)
    return hasPending ? ['fc-day-has-pending'] : []
  },
  events: calendarEvents.value,
  eventContent: renderEventContent,
  eventClick: handleEventClick,
  datesSet: handleDatesSet,
}))

onMounted(async () => {
  await Promise.all([
    fetchAll(),
    fetchActiveDoctors(),
    fetchPendingBookings(),
    fetchMiniMonthBookings(),
  ])
  updateHeaderTitle()
})
</script>

<template>
  <div class="relative flex min-h-screen flex-col bg-background text-foreground">
    <!-- Top Header -->
    <div class="border-b border-border/70 bg-card/60 px-4 py-5 backdrop-blur-md lg:px-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-foreground" data-testid="page-title">
            Appointments
          </h1>
          <p class="mt-0.5 text-sm text-muted-foreground">
            Master schedule and pending bookings
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
            <span>Pending ({{ pendingBookings.length }})</span>
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
                ? 'bg-primary text-primary-foreground shadow-sm'
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
                ? 'bg-primary text-primary-foreground shadow-sm'
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
                ? 'bg-primary text-primary-foreground shadow-sm'
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

          <!-- Doctor Filter -->
          <select
            v-model="selectedDoctorFilter"
            class="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            data-testid="filter-doctor"
            :data-testid="'calendar-doctor-filter'"
            @change="refetchForCurrentRange"
          >
            <option value="">All Doctors</option>
            <option v-for="doc in activeDoctors" :key="doc.id" :value="doc.id">
              {{ doc.name }}
            </option>
          </select>

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
          Showing <span class="font-semibold text-foreground">{{ filteredBookings.length }}</span> of <span class="font-semibold text-foreground">{{ bookings.length }}</span> appointments
        </div>
      </div>
    </div>

    <!-- Main Workspace: Left Sidebar + Main Calendar -->
    <div class="flex flex-1 gap-6 p-4 lg:p-6 overflow-hidden">
      <!-- Left Sidebar (Desktop fixed 280px / Mobile Drawer) -->
      <aside
        class="flex flex-col gap-5 shrink-0 transition-all duration-200"
        :class="[
          'w-[280px]',
          'lg:flex',
          mobileSidebarOpen
            ? 'fixed inset-y-0 left-0 z-40 flex w-[300px] border-r border-border bg-card p-4 shadow-xl overflow-y-auto'
            : 'hidden',
        ]"
      >
        <!-- Mobile close button -->
        <div v-if="mobileSidebarOpen" class="flex items-center justify-between lg:hidden border-b border-border pb-3">
          <span class="font-semibold text-sm">Navigation & Pending</span>
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
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
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

        <!-- Pending Bookings Section -->
        <Card class="flex flex-1 flex-col rounded-2xl border border-border/80 bg-card p-4 shadow-soft overflow-hidden">
          <div class="flex items-center justify-between pb-3 border-b border-border/60">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-foreground">Pending Bookings</span>
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                data-testid="pending-bookings-count"
              >
                {{ pendingBookings.length }}
              </span>
            </div>
          </div>

          <!-- Pending Items List -->
          <div class="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[380px] lg:max-h-[calc(100vh-420px)]">
            <div v-if="loading && pendingBookings.length === 0" class="space-y-2">
              <Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-xl" />
            </div>

            <!-- Empty state -->
            <div
              v-else-if="pendingBookings.length === 0"
              class="flex flex-col items-center justify-center py-8 text-center"
              data-testid="no-pending-bookings"
            >
              <div class="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Check class="size-5" />
              </div>
              <p class="mt-2 text-xs font-semibold text-foreground">No pending bookings</p>
              <p class="mt-0.5 text-[11px] text-muted-foreground">All session requests are confirmed.</p>
            </div>

            <!-- List of pending cards -->
            <div
              v-for="b in pendingBookings"
              :key="b.id"
              class="group relative rounded-xl border border-border/80 bg-muted/25 hover:bg-muted/50 p-3 transition-all hover:border-primary/40 hover:shadow-xs"
              :data-testid="`pending-item-${b.id}`"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-bold text-foreground" data-testid="patient-name">
                    {{ b.patientName }}
                  </p>
                  <p class="mt-0.5 text-[11px] text-muted-foreground truncate" data-testid="booking-time">
                    📅 {{ formatPendingDate(b.date, b.startTime) }}
                  </p>
                  <p class="mt-0.5 text-[11px] text-muted-foreground/80 truncate">
                    ✉️ {{ b.patientEmail }}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 px-2.5 text-xs text-primary border-primary/40 hover:bg-primary/10 hover:text-primary font-semibold shrink-0"
                  :data-testid="`assign-${b.id}`"
                  @click="openAssignForPending(b)"
                >
                  Assign
                </Button>
              </div>
            </div>
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
          v-if="detailOpen && detailTarget"
          class="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[380px] lg:w-[420px] flex-col border-l border-border bg-card text-card-foreground shadow-2xl"
          data-testid="booking-detail-dialog"
          role="dialog"
          aria-modal="true"
        >
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-border/80 px-6 py-4">
            <div class="flex items-center gap-2.5">
              <h2 class="text-base font-bold text-foreground">Booking Details</h2>
              <Badge
                :variant="detailTarget.status === 'CONFIRMED' ? 'default' : detailTarget.status === 'PENDING' ? 'pending' : 'cancelled'"
                class="capitalize text-xs font-semibold"
              >
                {{ detailTarget.status.toLowerCase() }}
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
            <!-- Patient Section -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Patient
              </p>
              <div class="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-muted/20 p-3.5">
                <Avatar class="size-11 shrink-0">
                  <AvatarFallback class="bg-primary/10 text-primary font-bold">
                    {{ (detailTarget.patientName || 'U').slice(0, 1).toUpperCase() }}
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold text-foreground">{{ detailTarget.patientName }}</p>
                  <p class="truncate text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Mail class="size-3 shrink-0" />
                    {{ detailTarget.patientEmail }}
                  </p>
                  <p v-if="detailTarget.patientPhone" class="truncate text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Phone class="size-3 shrink-0" />
                    {{ detailTarget.patientPhone }}
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
                  <span class="font-semibold text-foreground">{{ formatDateLong(detailTarget.date) }}</span>
                </div>
                <div class="flex items-center justify-between p-3">
                  <span class="flex items-center gap-2 text-muted-foreground">
                    <Clock class="size-3.5 text-primary" />
                    Time
                  </span>
                  <span class="font-semibold text-foreground">{{ formatTimeRange(detailTarget.startTime, detailTarget.endTime) }} (60 min)</span>
                </div>
                <div class="flex items-center justify-between p-3">
                  <span class="flex items-center gap-2 text-muted-foreground">
                    <Stethoscope class="size-3.5 text-primary" />
                    Service
                  </span>
                  <span class="font-semibold text-foreground">{{ detailTarget.service || 'Mental Health Counseling' }}</span>
                </div>
                <div class="flex items-center justify-between p-3">
                  <span class="flex items-center gap-2 text-muted-foreground">
                    <CreditCard class="size-3.5 text-primary" />
                    Price
                  </span>
                  <span class="font-bold text-primary">EGP 200</span>
                </div>
              </div>
            </div>

            <!-- Assigned Doctor or Unassigned Banner -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Doctor
              </p>
              <!-- Doctor assigned -->
              <div v-if="detailTarget.doctorId" class="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-muted/20 p-3.5">
                <Avatar class="size-11 shrink-0">
                  <AvatarFallback class="bg-primary/10 text-primary font-bold">
                    {{ (detailTarget.doctorName || 'D').slice(0, 1).toUpperCase() }}
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold text-foreground">Dr. {{ detailTarget.doctorName }}</p>
                  <p class="text-xs text-muted-foreground">Counselor & Therapist</p>
                </div>
              </div>

              <!-- Unassigned Banner -->
              <div
                v-else
                class="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200"
              >
                <AlertTriangle class="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p class="font-bold">No doctor assigned yet</p>
                  <p class="mt-0.5 opacity-90">Assign a doctor below to confirm this appointment.</p>
                </div>
              </div>
            </div>

            <!-- Doctor Assignment Section (For PENDING bookings only) -->
            <div
              v-if="detailTarget.status === 'PENDING' && canAssign"
              class="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3"
            >
              <p class="text-xs font-bold text-foreground flex items-center gap-1.5">
                <User class="size-3.5 text-primary" />
                Assign a Doctor
              </p>

              <div>
                <label class="block text-[11px] text-muted-foreground mb-1" for="assign-doctor-dropdown">
                  Select active doctor:
                </label>
                <select
                  id="assign-doctor-dropdown"
                  v-model="selectedDoctorId"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                  data-testid="assign-doctor-select"
                  :data-testid="'detail-assign-doctor-select'"
                  @change="onSelectCandidateDoctor(selectedDoctorId)"
                >
                  <option value="" disabled>Select a doctor…</option>
                  <option v-for="doc in activeDoctors" :key="doc.id" :value="doc.id">
                    {{ doc.name }}
                  </option>
                </select>
              </div>

              <!-- Checking doctor schedule indicator -->
              <div v-if="checkingConflict" class="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <span class="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Checking doctor schedule for conflicts…
              </div>

              <!-- Doctor's Schedule on that day -->
              <div v-else-if="selectedDoctorId" class="space-y-2 pt-1">
                <p class="text-[11px] font-medium text-muted-foreground">
                  Doctor's confirmed bookings on {{ detailTarget.date }}:
                </p>

                <!-- Existing booking chips -->
                <div v-if="candidateDoctorBookings.length > 0" class="flex flex-wrap gap-1.5">
                  <span
                    v-for="cb in candidateDoctorBookings"
                    :key="cb.id"
                    class="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-mono font-medium"
                    :class="hasTimeConflict(cb.startTime, cb.endTime, detailTarget.startTime, detailTarget.endTime)
                      ? 'border-destructive text-destructive bg-destructive/10'
                      : 'text-foreground'"
                  >
                    {{ cb.startTime }} – {{ cb.endTime }}
                  </span>
                </div>
                <p v-else class="text-[11px] text-muted-foreground italic">
                  No other confirmed bookings on this day.
                </p>

                <!-- Conflict Alert or Availability Confirmation -->
                <div
                  v-if="hasConflict"
                  class="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive font-medium"
                >
                  <AlertCircle class="size-4 shrink-0 mt-0.5" />
                  <span>⚠️ {{ conflictReason }}</span>
                </div>
                <div
                  v-else
                  class="flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium"
                >
                  <CheckCircle class="size-4 shrink-0" />
                  <span>✓ Available at this time</span>
                </div>

                <p v-if="assignError" class="text-xs text-destructive">{{ assignError }}</p>

                <!-- Confirm Assignment Button -->
                <Button
                  class="w-full mt-2"
                  :disabled="!selectedDoctorId || checkingConflict || hasConflict || assigning"
                  data-testid="assign-confirm"
                  :data-testid="'detail-assign-confirm'"
                  @click="confirmDetailAssign"
                >
                  <span v-if="assigning" class="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
                  {{ assigning ? 'Assigning…' : 'Confirm Assignment' }}
                </Button>
              </div>
            </div>

            <!-- Cancel Booking Section (CONFIRMED bookings only) -->
            <div
              v-if="detailTarget.status === 'CONFIRMED' && canDelete"
              class="border-t border-border/70 pt-4"
            >
              <!-- Inline Confirmation Dialog -->
              <div v-if="showCancelConfirm" class="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 space-y-3">
                <p class="text-xs font-semibold text-destructive">
                  Are you sure? This will cancel the appointment and refund the payment. This action cannot be undone.
                </p>
                <div class="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    class="flex-1 text-xs"
                    :disabled="cancelling"
                    data-testid="confirm-cancel-booking"
                    @click="confirmCancel"
                  >
                    {{ cancelling ? 'Cancelling…' : 'Confirm Cancellation' }}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    class="text-xs"
                    @click="showCancelConfirm = false"
                  >
                    Keep Booking
                  </Button>
                </div>
              </div>

              <!-- Cancel Trigger Button -->
              <button
                v-else
                type="button"
                class="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline"
                data-testid="cancel-booking"
                @click="showCancelConfirm = true"
              >
                <Trash2 class="size-3.5" />
                Cancel Booking
              </button>
            </div>
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
/* Status color styling for FullCalendar event cards */
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

/* FullCalendar SaaS Styling Overrides */
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
