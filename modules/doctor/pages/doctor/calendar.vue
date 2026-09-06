<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar as CalendarIcon } from 'lucide-vue-next'
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
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

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

const calendarEvents = computed(() =>
  bookings.value.map((b: DoctorBooking) => ({
    id: b.id,
    title: `${b.patientName} ${formatTime(b.startTime)}`,
    start: `${b.date}T${b.startTime}`,
    end: `${b.date}T${b.endTime}`,
    classNames: [b.status === 'CANCELLED' ? 'fc-tawasul-event-cancelled' : 'fc-tawasul-event-confirmed'],
    extendedProps: { bookingId: b.id },
  })),
)

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay',
  },
  height: 'auto',
  events: calendarEvents.value,
  datesSet: onDatesSet,
  eventClick: onEventClick,
}))

function onDatesSet(info: DatesSetArg) {
  if (datesSetTimer) clearTimeout(datesSetTimer)
  datesSetTimer = setTimeout(() => {
    const start = toISODate(info.view.activeStart)
    const end = toISODate(info.view.activeEnd)
    void fetchBookings(start, end)
  }, 100)
}

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
  <div class="mx-auto w-full max-w-[1100px]">
    <div class="flex items-center gap-2">
      <CalendarIcon class="size-5 text-primary" />
      <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
        My Calendar
      </h1>
    </div>
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <Card class="mt-6 w-full overflow-hidden">
      <CardContent class="p-3 sm:p-5">
        <ClientOnly>
          <FullCalendar :options="calendarOptions" />
          <template #fallback>
            <div class="py-10 text-center text-sm text-muted-foreground">Loading calendar…</div>
          </template>
        </ClientOnly>
      </CardContent>
    </Card>

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
.fc-tawasul-event-confirmed {
  background-color: #e91e8c;
  border-color: #e91e8c;
}
.fc-tawasul-event-cancelled {
  background-color: #94a3b8;
  border-color: #94a3b8;
  opacity: 0.5;
}
</style>
