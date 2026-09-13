<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Plus,
  ShieldCheck,
  Stethoscope,
  User,
  Video,
  X,
} from 'lucide-vue-next'
import type {
  DateClickArg,
  DatesSetArg,
  DayCellContentArg,
  EventClickArg,
  EventContentArg,
} from '@fullcalendar/core'
import type { Appointment } from '~/modules/patient/composables/types'
import type { AvailableSlot, BookingSessionType } from '~/modules/patient/composables/usePatientDashboard'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const {
  allBookings,
  availableSlots,
  isLoading,
  error,
  fetchAllBookings,
  fetchAvailableDates,
  fetchAvailableSlots,
  cancelAppointment,
  rescheduleBooking,
  openBookingFlow,
  closeBookingFlow,
  bookingFlowOpen,
  bookingStep,
  bookingSessionType,
  bookingFlowDate,
  bookingFlowSlots,
  bookingFlowTime,
  bookingFlowLoading,
  bookingFlowError,
  bookingFlowSuccess,
  bookingFlowBookingId,
  setBookingSessionType,
  goBookingStep,
  fetchBookingFlowSlots,
  selectBookingFlowTime,
  submitBookingFlow,
  retryBookingPayment,
} = usePatientDashboard()
const { isHoliday } = useHolidays()
const { toast } = useToast()

type MainView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

const currentView = ref<MainView>('dayGridMonth')
const anchorDate = ref(new Date())
const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)
const calendarKey = ref(0)
const now = ref(Date.now())
const loadedMonthKey = ref('')
const knownAvailable = ref<Set<string>>(new Set())

// Sidebar mini calendar month (0-11)
const todayDate = new Date()
const miniYear = ref(todayDate.getFullYear())
const miniMonth = ref(todayDate.getMonth())

// Booking flow mini calendar month
const flowYear = ref(todayDate.getFullYear())
const flowMonth = ref(todayDate.getMonth())

// Detail panel state
const detailAppt = ref<Appointment | null>(null)
const cancelling = ref(false)
const cancelConfirm = ref(false)
const rsOpen = ref(false)
const rsDate = ref('')
const rsSlots = ref<AvailableSlot[]>([])
const rsTime = ref<string | null>(null)
const rsLoading = ref(false)
const rsError = ref<string | null>(null)

let nowTimer: ReturnType<typeof setInterval> | null = null

// Bookings per day for screen-reader labels (dots alone must not carry meaning).
const bookingsByDate = computed(() => {
  const map = new Map<string, number>()
  for (const a of allBookings.value) map.set(a.date, (map.get(a.date) ?? 0) + 1)
  return map
})

function miniAria(cell: MiniCell): string {
  const label = new Date(`${cell.dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const parts = [label]
  const n = bookingsByDate.value.get(cell.dateStr) ?? 0
  if (n > 0) parts.push(n === 1 ? '1 booking' : `${n} bookings`)
  if (cell.isAvailable) parts.push('available to book')
  if (cell.isSelected) parts.push('selected')
  return parts.join(', ')
}

function focusPanelButton(testid: string) {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.focus()
  })
}

function onEscapeKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (bookingFlowOpen.value) closeBookingFlow()
  else if (detailAppt.value) closeDetail()
}

watch(detailAppt, (v) => {
  if (v) focusPanelButton('detail-close')
})

watch(bookingFlowOpen, (v) => {
  if (v) focusPanelButton('flow-close')
})

// ── helpers ──────────────────────────────────────────────

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

function sessionTypeOf(appt: Appointment): BookingSessionType {
  return appt.sessionType ?? 'ONLINE'
}

function parseDateTime(dateISO: string, time: string): Date {
  const [y, m, d] = dateISO.split('-').map((v) => parseInt(v, 10))
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  return new Date(y, (m || 1) - 1, d, hh || 0, mm || 0, 0, 0)
}

function sessionStart(appt: Appointment): Date {
  return parseDateTime(appt.date, appt.startTime)
}

function sessionEnd(appt: Appointment): Date {
  return parseDateTime(appt.date, appt.endTime)
}

function sessionMinutes(appt: Appointment): number {
  return Math.max(0, Math.round((sessionEnd(appt).getTime() - sessionStart(appt).getTime()) / 60000))
}

function canJoin(appt: Appointment): boolean {
  const t = now.value
  return (
    t >= sessionStart(appt).getTime() - 5 * 60 * 1000 &&
    t <= sessionEnd(appt).getTime() + 15 * 60 * 1000
  )
}

function canModify(appt: Appointment): boolean {
  return appt.status !== 'CANCELLED' && now.value < sessionStart(appt).getTime() - 24 * 60 * 60 * 1000
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

function formatShort(appt: Appointment): string {
  const label = new Date(`${appt.date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return `${label} · ${formatTime(appt.startTime)}`
}

function statusLabel(status: string): string {
  if (status === 'CONFIRMED') return 'Confirmed'
  if (status === 'PENDING') return 'Pending'
  return 'Cancelled'
}

function mergeAvailable(dates: string[]) {
  const next = new Set(knownAvailable.value)
  for (const d of dates) next.add(d)
  knownAvailable.value = next
}

// ── calendar events ──────────────────────────────────────

function chipColors(appt: Appointment): { backgroundColor: string; borderColor: string; textColor: string; className: string } {
  const type = sessionTypeOf(appt)
  if (appt.status === 'CANCELLED') {
    return { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB', textColor: '#6B7280', className: 'fc-event-cancelled fc-chip-cancelled' }
  }
  if (appt.status === 'PENDING') {
    return { backgroundColor: '#FEF9C3', borderColor: '#FDE047', textColor: '#2D2D2D', className: 'fc-event-pending fc-chip-pending' }
  }
  if (type === 'IN_CLINIC') {
    return { backgroundColor: '#FCE4F3', borderColor: '#F9A8D4', textColor: '#2D2D2D', className: 'fc-event-confirmed fc-chip-clinic' }
  }
  return { backgroundColor: '#FCE4F3', borderColor: '#F9A8D4', textColor: '#2D2D2D', className: 'fc-event-confirmed fc-chip-online' }
}

const calendarEvents = computed(() =>
  allBookings.value.map((a) => {
    const c = chipColors(a)
    const label = sessionTypeOf(a) === 'IN_CLINIC' ? 'In-Clinic' : 'Online'
    return {
      id: a.id,
      title: `${formatTime(a.startTime)} · ${label}`,
      start: `${a.date}T${a.startTime}:00`,
      end: `${a.date}T${a.endTime}:00`,
      backgroundColor: c.backgroundColor,
      borderColor: c.borderColor,
      textColor: c.textColor,
      classNames: [c.className],
    }
  }),
)

function renderEventContent(arg: EventContentArg) {
  const isCancelled = arg.event.classNames.includes('fc-chip-cancelled')
  const isPending = arg.event.classNames.includes('fc-chip-pending')
  const isClinic = arg.event.classNames.includes('fc-chip-clinic')
  const title = arg.event.title
  const strike = isCancelled ? 'line-through opacity-60' : ''

  if (arg.view.type === 'dayGridMonth') {
    let dotBg = '#E91E8C'
    if (isPending) dotBg = '#F59E0B'
    if (isCancelled) dotBg = '#9CA3AF'

    return {
      html: `
        <div class="fc-chip flex items-center gap-1.5 px-2 py-0.5 rounded text-xs truncate w-full cursor-pointer ${strike}">
          <span class="size-2 rounded-full shrink-0" style="background-color: ${dotBg}"></span>
          <span class="font-medium truncate text-foreground">${title}</span>
        </div>
      `,
    }
  }

  // Week / Day view card (matching admin timeGrid cards)
  return {
    html: `
      <div class="fc-chip h-full w-full p-2 flex flex-col justify-between overflow-hidden leading-snug cursor-pointer ${strike}">
        <div class="min-w-0">
          <div class="font-bold text-xs text-foreground truncate">${title}</div>
          <div class="text-[11px] truncate mt-0.5 ${isPending ? 'text-amber-700 dark:text-amber-300 font-semibold' : 'text-foreground/80'}">
            ${isClinic ? '🏥 In-Clinic' : '💻 Online'}
          </div>
        </div>
        <div class="flex items-center justify-between text-[10px] opacity-75 font-mono mt-1">
          <span>${formatTime(arg.event.startStr.slice(11, 16))}</span>
          ${isPending ? '<span class="text-amber-600 dark:text-amber-400 font-bold">⚠️</span>' : ''}
        </div>
      </div>
    `,
  }
}

function dayCellClass(info: DayCellContentArg): string[] {
  const dateStr = toISODate(info.date)
  const classes: string[] = []
  if (isPastStr(dateStr)) classes.push('fc-past', 'bg-white/[0.02]')
  else if (knownAvailable.value.has(dateStr)) classes.push('fc-can-book')
  const hasPending = allBookings.value.some((b) => b.date === dateStr && b.status === 'PENDING')
  if (hasPending) classes.push('fc-day-has-pending')
  return classes
}

// ── navigation / data loading ────────────────────────────

function calendarApi() {
  return (calendarRef.value as unknown as { getApi?: () => { prev: () => void; next: () => void; today: () => void; gotoDate: (d: string) => void; changeView: (v: string) => void; getDate: () => Date } } | null)?.getApi?.() ?? null
}

async function loadMonthDates(month: number, year: number) {
  const dates = await fetchAvailableDates(month, year)
  mergeAvailable(dates)
}

async function onDatesSet(info: DatesSetArg) {
  const anchor = info.view.calendar.getDate()
  anchorDate.value = anchor
  if (currentView.value !== (info.view.type as MainView)) {
    currentView.value = (info.view.type as MainView)
  }
  if (currentView.value === 'dayGridMonth') {
    const key = `${anchor.getFullYear()}-${anchor.getMonth() + 1}`
    if (key !== loadedMonthKey.value) {
      loadedMonthKey.value = key
      await loadMonthDates(anchor.getMonth() + 1, anchor.getFullYear())
      calendarKey.value += 1
    }
  } else {
    await fetchAvailableSlots(toISODate(anchor))
  }
}

async function onDateClick(info: DateClickArg) {
  const target = info.jsEvent?.target as HTMLElement | null
  if (target && typeof target.closest === 'function' && target.closest('.fc-event')) return
  if (info.date.getMonth() !== anchorDate.value.getMonth() || info.date.getFullYear() !== anchorDate.value.getFullYear()) return
  const dateStr = toISODate(info.date)
  if (isPastStr(dateStr)) return
  if (isHoliday(dateStr)) {
    toast({ title: 'Clinic closed for a public holiday', variant: 'info' })
    return
  }
  anchorDate.value = info.date
  closeDetail()
  flowYear.value = info.date.getFullYear()
  flowMonth.value = info.date.getMonth()
  openBookingFlow(dateStr)
}

function onEventClick(info: EventClickArg) {
  const found = allBookings.value.find((a) => a.id === info.event.id)
  if (found) openDetail(found)
}

function onEventMount(info: { el: HTMLElement; event: { id: string } }) {
  info.el.dataset.bookingId = info.event.id
}

function changeView(view: MainView) {
  currentView.value = view
  calendarApi()?.changeView(view)
}

function onNav(dir: number) {
  if (currentView.value === 'dayGridMonth') {
    const d = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth() + dir, 1)
    anchorDate.value = d
    calendarApi()?.gotoDate(toISODate(d))
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (key !== loadedMonthKey.value) {
      loadedMonthKey.value = key
      void loadMonthDates(d.getMonth() + 1, d.getFullYear()).then(() => {
        calendarKey.value += 1
      })
    }
  } else if (dir === 0) {
    goToday()
  } else {
    if (dir < 0) calendarApi()?.prev()
    else calendarApi()?.next()
  }
}

function goToday() {
  const t = new Date()
  anchorDate.value = t
  calendarApi()?.today()
  const key = `${t.getFullYear()}-${t.getMonth() + 1}`
  if (currentView.value === 'dayGridMonth' && key !== loadedMonthKey.value) {
    loadedMonthKey.value = key
    void loadMonthDates(t.getMonth() + 1, t.getFullYear()).then(() => {
      calendarKey.value += 1
    })
  }
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

// ── mini month grid builder (sidebar + flow share it) ────

interface MiniCell {
  dateStr: string
  dayNum: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  hasBookings: boolean
  isAvailable: boolean
}

function buildMonthCells(year: number, month: number, selected: string, withBookings: boolean): MiniCell[] {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const today = todayStr()
  const bookingSet = new Set(allBookings.value.map((a) => a.date))
  const cells: MiniCell[] = []
  for (let i = firstDow - 1; i >= 0; i--) {
    const day = daysInPrev - i
    const str = toISODate(new Date(year, month - 1, day))
    cells.push({
      dateStr: str,
      dayNum: day,
      isCurrentMonth: false,
      isToday: str === today,
      isSelected: str === selected,
      hasBookings: withBookings && bookingSet.has(str),
      isAvailable: knownAvailable.value.has(str),
    })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const str = toISODate(new Date(year, month, day))
    cells.push({
      dateStr: str,
      dayNum: day,
      isCurrentMonth: true,
      isToday: str === today,
      isSelected: str === selected,
      hasBookings: withBookings && bookingSet.has(str),
      isAvailable: knownAvailable.value.has(str),
    })
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - (firstDow + daysInMonth) + 1
    const next = new Date(year, month + 1, day)
    const str = toISODate(next)
    cells.push({
      dateStr: str,
      dayNum: next.getDate(),
      isCurrentMonth: false,
      isToday: str === today,
      isSelected: str === selected,
      hasBookings: withBookings && bookingSet.has(str),
      isAvailable: knownAvailable.value.has(str),
    })
  }
  return cells
}

const miniWeekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const miniMonthLabel = computed(
  () => new Date(miniYear.value, miniMonth.value, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
)
const miniCells = computed(() => buildMonthCells(miniYear.value, miniMonth.value, toISODate(anchorDate.value), true))

function miniNav(dir: number) {
  const d = new Date(miniYear.value, miniMonth.value + dir, 1)
  miniYear.value = d.getFullYear()
  miniMonth.value = d.getMonth()
  void loadMonthDates(d.getMonth() + 1, d.getFullYear())
}

function selectMiniDate(dateStr: string) {
  if (isPastStr(dateStr)) return
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10))
  const dt = new Date(y, (m || 1) - 1, d)
  anchorDate.value = dt
  miniYear.value = dt.getFullYear()
  miniMonth.value = dt.getMonth()
  calendarApi()?.gotoDate(dateStr)
  if (currentView.value !== 'dayGridMonth') {
    void fetchAvailableSlots(dateStr)
  }
}

// ── upcoming sessions ────────────────────────────────────

const upcomingThree = computed(() => {
  const t = now.value
  return allBookings.value
    .filter((a) => a.status === 'CONFIRMED' && sessionStart(a).getTime() >= t - 60 * 60 * 1000)
    .sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime())
    .slice(0, 3)
})

// ── detail panel ─────────────────────────────────────────

function openDetail(appt: Appointment) {
  detailAppt.value = appt
  cancelConfirm.value = false
  rsOpen.value = false
  rsError.value = null
  if (bookingFlowOpen.value) closeBookingFlow()
}

function closeDetail() {
  detailAppt.value = null
  cancelConfirm.value = false
  rsOpen.value = false
  rsError.value = null
}

function joinSession(appt: Appointment) {
  navigateTo(`/dashboard/session/${appt.id}`)
}

async function openReschedule() {
  if (!detailAppt.value) return
  rsOpen.value = true
  rsError.value = null
  rsDate.value = detailAppt.value.date
  rsTime.value = null
  rsLoading.value = true
  try {
    rsSlots.value = await fetchAvailableSlots(detailAppt.value.date)
  } catch (e) {
    rsError.value = (e as { data?: { message?: string } }).data?.message || 'Could not load available slots'
    rsSlots.value = []
  } finally {
    rsLoading.value = false
  }
}

async function onRsDateChange() {
  if (!rsDate.value) return
  rsTime.value = null
  rsLoading.value = true
  rsError.value = null
  try {
    rsSlots.value = await fetchAvailableSlots(rsDate.value)
  } catch (e) {
    rsError.value = (e as { data?: { message?: string } }).data?.message || 'Could not load available slots'
    rsSlots.value = []
  } finally {
    rsLoading.value = false
  }
}

async function submitReschedule() {
  if (!detailAppt.value || !rsDate.value || !rsTime.value) return
  rsLoading.value = true
  rsError.value = null
  try {
    const prevType = sessionTypeOf(detailAppt.value)
    const updated = await rescheduleBooking(detailAppt.value.id, rsDate.value, rsTime.value)
    detailAppt.value = { ...updated, sessionType: updated.sessionType ?? prevType }
    rsOpen.value = false
    toast({ title: 'Appointment updated', variant: 'success' })
    await fetchAllBookings()
    calendarKey.value += 1
  } catch (e) {
    rsError.value = (e as { data?: { message?: string } }).data?.message || 'Could not update appointment'
  } finally {
    rsLoading.value = false
  }
}

async function confirmCancel() {
  if (!detailAppt.value) return
  cancelling.value = true
  try {
    await cancelAppointment(detailAppt.value.id)
    detailAppt.value = { ...detailAppt.value, status: 'CANCELLED' }
    cancelConfirm.value = false
    toast({ title: 'Appointment cancelled', variant: 'success' })
    await fetchAllBookings()
    calendarKey.value += 1
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not cancel appointment',
      variant: 'destructive',
    })
  } finally {
    cancelling.value = false
  }
}

// ── booking flow panel ───────────────────────────────────

async function bookSlot(dateStr: string, time?: string) {
  closeDetail()
  flowYear.value = parseInt(dateStr.slice(0, 4), 10)
  flowMonth.value = parseInt(dateStr.slice(5, 7), 10) - 1
  openBookingFlow(dateStr)
  goBookingStep(2)
  if (time) {
    await fetchBookingFlowSlots(dateStr)
    selectBookingFlowTime(time)
  }
}

function openNewBooking() {
  closeDetail()
  const d = new Date()
  flowYear.value = d.getFullYear()
  flowMonth.value = d.getMonth()
  openBookingFlow(toISODate(anchorDate.value) >= todayStr() ? toISODate(anchorDate.value) : todayStr())
}

const flowMonthLabel = computed(
  () => new Date(flowYear.value, flowMonth.value, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
)
const flowCells = computed(() =>
  buildMonthCells(flowYear.value, flowMonth.value, bookingFlowDate.value ?? '', false),
)

function flowNav(dir: number) {
  const d = new Date(flowYear.value, flowMonth.value + dir, 1)
  flowYear.value = d.getFullYear()
  flowMonth.value = d.getMonth()
  void loadMonthDates(d.getMonth() + 1, d.getFullYear())
}

async function selectFlowDate(dateStr: string) {
  if (isPastStr(dateStr)) return
  if (!knownAvailable.value.has(dateStr) && !bookingFlowSlots.value.length) {
    // Still allow selecting — the slot fetch will confirm availability.
  }
  await fetchBookingFlowSlots(dateStr)
}

const flowSelectedSlot = computed(
  () => bookingFlowSlots.value.find((s) => s.startTime === bookingFlowTime.value) ?? null,
)

function flowEndTime(): string {
  if (flowSelectedSlot.value) return flowSelectedSlot.value.endTime
  if (!bookingFlowTime.value) return ''
  const [h, m] = bookingFlowTime.value.split(':').map((v) => parseInt(v, 10))
  const end = (h || 0) * 60 + (m || 0) + 60
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

function flowDuration(): number {
  return flowSelectedSlot.value?.sessionDuration ?? 60
}

async function submitFlow() {
  const result = await submitBookingFlow()
  if (!result) return
  if (result.sessionType === 'IN_CLINIC') {
    // Success state renders inside the panel from bookingFlowSuccess.
    calendarKey.value += 1
  }
}

async function retryFlowPayment() {
  if (!bookingFlowBookingId.value) return
  await retryBookingPayment(bookingFlowBookingId.value)
}

function viewAppointments() {
  closeBookingFlow()
  void fetchAllBookings().then(() => {
    calendarKey.value += 1
  })
}

// Month view "+N more" click behavior
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
  eventDidMount: onEventMount,
  dayCellClassNames: dayCellClass,
  dateClick: onDateClick,
  eventClick: onEventClick,
  datesSet: onDatesSet,
}))

onMounted(async () => {
  now.value = Date.now()
  nowTimer = setInterval(() => {
    now.value = Date.now()
  }, 60 * 1000)
  window.addEventListener('keydown', onEscapeKey)
  const t = new Date()
  const key = `${t.getFullYear()}-${t.getMonth() + 1}`
  loadedMonthKey.value = key
  await Promise.all([fetchAllBookings(), loadMonthDates(t.getMonth() + 1, t.getFullYear())])
  calendarKey.value += 1
})

onBeforeUnmount(() => {
  if (nowTimer) {
    clearInterval(nowTimer)
    nowTimer = null
  }
  window.removeEventListener('keydown', onEscapeKey)
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1200px]">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-balance text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
          My Appointments
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">Your bookings and open times, all in one calendar.</p>
      </div>
    </div>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div class="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <!-- ── Left sidebar ─────────────────────────────── -->
      <aside class="flex flex-col gap-6">
        <Card class="overflow-hidden">
          <CardContent class="p-4">
            <div class="mb-2 flex items-center justify-between">
              <Button variant="ghost" size="sm" aria-label="Previous month" @click="miniNav(-1)">
                <ChevronLeft class="size-4" aria-hidden="true" />
              </Button>
              <p class="text-sm font-semibold text-foreground" data-testid="mini-month">{{ miniMonthLabel }}</p>
              <Button variant="ghost" size="sm" aria-label="Next month" @click="miniNav(1)">
                <ChevronRight class="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div data-testid="mini-calendar">
              <div class="grid grid-cols-7 text-center text-xs text-muted-foreground">
                <span v-for="d in miniWeekdays" :key="d" class="py-1">{{ d }}</span>
              </div>
              <div class="grid grid-cols-7 gap-0.5 text-center">
                <button
                  v-for="cell in miniCells"
                  :key="cell.dateStr + (cell.isCurrentMonth ? '-m' : '-o')"
                  type="button"
                  class="mini-day relative flex min-h-10 flex-col items-center justify-center rounded-xl px-1 py-1 text-sm transition-colors duration-150 ease-out"
                  :class="[
                    cell.isSelected ? 'bg-primary/10 font-semibold text-primary' : '',
                    !cell.isCurrentMonth ? 'text-muted-foreground/50' : 'text-foreground',
                    cell.isToday && !cell.isSelected ? 'font-semibold text-primary' : '',
                    cell.isAvailable && cell.isCurrentMonth ? 'ring-1 ring-primary/40' : '',
                    isPastStr(cell.dateStr) ? 'bg-white/[0.02]' : 'hover:bg-secondary',
                  ]"
                  :aria-label="miniAria(cell)"
                  :data-testid="`mini-day-${cell.dateStr}`"
                  @click="selectMiniDate(cell.dateStr)"
                >
                  <span
                    class="flex size-6 items-center justify-center rounded-full"
                    :class="cell.isToday ? 'bg-primary text-primary-foreground' : ''"
                  >
                    {{ cell.dayNum }}
                  </span>
                  <span v-if="cell.hasBookings" class="mt-0.5 size-1.5 rounded-full bg-primary" data-testid="mini-booking-dot"></span>
                  <span v-else class="mt-0.5 size-1.5"></span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="overflow-hidden">
          <CardContent class="p-4">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-foreground">Upcoming Sessions</h2>
              <span v-if="upcomingThree.length > 0" class="text-xs text-muted-foreground tabular-nums">
                {{ upcomingThree.length }} session{{ upcomingThree.length === 1 ? '' : 's' }}
              </span>
            </div>
            <div v-if="upcomingThree.length > 0" class="mt-3 grid gap-2.5">
              <button
                v-for="appt in upcomingThree"
                :key="appt.id"
                type="button"
                class="group rounded-2xl border border-border/80 bg-card p-3.5 text-left transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-primary/40 hover:bg-secondary/30 hover:shadow-medium"
                :data-testid="`upcoming-${appt.id}`"
                @click="openDetail(appt)"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="truncate text-sm font-semibold tabular-nums text-foreground">{{ formatShort(appt) }}</p>
                  <ChevronRight class="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </div>
                <p class="mt-1 truncate text-xs text-muted-foreground">
                  {{ appt.doctorId && appt.doctorName && appt.doctorName !== 'Unknown Doctor' ? appt.doctorName : 'Counselor to be assigned' }}
                </p>
                <div class="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" class="bg-primary/10 text-primary font-medium">
                    {{ sessionTypeOf(appt) === 'IN_CLINIC' ? 'In-Clinic' : 'Online' }}
                  </Badge>
                  <Badge
                    :class="appt.status === 'CONFIRMED'
                      ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300'"
                    :data-testid="`upcoming-status-${appt.id}`"
                  >
                    {{ statusLabel(appt.status) }}
                  </Badge>
                </div>
              </button>
            </div>
            <div v-else class="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center" data-testid="upcoming-empty">
              <div class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarIcon class="size-4 text-primary" aria-hidden="true" />
              </div>
              <p class="mt-2 text-xs font-medium text-foreground">No upcoming sessions</p>
              <p class="mt-0.5 text-xs text-muted-foreground">Whenever you need guidance, we're here.</p>
              <Button variant="ghost" size="sm" class="mt-3 px-2 rounded-xl" @click="openNewBooking">
                <Plus class="size-4" aria-hidden="true" />
                Book a Session
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button class="w-full shadow-magenta h-12 text-sm font-semibold" data-testid="book-session" @click="openNewBooking">
          <Plus class="size-4" aria-hidden="true" />
          Book a Session
        </Button>
      </aside>

      <!-- ── Main calendar ────────────────────────────── -->
      <section class="flex min-w-0 flex-1 flex-col">
        <Card class="flex flex-1 flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-5 shadow-soft overflow-hidden">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div class="flex flex-wrap items-center gap-2 sm:gap-3">
              <!-- Prev, Today, Next Nav Buttons (matching admin calendar) -->
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

              <!-- Range label matching admin -->
              <div class="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarIcon class="size-4 text-primary" aria-hidden="true" />
                <span data-testid="calendar-label">{{ headerLabel }}</span>
              </div>
            </div>

            <!-- View Switcher (Monthly / Weekly / Daily) matching admin -->
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

          <div v-if="isLoading && allBookings.length === 0" class="grid gap-3">
            <Skeleton v-for="i in 3" :key="i" class="h-24 w-full" />
          </div>
          <ClientOnly v-else>
            <FullCalendar :key="calendarKey" ref="calendarRef" :options="calendarOptions" />
            <template #fallback>
              <div class="py-10 text-center text-sm text-muted-foreground">Loading calendar schedule…</div>
            </template>
          </ClientOnly>

          <!-- Calendar Status Legend matching admin styling -->
          <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground" data-testid="calendar-legend">
            <span class="font-semibold text-foreground/80">Status:</span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-[#E91E8C]" />
              <span>Online confirmed</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-sm bg-[#FCE4F3] border border-[#E91E8C]" />
              <span>In-clinic confirmed</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-full bg-[#F59E0B]" />
              <span>Pending</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="inline-flex size-3.5 items-center justify-center rounded-full border border-primary/50 text-[10px] leading-none text-primary font-bold">+</span>
              <span>Available — click to book</span>
            </span>
          </div>

            <!-- Available slot strip for week / day views -->
            <div v-if="currentView !== 'dayGridMonth'" class="mt-4 rounded-2xl border border-dashed border-primary/40 bg-card p-4" data-testid="day-slots-strip">
              <p class="text-sm font-medium text-foreground">
                {{ currentView === 'timeGridDay' ? 'Available slots on this day' : `Available slots on ${formatDateLabel(toISODate(anchorDate))}` }}
              </p>
              <div v-if="availableSlots.length > 0" class="mt-3 flex flex-col gap-2">
                <button
                  v-for="slot in availableSlots"
                  :key="slot.startTime"
                  type="button"
                  class="slot-row flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-dashed border-primary/40 px-4 py-2.5 text-sm text-foreground transition-colors duration-150 ease-out hover:bg-secondary"
                  :data-testid="`day-slot-${slot.startTime}`"
                  @click="bookSlot(toISODate(anchorDate), slot.startTime)"
                >
                  <span class="inline-flex items-center gap-2">
                    <Plus class="size-4 text-primary" aria-hidden="true" />
                    {{ formatTime(slot.startTime) }} – {{ formatTime(slot.endTime) }}
                  </span>
                  <span class="text-xs text-muted-foreground">Available — Book this slot</span>
                </button>
              </div>
              <p v-else class="mt-2 text-sm text-muted-foreground">No open times on this day. Try another date.</p>
            </div>
        </Card>
      </section>
    </div>

    <!-- ── Right panel: booking detail ─────────────────── -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="detailAppt" class="fixed inset-0 z-50" data-testid="booking-detail">
          <div class="backdrop absolute inset-0 bg-black/30" @click="closeDetail"></div>
          <div
            class="sheet absolute overscroll-contain overflow-y-auto bg-card shadow-strong inset-x-0 bottom-0 max-h-[92vh] rounded-t-[20px] p-5 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[380px] sm:rounded-none sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Session details"
          >
            <div class="sticky top-0 z-10 -mt-1 bg-card/95 pb-3 pt-1 backdrop-blur-sm">
              <div class="flex items-start justify-between gap-2">
            <div>
              <h2 class="text-balance text-lg font-semibold text-foreground">Session Details</h2>
              <Badge
                class="mt-1.5"
                :class="detailAppt.status === 'CONFIRMED'
                  ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300'
                  : detailAppt.status === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-muted dark:text-muted-foreground'"
                :data-testid="`detail-status-${detailAppt.id}`"
              >
                {{ statusLabel(detailAppt.status) }}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" aria-label="Close details" data-testid="detail-close" @click="closeDetail">
              <X class="size-5" aria-hidden="true" />
            </Button>
              </div>
            </div>

          <!-- Counselor Profile Card -->
          <div class="mt-4 flex items-center gap-3.5 rounded-2xl border border-border/80 bg-muted/20 p-3.5">
            <div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-semibold">
              <User v-if="!detailAppt.doctorId || detailAppt.doctorName === 'Unknown Doctor'" class="size-5" aria-hidden="true" />
              <span v-else class="text-sm uppercase">{{ detailAppt.doctorName.slice(0, 2) }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-foreground">
                {{ detailAppt.doctorId && detailAppt.doctorName && detailAppt.doctorName !== 'Unknown Doctor' ? detailAppt.doctorName : 'Counselor to be assigned' }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ detailAppt.service || 'Mental Health Counseling' }}
              </p>
            </div>
          </div>

          <p class="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session info</p>
          <div class="mt-2.5 grid gap-2 text-sm">
            <div class="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarIcon class="size-4 shrink-0 text-primary" aria-hidden="true" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-medium text-muted-foreground">Date</p>
                <p class="truncate text-sm font-medium text-foreground">{{ formatDateLabel(detailAppt.date) }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock class="size-4 shrink-0 text-primary" aria-hidden="true" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-medium text-muted-foreground">Time</p>
                <p class="truncate text-sm font-medium tabular-nums text-foreground">
                  {{ formatTime(detailAppt.startTime) }} – {{ formatTime(detailAppt.endTime) }} ({{ sessionMinutes(detailAppt) }} min)
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <component :is="sessionTypeOf(detailAppt) === 'IN_CLINIC' ? Stethoscope : Video" class="size-4 shrink-0 text-primary" aria-hidden="true" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-medium text-muted-foreground">Format</p>
                <p class="truncate text-sm font-medium text-foreground">
                  {{ sessionTypeOf(detailAppt) === 'IN_CLINIC' ? 'In-Clinic' : 'Online' }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard class="size-4 shrink-0 text-primary" aria-hidden="true" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-medium text-muted-foreground">Payment</p>
                <p class="truncate text-sm font-medium text-foreground">
                  {{ sessionTypeOf(detailAppt) === 'IN_CLINIC' ? 'Cash at clinic' : 'Online payment' }}
                </p>
              </div>
            </div>

            <div
              v-if="detailAppt.status === 'PENDING' && !detailAppt.doctorId"
              class="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <p class="font-medium">Waiting for admin confirmation</p>
              <p class="mt-0.5 text-amber-800/80 dark:text-amber-300/80">You'll receive an email once your counselor is assigned.</p>
            </div>
          </div>

          <p class="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
          <p class="mt-1.5 flex items-center gap-2 text-sm text-foreground">
            <span
              class="size-2.5 rounded-full"
              :class="detailAppt.status === 'CONFIRMED' ? 'bg-green-600' : detailAppt.status === 'PENDING' ? 'bg-yellow-500' : 'bg-slate-400'"
            ></span>
            {{ detailAppt.status === 'CONFIRMED' ? 'Confirmed' : detailAppt.status === 'PENDING' ? 'Pending review' : 'Cancelled' }}
          </p>

          <div class="my-4 border-t border-border"></div>

          <div v-if="detailAppt.status === 'CONFIRMED' && sessionTypeOf(detailAppt) === 'ONLINE'">
            <Button
              class="w-full"
              :variant="canJoin(detailAppt) ? 'default' : 'secondary'"
              :disabled="!canJoin(detailAppt)"
              :title="!canJoin(detailAppt) ? 'Available 5 minutes before your session' : undefined"
              :data-testid="`join-${detailAppt.id}`"
              @click="joinSession(detailAppt!)"
            >
              <Video class="size-4" aria-hidden="true" />
              Join Session
            </Button>
            <p v-if="!canJoin(detailAppt)" class="mt-1.5 text-center text-xs text-muted-foreground">
              Available 5 minutes before your session
            </p>
          </div>

          <div class="my-4 border-t border-border"></div>

          <div v-if="detailAppt.status !== 'CANCELLED'" class="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              :disabled="!canModify(detailAppt)"
              :title="!canModify(detailAppt) ? 'Available up to 24 hours before your session' : undefined"
              data-testid="detail-reschedule"
              @click="rsOpen ? (rsOpen = false) : openReschedule()"
            >
              Edit
            </Button>
            <Button
              variant="outline"
              :disabled="!canModify(detailAppt)"
              :title="!canModify(detailAppt) ? 'Available up to 24 hours before your session' : undefined"
              data-testid="detail-cancel"
              @click="cancelConfirm = true"
            >
              Cancel
            </Button>
          </div>
          <p v-if="detailAppt.status !== 'CANCELLED' && !canModify(detailAppt)" class="mt-1.5 text-center text-xs text-muted-foreground">
            Changes close 24 hours before your session
          </p>

          <!-- Inline reschedule picker -->
          <div v-if="rsOpen && canModify(detailAppt)" class="mt-4 rounded-2xl border border-border p-4" data-testid="reschedule-box">
            <p class="text-sm font-medium text-foreground">Pick a new date and time</p>
            <label class="mt-3 block text-xs text-muted-foreground" for="rs-date">Date</label>
            <input
              id="rs-date"
              v-model="rsDate"
              type="date"
              name="reschedule-date"
              autocomplete="off"
              :min="todayStr()"
              class="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              data-testid="reschedule-date"
              @change="onRsDateChange"
            />
            <div v-if="rsLoading" class="mt-3 grid gap-2">
              <Skeleton v-for="i in 3" :key="i" class="h-10 w-full" />
            </div>
            <div v-else-if="rsSlots.length > 0" class="mt-3 flex flex-wrap gap-2">
              <Button
                v-for="slot in rsSlots"
                :key="slot.startTime"
                :variant="rsTime === slot.startTime ? 'default' : 'outline'"
                size="sm"
                class="min-h-11"
                :aria-pressed="rsTime === slot.startTime"
                :data-testid="`reschedule-slot-${slot.startTime}`"
                @click="rsTime = slot.startTime"
              >
                {{ formatTime(slot.startTime) }}
              </Button>
            </div>
            <p v-else class="mt-3 text-sm text-muted-foreground">No open times on this day. Try another date.</p>
            <p v-if="rsError" class="mt-2 text-sm text-destructive" aria-live="polite" data-testid="reschedule-error">{{ rsError }}</p>
            <Button
              class="mt-3 w-full"
              :disabled="!rsTime || rsLoading"
              data-testid="reschedule-confirm"
              @click="submitReschedule"
            >
              {{ rsLoading ? 'Saving…' : 'Confirm new time' }}
            </Button>
          </div>

          <!-- Inline cancel confirmation -->
          <div v-if="cancelConfirm && canModify(detailAppt)" class="mt-4 rounded-2xl border border-destructive/40 p-4" data-testid="cancel-box">
            <p class="text-sm font-medium text-foreground">Are you sure? This cannot be undone if within 24 hours.</p>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" data-testid="cancel-keep" @click="cancelConfirm = false">
                Keep
              </Button>
              <Button variant="destructive" :disabled="cancelling" :data-testid="`cancel-confirm-${detailAppt.id}`" @click="confirmCancel">
                {{ cancelling ? 'Cancelling…' : 'Confirm' }}
              </Button>
            </div>
          </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Right panel: booking flow ───────────────────── -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="bookingFlowOpen" class="fixed inset-0 z-50" data-testid="booking-flow">
          <div class="backdrop absolute inset-0 bg-black/30" @click="closeBookingFlow"></div>
          <div
            class="sheet absolute overscroll-contain overflow-y-auto bg-card shadow-strong inset-x-0 bottom-0 max-h-[92vh] rounded-t-[20px] p-5 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[380px] sm:rounded-none sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Book a session"
          >
            <div class="sticky top-0 z-10 -mt-1 bg-card/95 pb-3 pt-1 backdrop-blur-sm">
              <div class="flex items-start justify-between gap-2">
                <h2 class="text-balance text-lg font-semibold text-foreground">Book a Session</h2>
                <Button variant="ghost" size="sm" aria-label="Close booking" data-testid="flow-close" @click="closeBookingFlow">
                  <X class="size-5" aria-hidden="true" />
                </Button>
              </div>
              <div v-if="!bookingFlowSuccess" class="mt-2" data-testid="flow-progress">
                <p class="text-xs text-muted-foreground" aria-live="polite">Step {{ bookingStep }} of 3</p>
                <div class="mt-1.5 flex gap-1.5" aria-hidden="true">
                  <span
                    v-for="s in 3"
                    :key="s"
                    class="h-1.5 flex-1 rounded-full transition-colors duration-200"
                    :class="s <= bookingStep ? 'bg-primary' : 'bg-secondary'"
                  ></span>
                </div>
              </div>
            </div>

            <!-- Success state (in-clinic / pending) -->
            <div v-if="bookingFlowSuccess" class="flex flex-col items-center py-6 text-center" aria-live="polite" data-testid="flow-success">
            <CheckCircle2 class="size-12 text-green-600" aria-hidden="true" />
            <h3 class="mt-4 text-lg font-semibold text-foreground">Booking Requested</h3>
            <p class="mt-2 text-sm text-muted-foreground">
              Your {{ bookingSessionType === 'IN_CLINIC' ? 'in-clinic visit' : 'session' }} has been requested for
              {{ bookingFlowDate ? formatDateLabel(bookingFlowDate) : '' }}
              {{ bookingFlowTime ? `at ${formatTime(bookingFlowTime)}` : '' }}.
            </p>
            <p class="mt-2 text-sm text-muted-foreground">
              Our team will review and confirm your booking shortly.
              You will receive a confirmation email once a doctor is assigned.
            </p>
            <Button class="mt-6 w-full" data-testid="flow-view-appointments" @click="viewAppointments">
              View My Appointments
            </Button>
          </div>

          <!-- Step 1: session type -->
          <div v-else-if="bookingStep === 1" data-testid="flow-step-1">
            <p class="text-sm font-medium text-foreground">How would you like to meet?</p>
            <p class="mt-0.5 text-xs text-muted-foreground">Choose the format that works best for your schedule.</p>
            <div class="mt-4 grid grid-cols-1 gap-3">
              <button
                type="button"
                class="type-card rounded-2xl border-2 p-4 text-left transition-[border-color,background-color] duration-150 ease-out"
                :class="bookingSessionType === 'ONLINE' ? 'border-primary bg-primary/5 shadow-soft ring-1 ring-primary/20' : 'border-border hover:border-primary/40'"
                :aria-pressed="bookingSessionType === 'ONLINE'"
                data-testid="flow-type-online"
                @click="setBookingSessionType('ONLINE')"
              >
                <div class="flex items-start gap-3.5">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Video class="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-foreground">Online Session</p>
                    <p class="mt-1 text-xs text-muted-foreground leading-relaxed">Video call, online payment required</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                class="type-card rounded-2xl border-2 p-4 text-left transition-[border-color,background-color] duration-150 ease-out"
                :class="bookingSessionType === 'IN_CLINIC' ? 'border-primary bg-primary/5 shadow-soft ring-1 ring-primary/20' : 'border-border hover:border-primary/40'"
                :aria-pressed="bookingSessionType === 'IN_CLINIC'"
                data-testid="flow-type-inclinic"
                @click="setBookingSessionType('IN_CLINIC')"
              >
                <div class="flex items-start gap-3.5">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Stethoscope class="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-foreground">In-Clinic Visit</p>
                    <p class="mt-1 text-xs text-muted-foreground leading-relaxed">Visit in person, cash payment at clinic</p>
                  </div>
                </div>
              </button>
            </div>
            <div class="sticky bottom-0 -mb-1 mt-6 flex justify-end bg-card/95 py-3 backdrop-blur-sm">
              <Button data-testid="flow-next-1" class="px-7" @click="goBookingStep(2)">Next</Button>
            </div>
          </div>

          <!-- Step 2: date and time -->
          <div v-else-if="bookingStep === 2" data-testid="flow-step-2">
            <p class="text-sm font-medium text-foreground">Select a date and time</p>
            <div class="mt-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" aria-label="Previous month" @click="flowNav(-1)">
                <ChevronLeft class="size-4" aria-hidden="true" />
              </Button>
              <p class="text-sm font-semibold text-foreground">{{ flowMonthLabel }}</p>
              <Button variant="ghost" size="sm" aria-label="Next month" @click="flowNav(1)">
                <ChevronRight class="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div class="mt-1 grid grid-cols-7 text-center text-xs text-muted-foreground">
              <span v-for="d in miniWeekdays" :key="d" class="py-1">{{ d }}</span>
            </div>
            <div class="grid grid-cols-7 gap-0.5 text-center">
              <button
                v-for="cell in flowCells"
                :key="cell.dateStr"
                type="button"
                :disabled="isPastStr(cell.dateStr) || !cell.isCurrentMonth"
                class="flow-day flex min-h-10 flex-col items-center justify-center rounded-xl px-1 py-1 text-sm transition-colors duration-150 ease-out disabled:cursor-not-allowed"
                :class="[
                  cell.dateStr === bookingFlowDate ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground',
                  cell.isAvailable && cell.isCurrentMonth ? 'ring-1 ring-primary/40' : '',
                  isPastStr(cell.dateStr) ? 'bg-white/[0.02]' : (!isPastStr(cell.dateStr) && cell.isCurrentMonth ? 'hover:bg-secondary' : ''),
                ]"
                :aria-label="miniAria(cell)"
                :aria-pressed="cell.dateStr === bookingFlowDate"
                :data-testid="`flow-day-${cell.dateStr}`"
                @click="selectFlowDate(cell.dateStr)"
              >
                {{ cell.dayNum }}
              </button>
            </div>

            <div class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class="inline-block size-3 rounded-md ring-1 ring-primary/40"></span>
              Days with open times
            </div>

            <div v-if="bookingFlowDate" class="mt-4">
              <p class="text-sm text-muted-foreground">
                Available times on {{ formatDateLabel(bookingFlowDate) }}:
              </p>
              <div v-if="bookingFlowLoading" class="mt-2 grid gap-2">
                <Skeleton v-for="i in 3" :key="i" class="h-10 w-full" />
              </div>
              <div v-else-if="bookingFlowSlots.length > 0" class="mt-2 flex flex-wrap gap-2">
                <Button
                  v-for="slot in bookingFlowSlots"
                  :key="slot.startTime"
                  :variant="bookingFlowTime === slot.startTime ? 'default' : 'outline'"
                  size="sm"
                  class="min-h-11"
                  :aria-pressed="bookingFlowTime === slot.startTime"
                  :data-testid="`flow-slot-${slot.startTime}`"
                  @click="selectBookingFlowTime(slot.startTime)"
                >
                  {{ formatTime(slot.startTime) }}
                </Button>
              </div>
              <p v-else class="mt-2 text-sm text-muted-foreground">No open times on this day. Try another date.</p>
            </div>

            <p v-if="bookingFlowError" class="mt-3 text-sm text-destructive" aria-live="polite" data-testid="flow-error">{{ bookingFlowError }}</p>
            <div class="sticky bottom-0 -mb-1 mt-6 flex justify-between bg-card/95 py-3 backdrop-blur-sm">
              <Button variant="ghost" data-testid="flow-back-2" @click="goBookingStep(1)">Back</Button>
              <Button :disabled="!bookingFlowTime" data-testid="flow-next-2" @click="goBookingStep(3)">Next</Button>
            </div>
          </div>

          <!-- Step 3: review -->
          <div v-else data-testid="flow-step-3">
            <p class="text-sm font-semibold text-foreground">Review your booking</p>
            <p class="mt-0.5 text-xs text-muted-foreground">Confirm your appointment information below.</p>
            <div class="mt-3.5 divide-y divide-border/60 rounded-2xl border border-border/80 bg-muted/20 p-4 text-sm">
              <p class="flex justify-between gap-2 py-2 first:pt-0">
                <span class="text-xs text-muted-foreground">Session Type:</span>
                <span class="font-semibold text-foreground">{{ bookingSessionType === 'IN_CLINIC' ? 'In-Clinic' : 'Online' }}</span>
              </p>
              <p class="flex justify-between gap-2 py-2">
                <span class="text-xs text-muted-foreground">Date:</span>
                <span class="font-medium text-foreground">{{ bookingFlowDate ? formatDateLabel(bookingFlowDate) : '' }}</span>
              </p>
              <p class="flex justify-between gap-2 py-2">
                <span class="text-xs text-muted-foreground">Time:</span>
                <span class="font-medium tabular-nums text-foreground">
                  {{ bookingFlowTime ? `${formatTime(bookingFlowTime)} – ${formatTime(flowEndTime())}` : '' }}
                </span>
              </p>
              <p class="flex justify-between gap-2 py-2">
                <span class="text-xs text-muted-foreground">Duration:</span>
                <span class="font-medium tabular-nums text-foreground">{{ flowDuration() }} minutes</span>
              </p>
              <p class="flex justify-between gap-2 py-2 last:pb-0">
                <span class="text-xs text-muted-foreground">Payment:</span>
                <span class="font-semibold text-primary">
                  {{ bookingSessionType === 'IN_CLINIC' ? 'Cash at clinic' : 'Pay online' }}
                </span>
              </p>
            </div>
            <div class="mt-3.5 flex items-start gap-2.5 rounded-xl border border-border/70 bg-card p-3 text-xs text-muted-foreground">
              <ShieldCheck class="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              <p>
                <strong class="font-medium text-foreground">Note:</strong> Your booking will be reviewed by our team.
                You will receive a confirmation once a doctor is assigned.
              </p>
            </div>
            <p v-if="bookingFlowError" class="mt-3 text-sm text-destructive" aria-live="polite" data-testid="flow-error">
              {{ bookingFlowError }}
              <button
                v-if="bookingFlowBookingId && bookingSessionType === 'ONLINE'"
                type="button"
                class="ml-1 underline"
                data-testid="flow-retry-payment"
                @click="retryFlowPayment"
              >
                Retry payment
              </button>
            </p>
            <div class="sticky bottom-0 -mb-1 mt-6 flex justify-between bg-card/95 py-3 backdrop-blur-sm">
              <Button variant="ghost" data-testid="flow-back-3" @click="goBookingStep(2)">Back</Button>
              <Button :disabled="bookingFlowLoading" data-testid="flow-confirm" @click="submitFlow">
                {{ bookingFlowLoading ? 'Processing…' : bookingSessionType === 'IN_CLINIC' ? 'Request Booking' : 'Confirm & Pay' }}
              </Button>
            </div>
          </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
/* Slide-in panel motion: fade the backdrop, slide + fade the sheet.
   Strong ease-out on enter; snapped shorter exit (deliberate in, system out). */
.sheet-enter-active .backdrop,
.sheet-leave-active .backdrop {
  transition: opacity 0.2s ease-out;
}
.sheet-enter-active .sheet {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out;
}
.sheet-leave-active .sheet {
  transition: transform 0.15s ease-out, opacity 0.15s ease-out;
}
.sheet-enter-from .backdrop,
.sheet-leave-to .backdrop {
  opacity: 0;
}
.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateX(32px);
  opacity: 0;
}
@media (max-width: 640px) {
  .sheet-enter-from .sheet,
  .sheet-leave-to .sheet {
    transform: translateY(32px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .sheet-enter-active .backdrop,
  .sheet-leave-active .backdrop,
  .sheet-enter-active .sheet,
  .sheet-leave-active .sheet {
    transition: none;
  }
}

/* Kill the mobile double-tap zoom delay on all page controls. */
button,
input[type='date'] {
  touch-action: manipulation;
}

/* Visible magenta focus rings on native controls (shadcn Button has its own). */
.mini-day:focus-visible,
.flow-day:focus-visible,
.type-card:focus-visible,
.slot-row:focus-visible,
input[type='date']:focus-visible {
  outline: 2px solid #e91e8c;
  outline-offset: 2px;
}

/* FullCalendar styling matching admin calendar */
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

/* Status color styling for FullCalendar event cards matching Admin */
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

.fc-past {
  background-color: rgba(255, 255, 255, 0.02) !important;
}
.fc-past .fc-daygrid-day-frame {
  background-color: rgba(255, 255, 255, 0.02) !important;
}
.fc-can-book .fc-daygrid-day-frame {
  cursor: pointer;
}
.fc-can-book .fc-daygrid-day-top {
  position: relative;
}
.fc-can-book .fc-daygrid-day-top::after {
  content: '+';
  position: absolute;
  top: 4px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border: 1px solid rgba(233, 30, 140, 0.5);
  border-radius: 9999px;
  color: #e91e8c;
  font-size: 0.7rem;
  line-height: 1;
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
.slot-row {
  font-variant-numeric: tabular-nums;
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
