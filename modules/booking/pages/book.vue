<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { DateClickArg, DatesSetArg, DayCellContentArg } from '@fullcalendar/core'
import type { Slot } from '../composables/types'

definePageMeta({ layout: 'patient-layout', middleware: 'auth' })

const {
  step,
  selectedDate,
  selectedSlot,
  availableDates,
  availableSlots,
  isLoading,
  error,
  fetchAvailableDates,
  fetchAvailableSlots,
  selectSlot,
  backToStep1,
  createAndPay,
} = useBooking()

const currentMonth = ref(new Date().getMonth() + 1)
const currentYear = ref(new Date().getFullYear())

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const calendarKey = ref(0)

async function loadDates(month: number, year: number, remount = false) {
  await fetchAvailableDates(month, year)
  if (remount) calendarKey.value += 1
}

async function onDatesSet(info: DatesSetArg) {
  const start = info.view.currentStart
  const month = start.getMonth() + 1
  const year = start.getFullYear()
  currentMonth.value = month
  currentYear.value = year
  await loadDates(month, year)
}

async function onDateClick(info: DateClickArg) {
  const dateStr = toISODate(info.date)
  if (!availableDates.value.includes(dateStr)) return
  selectedDate.value = dateStr
  await fetchAvailableSlots(dateStr)
}

async function onMonthChange(dir: number) {
  const d = new Date(currentYear.value, currentMonth.value - 1 + dir, 1)
  currentMonth.value = d.getMonth() + 1
  currentYear.value = d.getFullYear()
  await loadDates(currentMonth.value, currentYear.value, true)
}

function dayCellClass(info: DayCellContentArg): string[] {
  const dateStr = toISODate(info.date)
  const available = availableDates.value.includes(dateStr)
  if (available) return ['fc-tawasul-available']
  return ['fc-tawasul-unavailable']
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTimeLabel(slot: Slot): string {
  return `${slot.startTime} – ${slot.endTime}`
}

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  initialDate: new Date(currentYear.value, currentMonth.value - 1, 1),
  headerToolbar: false,
  height: 'auto',
  firstDay: 0,
  dayCellClassNames: dayCellClass,
  dateClick: onDateClick,
  datesSet: onDatesSet,
}))

onMounted(async () => {
  await loadDates(currentMonth.value, currentYear.value)
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-10 lg:py-14">
    <div class="flex items-center justify-center gap-2">
      <div
        class="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
        :class="step >= 1 ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'"
      >
        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
        Choose Time
      </div>
      <div class="h-px w-8 bg-border" />
      <div
        class="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
        :class="step >= 2 ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'"
      >
        <span
          class="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
          :class="step >= 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'"
        >2</span>
        Review
      </div>
      <div class="h-px w-8 bg-border" />
      <div
        class="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
        :class="step >= 3 ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'"
      >
        <span
          class="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
          :class="step >= 3 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'"
        >3</span>
        Pay
      </div>
    </div>

    <!-- Step 1: Choose Time -->
    <div v-if="step === 1">
      <h1 class="text-center text-2xl font-semibold tracking-tight text-foreground">
        Book a Session
      </h1>
      <p class="mt-2 text-center text-sm text-muted-foreground">
        Select a day with available times, then pick a slot.
      </p>

      <Card class="mt-6 w-full">
        <CardContent class="p-4 sm:p-6">
          <div class="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Previous month" @click="onMonthChange(-1)">
              <ChevronLeft class="size-5" />
            </Button>
            <div class="flex items-center gap-2 text-base font-semibold text-foreground">
              <CalendarIcon class="size-4 text-primary" />
              {{ new Date(currentYear, currentMonth - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }}
            </div>
            <Button variant="ghost" size="icon" aria-label="Next month" @click="onMonthChange(1)">
              <ChevronRight class="size-5" />
            </Button>
          </div>

          <ClientOnly>
            <FullCalendar :key="calendarKey" :options="calendarOptions" />
            <template #fallback>
              <div class="py-10 text-center text-sm text-muted-foreground">Loading calendar…</div>
            </template>
          </ClientOnly>

          <p v-if="!isLoading && availableDates.length === 0" class="mt-4 text-center text-sm text-muted-foreground">
            No available slots this month.
          </p>
        </CardContent>
      </Card>

      <div v-if="availableSlots.length > 0" class="mt-6">
        <h2 class="mb-3 text-sm font-semibold text-foreground">
          Available times on {{ selectedDate ? formatDateLabel(selectedDate) : '' }}
        </h2>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="slot in availableSlots"
            :key="`${slot.startTime}`"
            variant="outline"
            class="justify-center"
            :data-testid="`booking-slot-${slot.startTime}`"
            @click="selectSlot(selectedDate ?? toISODate(new Date()), slot)"
          >
            {{ slot.startTime }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Step 2: Review -->
    <div v-else-if="step === 2 && selectedSlot">
      <h1 class="text-center text-2xl font-semibold tracking-tight text-foreground">
        Review your booking
      </h1>

      <Card class="mt-6 w-full">
        <CardContent class="p-6 sm:p-8">
          <dl class="divide-y divide-border rounded-2xl border border-border">
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Date</dt>
              <dd class="text-sm font-medium text-foreground">{{ selectedDate ? formatDateLabel(selectedDate) : '' }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Time</dt>
              <dd class="text-sm font-medium text-foreground">{{ formatTimeLabel(selectedSlot) }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Session Duration</dt>
              <dd class="text-sm font-medium text-foreground">{{ selectedSlot.sessionDuration }} minutes</dd>
            </div>
            <div class="flex justify-between bg-muted/40 px-5 py-4">
              <dt class="text-sm font-medium text-foreground">Price</dt>
              <dd class="text-sm font-semibold text-primary">See at payment</dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter class="flex flex-col gap-3 p-6 pt-0 sm:flex-row sm:p-8 sm:pt-0">
          <Button variant="outline" class="w-full sm:w-auto" @click="backToStep1">
            Back
          </Button>
          <Button class="w-full sm:flex-1" :disabled="isLoading" data-testid="confirm-pay" @click="createAndPay">
            {{ isLoading ? 'Preparing your payment…' : 'Confirm and Pay' }}
          </Button>
        </CardFooter>
      </Card>
    </div>

    <!-- Step 3: Pay -->
    <div v-else-if="step === 3">
      <Card class="w-full">
        <CardContent class="flex flex-col items-center gap-3 p-10 text-center">
          <span class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p class="text-base font-medium text-foreground">Preparing your payment…</p>
          <p class="text-sm text-muted-foreground">Please don't close this window.</p>
        </CardContent>
      </Card>
    </div>

    <p v-if="error" data-testid="booking-error" class="mx-auto text-center text-sm text-destructive">
      {{ error }}
    </p>
  </div>
</template>

<style>
.fc-tawasul-available .fc-daygrid-day-number {
  color: #e91e8c;
  font-weight: 600;
}
.fc-tawasul-available {
  background-color: rgba(233, 30, 140, 0.06);
  cursor: pointer;
}
.fc-tawasul-unavailable {
  color: #c4c4c4;
  opacity: 0.6;
}
.fc-tawasul-unavailable .fc-daygrid-day-number {
  color: #c4c4c4;
}
.fc .fc-daygrid-day.fc-tawasul-unavailable {
  pointer-events: none;
}
</style>
