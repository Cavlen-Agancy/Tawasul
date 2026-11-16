<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Stethoscope,
  UserSearch,
  X,
} from 'lucide-vue-next'
import type { DateClickArg, DatesSetArg, DayCellContentArg } from '@fullcalendar/core'
import type { Slot, PublicDoctor } from '../composables/types'

definePageMeta({ layout: 'patient-layout', middleware: 'auth' })

const {
  step,
  doctors,
  doctorsPage,
  doctorsTotalPages,
  doctorsTotal,
  doctorsSearch,
  selectedDoctor,
  sessionType,
  selectedDate,
  selectedSlot,
  availableDates,
  availableSlots,
  isLoading,
  error,
  fetchDoctors,
  goToDoctorsPage,
  selectDoctor,
  setDoctorsSearch,
  setSessionType,
  fetchAvailableDates,
  fetchAvailableSlots,
  selectSlot,
  backToStep1,
  createAndPay,
} = useBooking()

const currentMonth = ref(new Date().getMonth() + 1)
const currentYear = ref(new Date().getFullYear())
const route = useRoute()

// Local input value, debounced before it is pushed to the composable so the
// API is not called on every keystroke.
const searchQuery = ref(doctorsSearch.value)
const searchTimer = ref(null)

watch(searchQuery, (val) => {
  if (searchTimer.value) window.clearTimeout(searchTimer.value)
  searchTimer.value = window.setTimeout(() => setDoctorsSearch(val), 300)
})

const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)
// Only treat loading as search-in-flight while a query is active, so the
// initial list load or availability fetch does not flash a "Searching…" state.
const isSearching = computed(() => isLoading.value && hasSearchQuery.value)

function clearSearch() {
  searchQuery.value = ''
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

async function prefillFromQuery() {
  if (!selectedDoctor.value) return
  const date = typeof route.query.date === 'string' ? route.query.date : ''
  const time = typeof route.query.time === 'string' ? route.query.time : ''
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return
  const slots = await fetchAvailableSlots(date)
  const match = slots.find((s) => s.startTime === time)
  if (match) {
    selectSlot(date, match)
  }
}

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const calendarKey = ref(0)

async function loadDates(month: number, year: number, remount = false) {
  if (!selectedDoctor.value) {
    availableDates.value = []
    return
  }
  await fetchAvailableDates(month, year)
  if (remount) calendarKey.value += 1
}

async function onDatesSet(info: DatesSetArg) {
  if (!selectedDoctor.value) return
  const start = info.view.currentStart
  const month = start.getMonth() + 1
  const year = start.getFullYear()
  currentMonth.value = month
  currentYear.value = year
  await loadDates(month, year)
}

async function onDateClick(info: DateClickArg) {
  if (!selectedDoctor.value) return
  const dateStr = toISODate(info.date)
  if (!availableDates.value.includes(dateStr)) return
  selectedDate.value = dateStr
  await fetchAvailableSlots(dateStr)
}

async function chooseDoctor(doctor: PublicDoctor) {
  selectDoctor(doctor)
  calendarKey.value += 1
  currentMonth.value = new Date().getMonth() + 1
  currentYear.value = new Date().getFullYear()
  await loadDates(currentMonth.value, currentYear.value, true)
  await prefillFromQuery()
}

/** Specializations as shown on a doctor card (empty strings are ignored). */
function doctorSpecializations(doctor: PublicDoctor): string[] {
  return (doctor.specializations ?? []).filter((spec) => spec && spec.trim().length > 0)
}

function isDoctorSelected(doctor: PublicDoctor): boolean {
  return selectedDoctor.value?.id === doctor.id
}

function clearSelectedDoctor() {
  selectDoctor(null)
}

type DoctorPageToken = number | 'gap'

/** Page numbers for the doctor pagination, with collapsed ranges for long lists. */
const doctorPageTokens = computed<DoctorPageToken[]>(() => {
  const total = doctorsTotalPages.value
  const current = doctorsPage.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const tokens: DoctorPageToken[] = []
  const push = (page: number) => {
    if (page >= 1 && page <= total && !tokens.includes(page)) tokens.push(page)
  }

  push(1)
  if (current - 1 > 2) tokens.push('gap')
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
    push(page)
  }
  if (current + 1 < total - 1) tokens.push('gap')
  push(total)
  return tokens
})

function goToDoctorPage(token: DoctorPageToken) {
  if (token === 'gap') return
  void goToDoctorsPage(token)
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
  await fetchDoctors()
  const requestedDoctorId = typeof route.query.doctorId === 'string' ? route.query.doctorId : ''
  const requestedDoctor = doctors.value.find((doctor) => doctor.id === requestedDoctorId)
  if (requestedDoctor) {
    selectDoctor(requestedDoctor)
  }
  if (selectedDoctor.value) {
    await loadDates(currentMonth.value, currentYear.value, true)
    await prefillFromQuery()
  }
})
</script>

<template>
  <div class="mx-auto flex w-full flex-col gap-6 px-4 py-10 lg:py-14">
    <div class="mx-auto w-full max-w-[760px]">
      <div class="flex items-center justify-center gap-2">
        <div
          class="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          :class="step >= 1 ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'"
        >
          <span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
          Doctor & Time
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
    </div>

    <!-- Step 1: Choose Time -->
    <div v-if="step === 1" class="flex flex-col gap-6">
      <div class="mx-auto w-full max-w-[760px]">
        <h1 class="text-center text-2xl font-semibold tracking-tight text-foreground">
          Book a Session
        </h1>
        <p class="mt-2 text-center text-sm text-muted-foreground">
          Choose a doctor, then select an available day and time.
        </p>
      </div>

      <!-- Step 1a: choose a doctor -->
      <section class="mx-auto w-full max-w-[1100px]" aria-labelledby="doctor-picker-title">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div class="min-w-0">
            <h2 id="doctor-picker-title" class="text-lg font-semibold tracking-tight text-foreground">
              Choose your doctor
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              Specialists currently available for booking.
            </p>
          </div>
          <span
            v-if="doctorsTotal > 0"
            class="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground"
            data-testid="doctors-count"
          >
            {{ doctorsTotal }} {{ doctorsTotal === 1 ? 'doctor' : 'doctors' }} available
          </span>
        </div>

        <!-- Search field -->
        <div class="mt-4 rounded-2xl border border-border bg-muted/30 p-4 shadow-soft">
          <label for="doctor-search" class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Search class="size-4 text-primary" aria-hidden="true" />
            Find a doctor by name
          </label>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div class="relative min-w-0 flex-1 sm:max-w-sm">
              <Input
                id="doctor-search"
                v-model="searchQuery"
                type="search"
                placeholder="e.g. Dr. Ahmed"
                autocomplete="off"
                aria-describedby="doctor-search-status"
                data-testid="doctor-search"
                class="h-12 pr-10 rounded-xl bg-card border-border"
                @keydown.esc="clearSearch"
              />
              <button
                v-if="hasSearchQuery"
                type="button"
                class="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
                data-testid="doctor-search-clear"
                @click="clearSearch"
              >
                <X class="size-4" />
              </button>
            </div>

            <!-- Contextual, atomic live status for assistive tech and sighted users -->
            <p
              id="doctor-search-status"
              class="flex min-h-8 items-center gap-2 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-testid="doctor-search-status"
            >
              <template v-if="isSearching">
                <span class="size-3.5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
                <span>Searching…</span>
              </template>
              <template v-else-if="hasSearchQuery">
                <Check class="size-4 shrink-0 text-success" aria-hidden="true" />
                <span>
                  <span class="font-semibold text-foreground">{{ doctorsTotal }} {{ doctorsTotal === 1 ? 'doctor' : 'doctors' }}</span>
                  found for “{{ searchQuery.trim() }}”
                </span>
              </template>
              <template v-else>
                <span>Showing all available specialists</span>
              </template>
            </p>
          </div>
        </div>

        <!-- Instruction before a doctor is picked, summary afterwards -->
        <div
          v-if="!selectedDoctor"
          class="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-4"
          data-testid="select-doctor-first"
        >
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserSearch class="size-4" aria-hidden="true" />
          </span>
          <p class="text-sm leading-relaxed text-muted-foreground">
            Select a doctor to view their available dates and times. You can change your choice at any time.
          </p>
        </div>

        <div
          v-else
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3"
          data-testid="selected-doctor-summary"
        >
          <Avatar class="size-11 shrink-0">
            <AvatarImage v-if="selectedDoctor.photo" :src="selectedDoctor.photo" :alt="selectedDoctor.name" />
            <AvatarFallback class="text-sm font-semibold text-primary">
              {{ selectedDoctor.name.slice(0, 1).toUpperCase() }}
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <p class="break-words text-sm font-semibold leading-snug text-foreground">
              {{ selectedDoctor.name }}
            </p>
            <p class="mt-0.5 text-sm leading-snug text-muted-foreground">
              {{ doctorSpecializations(selectedDoctor).join(' · ') || 'Mental Health Specialist' }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            class="shrink-0"
            data-testid="change-doctor"
            @click="clearSelectedDoctor"
          >
            Change
          </Button>
        </div>

        <!-- Patient-visible profile of the selected doctor -->
        <details
          v-if="selectedDoctor?.bio"
          class="mt-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
          data-testid="selected-doctor-bio"
        >
          <summary class="cursor-pointer list-none text-sm font-medium text-muted-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
            About {{ selectedDoctor.name }}
          </summary>
          <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
            {{ selectedDoctor.bio }}
          </p>
        </details>

        <!-- Loading -->
        <div
          v-if="isLoading && !selectedDoctor"
          class="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
          data-testid="doctors-loading"
          aria-busy="true"
        >
          <div
            v-for="placeholder in 6"
            :key="placeholder"
            class="flex flex-col items-center rounded-2xl border border-border bg-card p-6 shadow-soft"
          >
            <Skeleton class="size-16 rounded-full" />
            <Skeleton class="mt-3.5 h-4 w-32" />
            <Skeleton class="mt-2 h-3.5 w-24" />
            <Skeleton class="mt-5 h-10 w-full rounded-2xl" />
          </div>
        </div>

        <!-- Error -->
        <div
          v-else-if="error && doctors.length === 0"
          class="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center"
          data-testid="doctors-error"
          role="alert"
        >
          <AlertCircle class="size-6 text-destructive" aria-hidden="true" />
          <p class="text-sm font-semibold text-foreground">We couldn't load the list of doctors.</p>
          <p class="text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button
            variant="outline"
            size="sm"
            class="mt-2"
            data-testid="doctors-retry"
            :disabled="isLoading"
            @click="fetchDoctors(doctorsPage)"
          >
            <RefreshCw class="size-4" aria-hidden="true" />
            Try again
          </Button>
        </div>

        <!-- Empty: no doctors at all -->
        <div
          v-else-if="doctors.length === 0 && !searchQuery.trim()"
          class="mt-4 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
          data-testid="doctors-empty"
        >
          <div class="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Stethoscope class="size-7" aria-hidden="true" />
          </div>
          <h3 class="mt-4 text-lg font-semibold text-foreground">No doctors are available right now</h3>
          <p class="mt-1 max-w-sm text-sm text-muted-foreground">
            New specialists are added regularly. Please check back later or contact the academy for help.
          </p>
          <Button
            variant="outline"
            size="sm"
            class="mt-5 gap-2"
            data-testid="doctors-refresh"
            :disabled="isLoading"
            @click="fetchDoctors(doctorsPage)"
          >
            <RefreshCw class="size-4" aria-hidden="true" />
            Refresh list
          </Button>
        </div>

        <!-- Empty: search returned no results -->
        <div
          v-else-if="doctors.length === 0"
          class="mt-4 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
          data-testid="doctors-search-empty"
        >
          <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserSearch class="size-7" aria-hidden="true" />
          </div>
          <h3 class="mt-4 text-lg font-semibold text-foreground">
            No doctors found for “{{ searchQuery.trim() }}”
          </h3>
          <p class="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Check the spelling or try a shorter version of the name. You can also clear the search to see every available specialist.
          </p>
          <Button
            variant="outline"
            size="sm"
            class="mt-5 gap-2"
            data-testid="doctor-search-clear-empty"
            @click="clearSearch"
          >
            <X class="size-4" aria-hidden="true" />
            Clear search
          </Button>
        </div>

        <!-- Doctor grid -->
        <div
          v-else
          class="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
          data-testid="doctors-grid"
        >
          <div
            v-for="doctor in doctors"
            :key="doctor.id"
            :data-testid="`doctor-card-${doctor.id}`"
            class="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-[#EBEBEB] bg-[#FAFAFA] p-6 shadow-soft transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-medium dark:border-border dark:bg-card"
            :class="isDoctorSelected(doctor)
              ? 'border-primary/60 ring-2 ring-primary bg-primary/5 dark:bg-primary/10'
              : ''"
            @click="chooseDoctor(doctor)"
          >
            <div>
              <!-- Profile area -->
              <div class="flex flex-col items-center text-center">
                <div class="relative">
                  <Avatar class="size-16 rounded-full border-2 border-border/60 shadow-xs dark:border-border/60">
                    <AvatarImage v-if="doctor.photo" :src="doctor.photo" :alt="doctor.name" />
                    <AvatarFallback class="bg-[#FCE4F3] text-xl font-bold text-[#E91E8C] dark:bg-primary/20 dark:text-primary">
                      {{ doctor.name.slice(0, 1).toUpperCase() }}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    v-if="isDoctorSelected(doctor)"
                    class="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-[#FAFAFA] dark:ring-card"
                    aria-hidden="true"
                  >
                    <Check class="size-3.5" />
                  </span>
                </div>

                <h3 class="mt-3.5 w-full break-words text-base font-semibold leading-snug text-foreground">
                  {{ doctor.name }}
                </h3>

                <p class="mt-1 w-full break-words text-sm leading-snug text-muted-foreground">
                  {{ doctorSpecializations(doctor)[0] || 'Mental Health Specialist' }}
                </p>

                <div
                  v-if="doctorSpecializations(doctor).length > 1"
                  class="mt-2.5 flex flex-wrap items-center justify-center gap-1.5"
                >
                  <Badge
                    v-for="specialization in doctorSpecializations(doctor).slice(1, 4)"
                    :key="specialization"
                    variant="outline"
                    class="max-w-full whitespace-normal break-words px-2.5 py-1 text-sm font-medium leading-snug"
                  >
                    {{ specialization }}
                  </Badge>
                  <span
                    v-if="doctorSpecializations(doctor).length > 4"
                    class="text-sm font-medium text-muted-foreground"
                  >
                    +{{ doctorSpecializations(doctor).length - 4 }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Divider + single primary action -->
            <div>
              <div class="my-4 border-t border-border/80" />

              <Button
                class="w-full"
                :variant="isDoctorSelected(doctor) ? 'outline' : 'default'"
                :aria-pressed="isDoctorSelected(doctor)"
                :aria-label="isDoctorSelected(doctor) ? `${doctor.name} selected` : `Select ${doctor.name}`"
                :data-testid="`select-doctor-${doctor.id}`"
                @click.stop="chooseDoctor(doctor)"
              >
                <Check v-if="isDoctorSelected(doctor)" class="size-4" aria-hidden="true" />
                {{ isDoctorSelected(doctor) ? 'Selected' : 'Select Doctor' }}
              </Button>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <nav
          v-if="doctorsTotalPages > 1"
          class="mt-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
          data-testid="doctor-pagination"
          aria-label="Doctor list pagination"
        >
          <Button
            variant="outline"
            size="sm"
            :disabled="doctorsPage <= 1 || isLoading"
            aria-label="Previous page of doctors"
            data-testid="doctors-prev"
            @click="goToDoctorsPage(doctorsPage - 1)"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
            Previous
          </Button>

          <div class="flex items-center gap-1">
            <template v-for="(token, index) in doctorPageTokens" :key="`${token}-${index}`">
              <span
                v-if="token === 'gap'"
                class="px-1 text-sm text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
              <button
                v-else
                type="button"
                class="h-10 min-w-[2.5rem] rounded-xl border px-2 text-sm font-semibold transition-colors duration-150"
                :class="token === doctorsPage
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'"
                :aria-current="token === doctorsPage ? 'page' : undefined"
                :aria-label="`Page ${token}`"
                :disabled="isLoading"
                @click="goToDoctorPage(token)"
              >
                {{ token }}
              </button>
            </template>
          </div>

          <Button
            variant="outline"
            size="sm"
            :disabled="doctorsPage >= doctorsTotalPages || isLoading"
            aria-label="Next page of doctors"
            data-testid="doctors-next"
            @click="goToDoctorsPage(doctorsPage + 1)"
          >
            Next
            <ChevronRight class="size-4" aria-hidden="true" />
          </Button>

          <span
            class="w-full text-center text-sm text-muted-foreground sm:w-auto"
            data-testid="doctors-page-label"
          >
            Page {{ doctorsPage }} of {{ doctorsTotalPages }} · {{ doctorsTotal }} doctors
          </span>
        </nav>
      </section>

      <div class="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <div v-if="selectedDoctor" class="flex flex-wrap items-center justify-center gap-2">
          <span class="text-sm text-muted-foreground">Session type:</span>
          <Button
            size="sm"
            :variant="sessionType === 'ONLINE' ? 'default' : 'outline'"
            data-testid="session-type-online"
            @click="setSessionType('ONLINE')"
          >Online</Button>
          <Button
            size="sm"
            :variant="sessionType === 'IN_CLINIC' ? 'default' : 'outline'"
            data-testid="session-type-in-clinic"
            @click="setSessionType('IN_CLINIC')"
          >In clinic</Button>
        </div>

        <Card v-if="selectedDoctor" class="w-full">
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

        <div v-if="selectedDoctor && availableSlots.length > 0">
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
    </div>

    <!-- Step 2: Review -->
    <div v-else-if="step === 2 && selectedSlot" class="mx-auto w-full max-w-[760px]">
      <h1 class="text-center text-2xl font-semibold tracking-tight text-foreground">
        Review your booking
      </h1>

      <Card class="mt-6 w-full">
        <CardContent class="p-6 sm:p-8">
          <dl class="divide-y divide-border rounded-2xl border border-border">
            <div v-if="selectedDoctor" class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Doctor</dt>
              <dd class="text-sm font-medium text-foreground">{{ selectedDoctor.name }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Session Type</dt>
              <dd class="text-sm font-medium text-foreground">{{ sessionType === 'IN_CLINIC' ? 'In clinic' : 'Online' }}</dd>
            </div>
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
            <div class="flex flex-col gap-1 bg-muted/40 px-5 py-4 sm:flex-row sm:justify-between sm:gap-6">
              <dt class="text-sm font-medium text-foreground">Price</dt>
              <dd class="text-sm leading-relaxed text-muted-foreground sm:max-w-sm sm:text-right">
                <span class="font-medium text-foreground">
                  {{ sessionType === 'ONLINE' ? 'Calculated at confirmation' : 'No online payment' }}
                </span>
                <span class="mt-1 block">
                  <template v-if="sessionType === 'ONLINE'">
                    Based on the academy's current session rate for this {{ selectedSlot.sessionDuration }}-minute consultation. You'll see the exact amount on the payment step before you pay.
                  </template>
                  <template v-else>
                    In-clinic sessions are confirmed without a payment step.
                  </template>
                </span>
              </dd>
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
    <div v-else-if="step === 3" class="mx-auto w-full max-w-[760px]">
      <Card class="w-full">
        <CardContent class="flex flex-col items-center gap-3 p-10 text-center">
          <span class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p class="text-base font-medium text-foreground">Preparing your payment…</p>
          <p class="text-sm text-muted-foreground">Please don't close this window.</p>
        </CardContent>
      </Card>
    </div>

    <p v-if="error" data-testid="booking-error" class="mx-auto w-full max-w-[760px] text-center text-sm text-destructive">
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
