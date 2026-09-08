<script setup lang="ts">
import type { SessionRoomResponse } from '~/modules/patient/composables/types'
import { LogOut, Video } from 'lucide-vue-next'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')
const { user } = useAuth()

const { toast } = useToast()

const status = ref<'loading' | 'waiting' | 'ready' | 'error'>('loading')
const message = ref('')
const session = ref<SessionRoomResponse | null>(null)
const leaveDialogOpen = ref(false)
const leaveDialogShown = ref(false)

let jitsiApi: { dispose: () => void } | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null

async function checkSession() {
  if (status.value === 'ready') return
  try {
    const data = await $fetch<SessionRoomResponse>(`/api/patient/session/${bookingId}`)
    session.value = data
    status.value = 'ready'
    stopPolling()
    window.setTimeout(() => initJitsi(data), 0)
  } catch (e) {
    const msg = (e as { data?: { message?: string } }).data?.message || 'Something went wrong'
    if (msg.includes('not available at this time')) {
      status.value = 'waiting'
      message.value = msg
    } else {
      status.value = 'error'
      message.value = msg
      stopPolling()
    }
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

function loadJitsiScript(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI) {
      resolve((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI)
      return
    }
    const existing = document.querySelector('script[data-jitsi]')
    if (existing) {
      existing.addEventListener('load', () => resolve((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://meet.jit.si/external_api.js'
    script.async = true
    script.dataset.jitsi = 'true'
    script.onload = () => resolve((window as unknown as Record<string, unknown>).JitsiMeetExternalAPI)
    script.onerror = () => reject(new Error('Failed to load Jitsi'))
    document.head.appendChild(script)
  })
}

async function initJitsi(data: SessionRoomResponse) {
  const container = document.getElementById('jitsi-container')
  if (!container) return
  try {
    await loadJitsiScript()
    const JitsiMeetExternalAPI = (window as unknown as Record<string, unknown>).JitsiMeetExternalAPI as new (
      domain: string,
      options: Record<string, unknown>,
    ) => { dispose: () => void }
    jitsiApi = new JitsiMeetExternalAPI(data.jitsiDomain, {
      roomName: data.roomName,
      width: '100%',
      height: '100%',
      parentNode: container,
      userInfo: { displayName: user?.name || 'Patient' },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: true,
        startWithVideoMuted: true,
      },
    })
  } catch {
    status.value = 'error'
    message.value = 'Could not load the video session. Please try again.'
  }
}

function openLeaveDialog() {
  leaveDialogShown.value = true
  leaveDialogOpen.value = true
}

function leaveSession() {
  if (jitsiApi) {
    jitsiApi.dispose()
    jitsiApi = null
  }
  stopPolling()
  navigateTo('/dashboard/appointments')
}

onMounted(() => {
  checkSession()
  pollTimer = setInterval(checkSession, 30 * 1000)
})

onBeforeUnmount(() => {
  stopPolling()
  if (jitsiApi) {
    jitsiApi.dispose()
    jitsiApi = null
  }
})
</script>

<template>
  <div>
    <div v-if="status === 'loading'" class="flex flex-col gap-4">
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-96 w-full" />
    </div>

    <div v-else-if="status === 'waiting'" class="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center" data-testid="session-waiting">
      <Video class="size-12 text-primary" />
      <h2 class="mt-4 text-xl font-semibold text-foreground">Your session starts soon</h2>
      <p class="mt-2 text-sm text-muted-foreground">This page will refresh automatically when your session is ready to join.</p>
      <p class="mt-4 text-xs text-muted-foreground">{{ message }}</p>
    </div>

    <div v-else-if="status === 'error'" class="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center" data-testid="session-error">
      <h2 class="text-xl font-semibold text-destructive">Session unavailable</h2>
      <p class="mt-2 text-sm text-muted-foreground">{{ message }}</p>
    </div>

    <div v-else class="relative flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div class="absolute right-4 top-4 z-10">
        <Button variant="destructive" data-testid="leave-session" @click="openLeaveDialog">
          <LogOut class="size-4" />
          Leave Session
        </Button>
      </div>
      <div id="jitsi-container" class="h-full w-full" data-testid="jitsi-container" />
    </div>

    <Teleport to="body">
      <Dialog v-model:open="leaveDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave session?</DialogTitle>
            <DialogDescription>You will be disconnected from the video session and returned to your appointments.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" data-testid="leave-cancel" @click="leaveDialogOpen = false">
              Stay
            </Button>
            <Button variant="destructive" data-testid="leave-confirm" @click="leaveSession">
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>
