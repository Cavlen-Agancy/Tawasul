<script setup lang="ts">
import { CalendarX2, Video } from 'lucide-vue-next'
import type { Appointment } from '~/modules/patient/composables/types'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const {
  upcomingAppointments,
  pastAppointments,
  isLoading,
  error,
  fetchAppointments,
  cancelAppointment,
} = usePatientDashboard()
const { toast } = useToast()

const activeTab = ref('upcoming')
const now = ref(Date.now())

const cancelTarget = ref<Appointment | null>(null)
const cancelDialogOpen = ref(false)
const cancelling = ref(false)

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
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not cancel appointment',
      variant: 'destructive',
    })
  } finally {
    cancelling.value = false
  }
}

onMounted(() => {
  void fetchAppointments()
  window.setInterval(() => {
    now.value = Date.now()
  }, 60 * 1000)
})
</script>

<template>
  <div class="mx-auto w-full max-w-[900px]">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
        My Appointments
      </h1>
      <Button as="a" href="/book" data-testid="book-session-button">
        <CalendarX2 class="size-4" />
        Book a Session
      </Button>
    </div>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div v-if="isLoading" class="mt-6 grid gap-4">
      <Skeleton v-for="i in 3" :key="i" class="h-28 w-full" />
    </div>

    <Tabs v-else v-model="activeTab" class="mt-6 w-full" data-testid="appointments-tabs">
      <TabsList>
        <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
        <TabsTrigger value="past" data-testid="tab-past">Past</TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" class="mt-4">
        <div v-if="upcomingAppointments.length === 0" class="flex flex-col items-center rounded-2xl border border-border bg-white p-10 text-center" data-testid="no-upcoming">
          <Video class="size-10 text-muted-foreground" />
          <p class="mt-3 font-medium text-foreground">No upcoming appointments. Book your first session.</p>
          <Button as="a" href="/book" class="mt-4" data-testid="book-now-empty">Book Now</Button>
        </div>
        <div v-else class="grid gap-4">
          <Card
            v-for="appt in upcomingAppointments"
            :key="appt.id"
            class="overflow-hidden"
            :data-testid="`appointment-${appt.id}`"
          >
            <CardContent class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <Avatar class="size-14 shrink-0">
                <AvatarImage :src="appt.doctorPhoto || undefined" :alt="appt.doctorName" />
                <AvatarFallback class="text-lg">{{ appt.doctorName.slice(0, 1).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <p class="truncate text-base font-semibold text-foreground">{{ appt.doctorName }}</p>
                <p class="mt-0.5 text-sm text-muted-foreground">{{ formatDateLabel(appt.date) }}</p>
                <p class="text-sm text-muted-foreground">{{ formatTime(appt.startTime) }} – {{ formatTime(appt.endTime) }}</p>
                <p class="mt-1 text-sm text-muted-foreground">{{ appt.service }}</p>
              </div>
              <div class="flex shrink-0 flex-col gap-2 sm:items-end">
                <Button
                  :variant="canJoin(appt) ? 'default' : 'secondary'"
                  :disabled="!canJoin(appt)"
                  :title="!canJoin(appt) ? 'Available 5 minutes before your session' : undefined"
                  :data-testid="`join-${appt.id}`"
                  @click="joinSession(appt)"
                >
                  Join Session
                </Button>
                <Button
                  v-if="canCancel(appt)"
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
      </TabsContent>

      <TabsContent value="past" class="mt-4">
        <div v-if="pastAppointments.length === 0" class="flex flex-col items-center rounded-2xl border border-border bg-white p-10 text-center" data-testid="no-past">
          <p class="font-medium text-foreground">No past appointments.</p>
        </div>
        <div v-else class="grid gap-4">
          <Card
            v-for="appt in pastAppointments"
            :key="appt.id"
            class="overflow-hidden"
            :data-testid="`past-appointment-${appt.id}`"
          >
            <CardContent class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <Avatar class="size-14 shrink-0">
                <AvatarImage :src="appt.doctorPhoto || undefined" :alt="appt.doctorName" />
                <AvatarFallback class="text-lg">{{ appt.doctorName.slice(0, 1).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <p class="truncate text-base font-semibold text-foreground">{{ appt.doctorName }}</p>
                <p class="mt-0.5 text-sm text-muted-foreground">{{ formatDateLabel(appt.date) }}</p>
                <p class="text-sm text-muted-foreground">{{ formatTime(appt.startTime) }} – {{ formatTime(appt.endTime) }}</p>
                <p class="mt-1 text-sm text-muted-foreground">{{ appt.service }}</p>
              </div>
              <Badge :variant="appt.status === 'CANCELLED' ? 'secondary' : 'default'">
                {{ appt.status === 'CANCELLED' ? 'Cancelled' : 'Completed' }}
              </Badge>
            </CardContent>
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
