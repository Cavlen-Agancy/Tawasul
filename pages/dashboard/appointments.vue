<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Video } from 'lucide-vue-next'
import type { DateClickArg, DatesSetArg, DayCellContentArg } from '@fullcalendar/core'
import type { Appointment } from '~/modules/patient/composables/types'
import type { AvailableSlot } from '~/modules/patient/composables/usePatientDashboard'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const {
  allBookings,
  availableDates,
  availableSlots,
  selectedDate,
  isLoading,
  error,
  fetchAllBookings,
  fetchAvailableDates,
  fetchBookingsForDate,
  selectDate,
  cancelAppointment,
  updateBookingTime,
  fetchAvailableSlots,
  fetchError,
  clearFetchError,
  isClosedDay,
  getClosedDayMessage,
} = usePatientDashboard()
const { isHoliday } = useHolidays()
const { toast } = useToast()

const currentMonth = ref(new Date().getMonth() + 1)
const currentYear = ref(new Date().getFullYear())
const now = ref(Date.now())
const calendarKey = ref(0)
const loadedMonthKey = ref('')

const selectedBookings = ref<Appointment[]>([])
const panelLoading = ref(false)

const cancelTarget = ref<Appointment | null>(null)
const cancelDialogOpen = ref(false)
const cancelling = ref(false)

const editTarget = ref<Appointment | null>(null)
const editDialogOpen = ref(false)
const editSlots = ref<AvailableSlot[]>([])
const editSlotLoading = ref(false)
const selectedEditTime = ref<string | null>(null)
const editing = ref(false)
const editError = ref<string | null>(null)

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

function sessionStart(appt: Appointment): Date {
  return parseDateTime(appt.date, appt.startTime)
}

function sessionEnd(appt: Appointment): Date {
  return parseDateTime(appt.date, appt.endTime)
}

function canJoin(appt: Appointment): boolean {
  const t = now.value
  return (
    t >= sessionStart(appt).getTime() - 5 * 60 * 1000 &&
    t <= sessionEnd(appt).getTime() + 15 * 60 * 1000
  )
}

function canCancel(appt: Appointment): boolean {
  return now.value < sessionStart(appt).getTime() - 24 * 60 * 60 * 1000
}

function statusForDate(dateStr: string): 'confirmed' | 'pending' | null {
  const day = allBookings.value.filter((a) => a.date === dateStr).map((a) => a.status)
  if (day.includes('CONFIRMED')) return 'confirmed'
  if (day.includes('PENDING')) return 'pending'
  return null
}

function dayCellClass(info: DayCellContentArg): string[] {
  const dateStr = toISODate(info.date)
  if (isPastStr(dateStr)) return ['fc-past']
  if (isHoliday(dateStr)) return ['fc-holiday']
  const classes: string[] = []
  const st = statusForDate(dateStr)
  if (st === 'confirmed') classes.push('fc-dot-confirmed')
  else if (st === 'pending') classes.push('fc-dot-pending')
  else if (availableDates.value.includes(dateStr)) classes.push('fc-available')
  return classes
}

async function loadMonth(month: number, year: number, remount = false) {
  await fetchAvailableDates(month, year)
  if (remount) calendarKey.value += 1
  if (selectedDate.value) {
    selectedBookings.value = fetchBookingsForDate(selectedDate.value)
  }
}

async function onDatesSet(info: DatesSetArg) {
  // NB: view.currentStart is the first *visible* day, which can belong to the
  // previous month (week starts Saturday). Use the calendar anchor date so the
  // month label and navigation stay on the month actually being viewed.
  const anchor = info.view.calendar.getDate()
  const month = anchor.getMonth() + 1
  const year = anchor.getFullYear()
  currentMonth.value = month
  currentYear.value = year
  const key = `${year}-${month}`
  if (key === loadedMonthKey.value) return
  loadedMonthKey.value = key
  await loadMonth(month, year)
  // Re-render once with the freshly fetched dates/bookings: FullCalendar does
  // not re-evaluate dayCellClassNames when our async data arrives. The remount
  // fires datesSet again, which returns early via loadedMonthKey (no loop).
  calendarKey.value += 1
}

async function onDateClick(info: DateClickArg) {
  const dateStr = toISODate(info.date)
  if (info.date.getMonth() + 1 !== currentMonth.value) return
  if (isPastStr(dateStr)) return
  if (isHoliday(dateStr)) {
    toast({ title: 'Clinic closed for a public holiday', variant: 'info' })
    return
  }
  // Fridays stay clickable on purpose: the panel explains the clinic is closed.
  panelLoading.value = true
  try {
    await selectDate(dateStr)
    selectedBookings.value = fetchBookingsForDate(dateStr)
  } finally {
    panelLoading.value = false
  }
}

async function retryLoad() {
  clearFetchError()
  panelLoading.value = true
  try {
    await loadMonth(currentMonth.value, currentYear.value)
    if (selectedDate.value) {
      await selectDate(selectedDate.value)
      selectedBookings.value = fetchBookingsForDate(selectedDate.value)
    }
    calendarKey.value += 1
  } finally {
    panelLoading.value = false
  }
}

function onMonthChange(dir: number) {
  const d = new Date(currentYear.value, currentMonth.value - 1 + dir, 1)
  currentMonth.value = d.getMonth() + 1
  currentYear.value = d.getFullYear()
  void loadMonth(currentMonth.value, currentYear.value, true)
}

function goToday() {
  const t = new Date()
  currentMonth.value = t.getMonth() + 1
  currentYear.value = t.getFullYear()
  void loadMonth(currentMonth.value, currentYear.value, true)
}

function formatMonthLabel(): string {
  return new Date(currentYear.value, currentMonth.value - 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(time: string): string {
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = (hh || 0) >= 12 ? 'PM' : 'AM'
  const hour = (hh || 0) % 12 === 0 ? 12 : (hh || 0) % 12
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`
}

function statusLabel(status: string): string {
  if (status === 'CONFIRMED') return 'Confirmed'
  if (status === 'PENDING') return 'Under review'
  return 'Cancelled'
}

function bookSlot(startTime: string) {
  if (!selectedDate.value) return
  navigateTo(`/book?date=${selectedDate.value}&time=${startTime}`)
}

function joinSession(appt: Appointment) {
  navigateTo(`/dashboard/session/${appt.id}`)
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
    await fetchAllBookings()
    if (selectedDate.value) {
      selectedBookings.value = fetchBookingsForDate(selectedDate.value)
    }
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

function canEdit(appt: Appointment): boolean {
  return appt.status === 'PENDING' && now.value < sessionStart(appt).getTime()
}

async function openEditModal(appt: Appointment) {
  editTarget.value = appt
  editError.value = null
  editSlots.value = []
  selectedEditTime.value = null
  editDialogOpen.value = true
  editSlotLoading.value = true
  try {
    const slots = await fetchAvailableSlots(appt.date)
    // The patient's own (pending) slot is not counted as taken by the API, so it
    // is already present; ensure we don't offer past times on today's sessions.
    const currentHHMM = appt.startTime
    const isToday = appt.date === todayStr()
    const currentMinutes = isToday
      ? new Date(now.value).getHours() * 60 + new Date(now.value).getMinutes()
      : -1
    const list = slots
      .filter((s) => !(isToday && timeToMinutesNum(s.startTime) <= currentMinutes))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    const flagCurrent = (s: AvailableSlot) => (s.startTime === currentHHMM ? { ...s, current: true } : s)
    editSlots.value = list.map(flagCurrent)
    if (!list.some((s) => s.startTime === currentHHMM)) {
      editSlots.value.push({ startTime: currentHHMM, endTime: appt.endTime, sessionDuration: 60, current: true })
    }
    selectedEditTime.value = currentHHMM
  } catch (e) {
    editError.value = (e as { data?: { message?: string } }).data?.message || 'Could not load available slots'
  } finally {
    editSlotLoading.value = false
  }
}

function timeToMinutesNum(time: string): number {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10))
  return (h || 0) * 60 + (m || 0)
}

function selectEditSlot(startTime: string) {
  selectedEditTime.value = startTime
  editError.value = null
}

async function confirmEdit() {
  if (!editTarget.value || !selectedEditTime.value) return
  editing.value = true
  editError.value = null
  try {
    await updateBookingTime(editTarget.value.id, selectedEditTime.value)
    toast({ title: 'Appointment updated', variant: 'success' })
    editDialogOpen.value = false
    editTarget.value = null
    await fetchAllBookings()
    await loadMonth(currentMonth.value, currentYear.value)
    if (selectedDate.value) {
      selectedBookings.value = fetchBookingsForDate(selectedDate.value)
    }
    calendarKey.value += 1
  } catch (e) {
    editError.value = (e as { data?: { message?: string } }).data?.message || 'Could not update appointment'
  } finally {
    editing.value = false
  }
}

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  initialDate: new Date(currentYear.value, currentMonth.value - 1, 1),
  headerToolbar: false,
  height: 'auto',
  firstDay: 6,
  weekends: true,
  dayCellClassNames: dayCellClass,
  dateClick: onDateClick,
  datesSet: onDatesSet,
}))

onMounted(async () => {
  now.value = Date.now()
  await Promise.all([
    fetchAllBookings(),
    loadMonth(currentMonth.value, currentYear.value),
  ])
  window.setInterval(() => {
    now.value = Date.now()
  }, 60 * 1000)
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px]" :data-testid="'available-dates-count-' + availableDates.length">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
          My Appointments
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">Select a day to see your bookings or free times.</p>
      </div>
    </div>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <Card class="mt-6 w-full overflow-hidden">
      <CardContent class="p-3 sm:p-5">
        <div class="mb-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" aria-label="Previous month" @click="onMonthChange(-1)">
            <ChevronLeft class="size-5" />
          </Button>

          <div class="flex items-center gap-2 text-base font-semibold text-foreground">
            <CalendarIcon class="size-4 text-primary" />
            <span data-testid="calendar-month">{{ formatMonthLabel() }}</span>
          </div>

          <div class="flex items-center gap-1">
            <Button variant="ghost" size="sm" data-testid="calendar-today" @click="goToday">Today</Button>
            <Button variant="ghost" size="sm" aria-label="Next month" @click="onMonthChange(1)">
              <ChevronRight class="size-5" />
            </Button>
          </div>
        </div>

        <ClientOnly>
          <FullCalendar :key="calendarKey" :options="calendarOptions" />
          <template #fallback>
            <div class="py-10 text-center text-sm text-muted-foreground">Loading calendar…</div>
          </template>
        </ClientOnly>

        <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground" data-testid="calendar-legend">
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-green-600"></span>
            Confirmed
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-yellow-500"></span>
            Under review
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-[#e91e8c]" data-testid="legend-available-dot"></span>
            Available day
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="size-3 rounded-sm bg-slate-200"></span>
            Holiday / Past
          </span>
        </div>
      </CardContent>
    </Card>

    <div class="mt-6" data-testid="day-panel">
      <div v-if="fetchError" class="rounded-2xl border border-destructive/40 bg-white p-6 text-center" data-testid="day-error">
        <p class="text-sm font-medium text-destructive">{{ fetchError }}</p>
        <Button variant="outline" class="mt-4" data-testid="day-retry" @click="retryLoad">Retry</Button>
      </div>

      <div v-else-if="!selectedDate">
        <div v-if="isLoading || availableDates.length === 0" class="grid gap-3">
          <Skeleton v-for="i in 2" :key="i" class="h-28 w-full" />
        </div>
        <div v-else class="rounded-2xl border border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
          Select a date above to see your bookings or free times.
        </div>
      </div>

      <div v-else>
        <h2 class="mb-3 text-base font-semibold text-foreground" data-testid="panel-date">
          {{ formatDateLabel(selectedDate) }}
        </h2>

        <div v-if="panelLoading" class="grid gap-3">
          <Skeleton v-for="i in 2" :key="i" class="h-24 w-full" />
        </div>

        <div v-else-if="selectedDate && isClosedDay(selectedDate)" class="rounded-2xl border border-border bg-white p-10 text-center" data-testid="day-closed">
          <p class="font-medium text-foreground">{{ getClosedDayMessage() }}</p>
          <p class="mt-1 text-sm text-muted-foreground">Please choose another day to see bookings or free times.</p>
        </div>

        <div v-else>
          <div v-if="selectedBookings.length > 0" class="grid gap-4">
          <Card
            v-for="appt in selectedBookings"
            :key="appt.id"
            class="overflow-hidden"
            :data-testid="`booking-${appt.id}`"
          >
            <CardContent class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <Avatar class="size-14 shrink-0">
                <AvatarImage :src="appt.doctorPhoto || undefined" :alt="appt.doctorName" />
                <AvatarFallback class="text-lg">{{ (appt.doctorName || 'U').slice(0, 1).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <p class="truncate text-base font-semibold text-foreground" :data-testid="`doctor-name-${appt.id}`">
                  {{ appt.doctorId ? appt.doctorName : 'Unknown Doctor' }}
                </p>
                <p class="text-sm text-muted-foreground">{{ formatTime(appt.startTime) }} – {{ formatTime(appt.endTime) }}</p>
                <p class="mt-1 text-sm text-muted-foreground">{{ appt.service }}</p>
                <p
                  v-if="appt.status === 'PENDING' && !appt.doctorId"
                  class="mt-1 text-xs text-muted-foreground"
                  :data-testid="`pending-note-${appt.id}`"
                >
                  Waiting for admin confirmation — you'll receive an email once confirmed.
                </p>
              </div>
              <div class="flex shrink-0 flex-col gap-2 sm:items-end">
                <Badge
                  :variant="appt.status === 'CONFIRMED' ? 'default' : 'secondary'"
                  :class="appt.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : appt.status === 'CANCELLED' ? 'bg-slate-200 text-slate-600' : ''"
                  :data-testid="`status-${appt.id}`"
                >
                  {{ statusLabel(appt.status) }}
                </Badge>
                <template v-if="appt.status === 'CONFIRMED'">
                  <Button
                    :variant="canJoin(appt) ? 'default' : 'secondary'"
                    :disabled="!canJoin(appt)"
                    :title="!canJoin(appt) ? 'Available 5 minutes before your session' : undefined"
                    :data-testid="`join-${appt.id}`"
                    @click="joinSession(appt)"
                  >
                    Join Session
                  </Button>
                </template>
                <template v-if="appt.status === 'PENDING'">
                  <Button
                    v-if="canEdit(appt)"
                    variant="outline"
                    :data-testid="`edit-${appt.id}`"
                    @click="openEditModal(appt)"
                  >
                    Edit
                  </Button>
                </template>
                <Button
                  v-if="appt.status === 'PENDING' || (appt.status === 'CONFIRMED' && canCancel(appt))"
                  variant="outline"
                  :data-testid="`cancel-${appt.id}`"
                  @click="openCancelDialog(appt)"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div v-if="availableSlots.length > 0" class="rounded-2xl border border-border bg-white p-5" :class="{ 'mt-4': selectedBookings.length > 0 }">
          <p class="mb-3 text-sm font-medium text-foreground">Other available times on this day:</p>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="slot in availableSlots"
              :key="slot.startTime"
              variant="outline"
              :data-testid="`slot-${slot.startTime}`"
              @click="bookSlot(slot.startTime)"
            >
              {{ formatTime(slot.startTime) }}
            </Button>
          </div>
        </div>

        <div v-if="selectedBookings.length === 0 && availableSlots.length === 0" class="flex flex-col items-center rounded-2xl border border-border bg-white p-10 text-center" data-testid="day-empty">
          <Video class="size-10 text-muted-foreground" />
          <p class="mt-3 font-medium text-foreground">No appointments or available slots on this day. Select another date or book a new session.</p>
          <Button as="a" href="/book" class="mt-4" data-testid="book-now-empty">Book Now</Button>
        </div>
        </div>
      </div>
    </div>

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

      <Dialog v-model:open="editDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
            <DialogDescription v-if="editTarget">
              {{ formatDateLabel(editTarget.date) }} — currently {{ formatTime(editTarget.startTime) }} – {{ formatTime(editTarget.endTime) }}.
              Choose a new time below.
            </DialogDescription>
          </DialogHeader>

          <p v-if="editError" class="text-sm text-destructive" data-testid="edit-error">{{ editError }}</p>

          <div v-if="editSlotLoading" class="grid gap-2 py-2">
            <Skeleton v-for="i in 3" :key="i" class="h-10 w-full" />
          </div>

          <div v-else-if="editSlots.length > 0" class="flex flex-wrap gap-2 py-2">
            <Button
              v-for="slot in editSlots"
              :key="slot.startTime"
              :variant="selectedEditTime === slot.startTime ? 'default' : 'outline'"
              :data-testid="`edit-slot-${slot.startTime}`"
              :aria-pressed="selectedEditTime === slot.startTime"
              @click="selectEditSlot(slot.startTime)"
            >
              {{ formatTime(slot.startTime) }}
              <span v-if="slot.current" class="ml-1 text-xs opacity-80">(current)</span>
            </Button>
          </div>

          <div v-else class="rounded-lg border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground" data-testid="edit-empty">
            No other slots available on this day. You can keep your current time or cancel the booking.
          </div>

          <DialogFooter>
            <Button variant="outline" @click="editDialogOpen = false">
              Cancel
            </Button>
            <Button
              data-testid="edit-confirm"
              :disabled="editing || !selectedEditTime || selectedEditTime === editTarget?.startTime"
              @click="confirmEdit"
            >
              {{ editing ? 'Saving…' : 'Confirm' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>

<style>
.fc-day-other .fc-daygrid-day-frame {
  cursor: not-allowed;
}
.fc-day-other .fc-daygrid-day-number {
  color: #cbd5e1;
  opacity: 0.7;
}
.fc-holiday .fc-daygrid-day-frame {
  background-color: #f1f5f9;
  cursor: not-allowed;
}
.fc-holiday .fc-daygrid-day-number {
  color: #94a3b8;
  text-decoration: line-through;
}
.fc-past {
  opacity: 0.6;
  cursor: not-allowed;
}
.fc-past .fc-daygrid-day-frame {
  pointer-events: none;
}
.fc-available .fc-daygrid-day-frame {
  cursor: pointer;
}
.fc-dot-confirmed .fc-daygrid-day-number::after,
.fc-dot-pending .fc-daygrid-day-number::after,
.fc-available .fc-daygrid-day-number::after {
  content: '';
  display: block;
  width: 0.5rem;
  height: 0.5rem;
  margin: 1px auto 0;
  border-radius: 9999px;
}
.fc-dot-confirmed .fc-daygrid-day-number::after {
  background-color: #16a34a;
}
.fc-dot-pending .fc-daygrid-day-number::after {
  background-color: #eab308;
}
.fc-available .fc-daygrid-day-number::after {
  background-color: #e91e8c;
}
@media (max-width: 640px) {
  .fc .fc-daygrid-day-number {
    font-size: 0.75rem;
    padding: 2px;
  }
}
</style>
