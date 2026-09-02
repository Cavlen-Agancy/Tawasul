<script setup lang="ts">
import { CalendarDays, Play, Video } from 'lucide-vue-next'
import type { Appointment } from '~/modules/patient/composables/types'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const { upcomingAppointments, pastAppointments, isLoading, error, fetchAppointments, cancelAppointment } =
  usePatientDashboard()
const { toast } = useToast()

const activeTab = ref('upcoming')
const cancelTarget = ref<Appointment | null>(null)
const cancelDialogOpen = ref(false)
const cancelling = ref(false)
const now = ref(new Date())

function parseBookingDateTime(dateISO: string, time: string): Date {
  const [y, m, d] = dateISO.split('-').map((v) => parseInt(v, 10))
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0)
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

function formatDateLabel(appt: Appointment): string {
  return sessionStart(appt).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTimeRange(appt: Appointment): string {
  return `${formatTime(appt.startTime)} – ${formatTime(appt.endTime)}`
}

function formatTime(time: string): string {
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = hh >= 12 ? 'PM' : 'AM'
  const hour = hh % 12 === 0 ? 12 : hh % 12
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`
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
  } catch (e) {
    toast({ title: (e as { data?: { message?: string } }).data?.message || 'Could not cancel appointment', variant: 'destructive' })
  } finally {
    cancelling.value = false
  }
}

onMounted(async () => {
  await fetchAppointments()
  now.value = new Date()
  window.setInterval(() => {
    now.value = new Date()
  }, 60 * 1000)
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
      My Appointments
    </h1>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <Tabs v-model="activeTab" class="mt-6">
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        <TabsTrigger value="past">Past</TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming">
        <div class="mt-4 space-y-4">
          <div v-if="isLoading" class="grid gap-4 sm:grid-cols-2">
            <Skeleton v-for="i in 3" :key="i" class="h-40 w-full" />
          </div>

          <div v-else-if="upcomingAppointments.length === 0" data-testid="upcoming-empty">
            <Card class="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <CalendarDays class="size-10 text-muted-foreground" />
              <p class="text-sm text-muted-foreground">No upcoming appointments. Book your first session.</p>
              <Button as="a" href="/book">Book Now</Button>
            </Card>
          </div>

          <Card v-for="appt in upcomingAppointments" :key="appt.id" class="p-5" data-testid="appointment-card">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-4">
                <Avatar class="size-12">
                  <AvatarImage :src="appt.doctorPhoto" :alt="appt.doctorName" />
                  <AvatarFallback>{{ appt.doctorName.slice(0, 1) }}</AvatarFallback>
                </Avatar>
                <div>
                  <p class="font-semibold text-foreground">{{ appt.doctorName }}</p>
                  <p class="mt-0.5 text-sm text-muted-foreground" data-testid="appt-date">{{ formatDateLabel(appt) }}</p>
                  <p class="text-sm text-muted-foreground" data-testid="appt-time">{{ formatTimeRange(appt) }}</p>
                  <p class="mt-1 text-sm font-medium text-foreground">{{ appt.service }}</p>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <a
                  :href="canJoin(appt) ? `/dashboard/session/${appt.id}` : undefined"
                  :data-testid="`join-${appt.id}`"
                  :title="canJoin(appt) ? 'Join your session' : 'Available 5 minutes before your session'"
                  class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out"
                  :class="canJoin(appt)
                    ? 'bg-primary text-primary-foreground shadow-magenta hover:bg-primary/90 active:scale-[0.98]'
                    : 'pointer-events-none bg-secondary text-muted-foreground opacity-60'"
                >
                  <Video class="size-4" />
                  Join Session
                </a>
                <Button
                  v-if="canCancel(appt)"
                  variant="outline"
                  size="sm"
                  data-testid="cancel-booking"
                  @click="openCancelDialog(appt)"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="past">
        <div class="mt-4 space-y-4">
          <div v-if="isLoading" class="grid gap-4 sm:grid-cols-2">
            <Skeleton v-for="i in 3" :key="i" class="h-40 w-full" />
          </div>

          <div v-else-if="pastAppointments.length === 0" data-testid="past-empty">
            <Card class="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <CalendarDays class="size-10 text-muted-foreground" />
              <p class="text-sm text-muted-foreground">No past appointments.</p>
            </Card>
          </div>

          <Card v-for="appt in pastAppointments" :key="appt.id" class="p-5" data-testid="appointment-card">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-4">
                <Avatar class="size-12">
                  <AvatarImage :src="appt.doctorPhoto" :alt="appt.doctorName" />
                  <AvatarFallback>{{ appt.doctorName.slice(0, 1) }}</AvatarFallback>
                </Avatar>
                <div>
                  <p class="font-semibold text-foreground">{{ appt.doctorName }}</p>
                  <p class="mt-0.5 text-sm text-muted-foreground">{{ formatDateLabel(appt) }}</p>
                  <p class="text-sm text-muted-foreground">{{ formatTimeRange(appt) }}</p>
                  <p class="mt-1 text-sm font-medium text-foreground">{{ appt.service }}</p>
                </div>
              </div>
              <Badge :variant="appt.status === 'CANCELLED' ? 'cancelled' : 'success'">
                {{ appt.status === 'CANCELLED' ? 'Cancelled' : 'Completed' }}
              </Badge>
            </div>
          </Card>
        </div>
      </TabsContent>
    </Tabs>

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
