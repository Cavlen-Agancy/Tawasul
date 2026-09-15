<script setup lang="ts">
import type { MeetingLobbyResponse } from '~/modules/session/composables/useMeetingLobby'
import { Clock3, Lock, LogIn, Video } from 'lucide-vue-next'

definePageMeta({
  layout: 'MeetingLayout',
  middleware: 'auth',
})

const route = useRoute()
const meetingId = computed(() => String(route.params.meetingId ?? ''))

const { meeting, status, message, fetchMeeting } = useMeetingLobby()

const joining = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting approval',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
}

const waiting = computed(() => meeting.value !== null && !meeting.value.canJoin)

function isNotJoinableError(code: number | undefined): boolean {
  return code === 404 || code === 403 || code === 409
}

async function refresh() {
  await fetchMeeting(meetingId.value)
  stopPolling()
  if (meeting.value && !meeting.value.canJoin) {
    startPolling()
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await fetchMeeting(meetingId.value)
    if (meeting.value?.canJoin) stopPolling()
  }, 30 * 1000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function formatDateLabel(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(time: string): string {
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = hh >= 12 ? 'PM' : 'AM'
  const hour = hh % 12 === 0 ? 12 : hh % 12
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`
}

function onJoin() {
  if (!meeting.value) return
  joining.value = true
  // Video provider integration lands behind this seam; for now arriving at the
  // lobby with canJoin is the reachable target (see phases 3–4 of the plan).
  window.setTimeout(() => {
    joining.value = false
  }, 800)
}

onMounted(refresh)
onBeforeUnmount(stopPolling)
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="status === 'loading'" class="flex flex-col gap-4" data-testid="meeting-loading">
      <Skeleton class="h-10 w-2/3" />
      <Skeleton class="h-64 w-full" />
    </div>

    <!-- Error / not authorized / not confirmed / not found -->
    <div
      v-else-if="status === 'error' || waiting"
      class="rounded-2xl border border-border bg-card p-8 text-center"
      :data-testid="waiting ? 'meeting-waiting' : 'meeting-error'"
    >
      <Clock3 v-if="waiting" class="mx-auto size-12 text-primary" />
      <Lock v-else class="mx-auto size-12 text-destructive" />
      <h2 class="mt-4 text-xl font-semibold text-foreground">
        {{ waiting ? 'Meeting not open yet' : 'Meeting unavailable' }}
      </h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        <template v-if="meeting">
          This appointment is {{ STATUS_LABEL[meeting.status] || meeting.status }}. It can be joined starting
          5 minutes before the session and up to 15 minutes after it ends.
        </template>
        <template v-else>{{ message }}</template>
      </p>
    </div>

    <!-- Ready to join -->
    <div
      v-else-if="meeting"
      class="overflow-hidden rounded-2xl border border-border bg-card"
      data-testid="meeting-lobby"
    >
      <div class="h-1.5 bg-primary" />
      <div class="p-6 md:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-muted-foreground" data-testid="meeting-role">
              You are the {{ meeting.role }} in this meeting
            </p>
            <h1 class="mt-1 text-2xl font-semibold text-foreground">{{ meeting.service }}</h1>
            <p class="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 class="size-4" />
              {{ formatDateLabel(meeting.date) }} · {{ formatTime(meeting.startTime) }} – {{ formatTime(meeting.endTime) }}
            </p>
          </div>
          <span
            class="rounded-full px-3 py-1 text-xs font-semibold"
            :class="meeting.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
            data-testid="meeting-status"
          >
            {{ STATUS_LABEL[meeting.status] || meeting.status }}
          </span>
        </div>

        <dl class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="rounded-xl border border-border bg-muted/40 p-4" data-testid="meeting-doctor">
            <dt class="text-xs text-muted-foreground">Provider</dt>
            <dd class="mt-1 font-medium text-foreground">{{ meeting.doctorName }}</dd>
          </div>
          <div class="rounded-xl border border-border bg-muted/40 p-4" data-testid="meeting-patient">
            <dt class="text-xs text-muted-foreground">Patient</dt>
            <dd class="mt-1 font-medium text-foreground">{{ meeting.patientName }}</dd>
          </div>
        </dl>

        <div class="mt-8 flex flex-col items-center gap-3">
          <!-- Video provider seam: replace onJoin with real LiveKit/WebRTC integration. -->
          <Button
            size="lg"
            data-testid="join-meeting"
            class="w-full sm:w-auto"
            :disabled="joining"
            @click="onJoin"
          >
            <template v-if="joining">
              <Video class="size-5 animate-pulse" />
              Preparing…
            </template>
            <template v-else>
              <LogIn class="size-5" />
              Join Meeting
            </template>
          </Button>
          <p class="text-xs text-muted-foreground">
            The video room will open here. This screen refreshes automatically when your window opens.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>