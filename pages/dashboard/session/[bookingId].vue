<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  User,
  Sparkles,
  Stethoscope,
  ChevronLeft,
  Settings,
  X,
  Check,
} from 'lucide-vue-next'
import { useSessionI18n } from '~/composables/useSessionI18n'

interface SessionInfo {
  doctorName?: string
  patientName?: string
  date?: string | Date
  startTime?: string
  endTime?: string
  service?: string
}

interface SessionTokenResponse {
  roomName: string
  liveKitToken: string
  sessionInfo?: SessionInfo
}

definePageMeta({
  layout: 'session',
  middleware: ['auth', 'patient-only'],
  pageTransition: false,
  layoutTransition: false,
})

const route = useRoute()
const router = useRouter()
const bookingId = String(route.params.bookingId ?? '')
const config = useRuntimeConfig()
const serverUrl = String(config.public.liveKitUrl || 'ws://localhost:7880')

const { t, formatDeviceLabel, locale } = useSessionI18n()

// ── Non-blocking token fetch ─────────────────────────────
// NOTE: never top-level `await` here — that suspends route navigation
// (Nuxt <Suspense>) and freezes the UI on "In Session" click.
const tokenData = ref<SessionTokenResponse | null>(null)
const tokenError = ref<{ statusCode?: number; data?: { message?: string }; message?: string } | null>(null)
const isFetchingToken = ref(true)

async function fetchToken() {
  if (import.meta.dev) console.log('[Patient][Session] route mounted, fetching token')
  isFetchingToken.value = true
  tokenError.value = null
  try {
    const res = await $fetch<SessionTokenResponse>(`/api/patient/session/${bookingId}`)
    tokenData.value = res
    if (import.meta.dev) console.log('[Patient][Session] token received')
  } catch (e: unknown) {
    tokenError.value = e as typeof tokenError.value
  } finally {
    isFetchingToken.value = false
  }
}

const token = computed(() => tokenData.value?.liveKitToken)
const sessionInfo = computed(() => tokenData.value?.sessionInfo)
const error = tokenError

function refresh() {
  bootSession()
}

// Determine if we're outside join window
const isOutsideJoinWindow = computed(() => {
  if (!tokenError.value) return false
  const status = tokenError.value.statusCode
  const msg = tokenError.value.data?.message || tokenError.value.message || ''
  return status === 403 && (msg.includes('not available') || msg.includes('window') || msg.includes('time'))
})

// Initialize LiveKit composable
const {
  room,
  connectionState,
  isWaiting,
  isDoctorPresent,
  isMicEnabled,
  isCamEnabled,
  isSpeakerMuted,
  isTogglingMic,
  isTogglingCam,
  isConnecting,
  mediaError,
  connectionError,
  deviceNotification,
  localVideoTrack,
  remoteVideoTracks,
  remoteAudioTracks,
  audioInputDevices,
  audioOutputDevices,
  videoInputDevices,
  selectedAudioInputId,
  selectedAudioOutputId,
  selectedVideoInputId,
  isSpeakerOutputSupported,
  switchMicrophone,
  switchCamera,
  switchSpeaker,
  loadingStage,
  initLocalPreview,
  connectRoom,
  toggleMicrophone,
  toggleCamera,
  toggleSpeaker,
  attachLocalVideo,
  attachRemoteVideo,
  attachRemoteAudio,
  leaveSession,
} = useLiveKitSession({
  serverUrl,
  token,
  isModerator: false,
  onDisconnected: () => {
    router.push('/dashboard/appointments')
  },
})

// DOM Video References
const waitingVideoRef = ref<HTMLVideoElement | null>(null)
const sessionLocalVideoRef = ref<HTMLVideoElement | null>(null)
const showLeaveModal = ref(false)
const showSettingsMenu = ref(false)

// Session Timer (starts when admitted into session)
const sessionDuration = ref(0)
let sessionTimerInterval: ReturnType<typeof setInterval> | null = null

const formattedTimer = computed(() => {
  const m = Math.floor(sessionDuration.value / 60)
  const s = sessionDuration.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

watch(isWaiting, (waiting) => {
  if (!waiting) {
    if (!sessionTimerInterval) {
      sessionTimerInterval = setInterval(() => {
        sessionDuration.value++
      }, 1000)
    }
  } else {
    if (sessionTimerInterval) {
      clearInterval(sessionTimerInterval)
      sessionTimerInterval = null
    }
    sessionDuration.value = 0
  }
})

// Attach local video track whenever element mounts or cam state changes
watch(waitingVideoRef, (el) => {
  if (el && isCamEnabled.value) {
    attachLocalVideo(el)
  }
})

watch(sessionLocalVideoRef, (el) => {
  if (el && isCamEnabled.value) {
    attachLocalVideo(el)
  }
})

watch(isCamEnabled, (enabled) => {
  if (enabled) {
    nextTick(() => {
      if (isWaiting.value && waitingVideoRef.value) {
        attachLocalVideo(waitingVideoRef.value)
      } else if (!isWaiting.value && sessionLocalVideoRef.value) {
        attachLocalVideo(sessionLocalVideoRef.value)
      }
    })
  }
})

// First remote video (primary doctor stage)
const primaryRemoteVideo = computed(() => remoteVideoTracks.value[0] || null)

const confirmedExit = ref(false)
let bootInFlight = false

// ── Staged, non-blocking boot ────────────────────────────
// Route mounts instantly -> shell UI -> token -> connect -> media.
// No single `await` here is allowed to freeze the page: each stage
// has its own visible state and connectRoom carries a 15s timeout.
async function bootSession() {
  if (bootInFlight) return
  bootInFlight = true
  try {
    await fetchToken()
    if (tokenError.value || !token.value) return

    // Fire-and-forget media preview: must never block room connect.
    // A denied/slow camera must not freeze session entry.
    initLocalPreview(true, true)
      .then((ok) => {
        if (ok && waitingVideoRef.value && isCamEnabled.value) {
          attachLocalVideo(waitingVideoRef.value)
        }
      })
      .catch(() => {})

    // Room connect runs after preview *started* (not after it finished).
    if (import.meta.dev) console.log('[Patient][Session] connecting to LiveKit')
    await connectRoom(token.value)
  } finally {
    bootInFlight = false
  }
}

function retryBoot() {
  bootSession()
}

onMounted(() => {
  bootSession()
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval)
    sessionTimerInterval = null
  }
  if (import.meta.dev) console.log('[Patient][Session] cleanup complete')
  leaveSession()
})

// Guard against accidental loss of an active session.
onBeforeRouteLeave(() => {
  if (confirmedExit.value) return true
  const active = !isFetchingToken.value && !tokenError.value && loadingStage.value !== 'failed'
  if (!active) return true
  showLeaveModal.value = true
  return false
})

function handleBeforeUnload(e: BeforeUnloadEvent) {
  const active = !isFetchingToken.value && !tokenError.value && loadingStage.value !== 'failed'
  if (active && !confirmedExit.value) {
    e.preventDefault()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', handleBeforeUnload)
}

function onConfirmLeave() {
  confirmedExit.value = true
  showLeaveModal.value = false
  if (import.meta.dev) console.log('[Patient][Session] leaving')
  leaveSession()
  router.push('/dashboard/appointments')
}

function formatDate(val: string | Date | undefined) {
  if (!val) return 'Today'
  try {
    const d = new Date(val)
    return d.toLocaleDateString(locale.value === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return String(val)
  }
}
</script>

<template>
  <div :dir="locale === 'ar' ? 'rtl' : 'ltr'" class="session-root flex h-[100dvh] w-full flex-col overflow-hidden font-sans text-foreground">
    <!-- Boot shell: route mounted instantly, token/connect in flight (never blank) -->
    <div
      v-if="isFetchingToken"
      class="flex flex-1 flex-col items-center justify-center bg-slate-950 p-6 text-center text-white"
      data-testid="session-connecting"
    >
      <div class="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Loader2 class="size-7 animate-spin" />
        </div>
        <h2 class="text-lg font-bold">{{ t('session.loading.fetchingToken') }}</h2>
        <p class="mt-2 text-xs text-slate-400">{{ t('session.loading.connecting') }}</p>
      </div>
    </div>

    <!-- Connection failed: explicit error state with Retry / Exit (no reload loops) -->
    <div
      v-else-if="loadingStage === 'failed'"
      class="flex flex-1 flex-col items-center justify-center bg-slate-950 p-6 text-center text-white"
      data-testid="session-error"
    >
      <div class="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
          <AlertCircle class="size-8" />
        </div>
        <h2 class="text-lg font-bold">{{ t('session.state.loadErrorTitle') }}</h2>
        <p class="mt-2 text-xs text-slate-400">{{ connectionError || t('session.state.connectError') }}</p>
        <div class="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            class="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition"
            data-testid="session-retry"
            @click="retryBoot"
          >
            {{ t('session.state.retry') }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition"
            data-testid="session-exit"
            @click="onConfirmLeave"
          >
            {{ t('session.state.backToAppointments') }}
          </button>
        </div>
      </div>
    </div>

    <!-- State 0: Outside Join Window (E2E & Safety Fallback) -->
    <div
      v-else-if="isOutsideJoinWindow"
      class="flex flex-1 flex-col items-center justify-center p-6 text-center"
      data-testid="session-waiting"
    >
      <div class="w-full max-w-md rounded-3xl border border-border/80 bg-card p-8 shadow-xl">
        <div class="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Clock class="size-8" />
        </div>
        <h2 class="text-2xl font-bold tracking-tight text-foreground">{{ t('session.state.startsSoonTitle') }}</h2>
        <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
          {{ t('session.state.startsSoonDesc') }}
        </p>
        <div class="mt-8 flex justify-center">
          <NuxtLink
            to="/dashboard/appointments"
            class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90"
          >
            <ChevronLeft class="size-4" />
            {{ t('session.state.backToAppointments') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- State 1: General Error loading session -->
    <div
      v-else-if="error"
      class="flex flex-1 flex-col items-center justify-center p-6 text-center"
    >
      <div class="w-full max-w-md rounded-3xl border border-border/80 bg-card p-8 shadow-xl">
        <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle class="size-8" />
        </div>
        <h3 class="text-xl font-bold text-foreground">{{ t('session.state.loadErrorTitle') }}</h3>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ error.data?.message || error.message || t('session.state.loadErrorTitle') }}
        </p>
        <div class="mt-6 flex justify-center gap-3">
          <button
            class="rounded-xl bg-secondary px-5 py-2.5 text-sm font-medium hover:bg-secondary/80"
            @click="() => refresh()"
          >
            {{ t('session.state.retry') }}
          </button>
          <NuxtLink
            to="/dashboard/appointments"
            class="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            {{ t('session.state.backToAppointments') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- State 2: Patient Virtual Waiting Room (Phase 5) -->
    <div v-else-if="isWaiting" class="waiting-room-wrapper flex-1 flex flex-col overflow-y-auto bg-background p-4 md:p-6 lg:p-8">
      <!-- Transient connecting badge: room connect / media init in flight -->
      <div
        v-if="loadingStage === 'connecting' || loadingStage === 'initializing_media'"
        class="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary"
        data-testid="session-connecting"
      >
        <Loader2 class="size-4 animate-spin" />
        <span>{{ loadingStage === 'connecting' ? t('session.loading.connecting') : t('session.loading.initMedia') }}</span>
      </div>
      <!-- Waiting Room Header -->
      <header class="flex items-center justify-between border-b border-border/40 pb-4 mb-6">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
            T
          </div>
          <div>
            <h1 class="text-lg font-bold text-foreground flex items-center gap-2">
              {{ t('session.waitingRoom.brand') }}
            </h1>
            <p class="text-xs text-muted-foreground">{{ t('session.waitingRoom.subBrand') }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-xs text-muted-foreground">
            <span class="size-2 rounded-full bg-amber-500 animate-pulse"></span>
            {{ t('session.waitingRoom.badge') }}
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition"
            data-testid="leave-waiting-room"
            @click="showLeaveModal = true"
          >
            <PhoneOff class="size-4" />
            <span class="hidden sm:inline">{{ t('session.waitingRoom.leaveBtn') }}</span>
          </button>
        </div>
      </header>

      <!-- Notifications & Alerts -->
      <div
        v-if="deviceNotification"
        class="mb-4 flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-xs text-primary transition animate-fade-in"
      >
        <Sparkles class="size-4 shrink-0" />
        <span>{{ deviceNotification }}</span>
      </div>

      <div
        v-if="mediaError"
        class="mb-4 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-300"
      >
        <AlertCircle class="size-5 shrink-0 text-rose-500 mt-0.5" />
        <div class="flex-1">
          <p class="font-medium text-rose-700 dark:text-rose-200">{{ t('session.media.alertTitle') }}</p>
          <p class="mt-0.5 text-xs text-rose-600/90 dark:text-rose-300/90">{{ mediaError }}</p>
        </div>
      </div>

      <!-- Main Waiting Room Content (2-Column Grid on Desktop) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-center">
        <!-- Column 1: Camera Preview & Local Controls -->
        <div class="lg:col-span-7 flex flex-col items-center justify-center">
          <div class="w-full max-w-xl">
            <!-- Preview Box -->
            <div class="relative aspect-video w-full overflow-hidden rounded-3xl border border-border/80 bg-slate-950 shadow-2xl">
              <!-- Active Camera Stream -->
              <video
                v-show="isCamEnabled"
                ref="waitingVideoRef"
                autoplay
                playsinline
                muted
                class="size-full object-cover scale-x-[-1]"
              />

              <!-- Camera Disabled Placeholder -->
              <div
                v-show="!isCamEnabled"
                class="flex size-full flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center text-slate-300"
              >
                <div class="relative mb-4 flex size-24 items-center justify-center rounded-full bg-slate-800/80 border border-slate-700/60 shadow-inner">
                  <User class="size-12 text-slate-400" />
                  <span class="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full bg-rose-500/90 text-white shadow">
                    <VideoOff class="size-3.5" />
                  </span>
                </div>
                <h4 class="text-base font-semibold text-white">{{ t('session.waitingRoom.cameraOffTitle') }}</h4>
                <p class="mt-1 text-xs text-slate-400 max-w-xs">
                  {{ t('session.waitingRoom.cameraOffDesc') }}
                </p>
              </div>

              <!-- Top Overlay Badge -->
              <div class="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs text-white border border-white/10">
                <span class="size-2 rounded-full" :class="isCamEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'"></span>
                {{ isCamEnabled ? t('session.waitingRoom.cameraActive') : t('session.waitingRoom.cameraOff') }}
              </div>

              <!-- Bottom Overlay Badge: Mic state -->
              <div class="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs text-white border border-white/10">
                <component :is="isMicEnabled ? Mic : MicOff" class="size-3.5" :class="isMicEnabled ? 'text-emerald-400' : 'text-rose-400'" />
                {{ isMicEnabled ? t('session.waitingRoom.micReady') : t('session.waitingRoom.micMuted') }}
              </div>
            </div>

            <!-- Media Toggle Controls under preview -->
            <div class="mt-4 flex items-center justify-center gap-3">
              <!-- Mic Button -->
              <button
                type="button"
                :disabled="isTogglingMic"
                class="flex-1 flex items-center justify-center gap-2.5 rounded-2xl py-3 px-4 text-sm font-semibold border transition shadow-sm"
                :class="isMicEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20 dark:text-rose-400'"
                data-testid="toggle-mic"
                :aria-label="t('session.controls.microphone')"
                @click="toggleMicrophone"
              >
                <Loader2 v-if="isTogglingMic" class="size-4 animate-spin" />
                <component :is="isMicEnabled ? Mic : MicOff" v-else class="size-4" />
                <span>{{ isMicEnabled ? t('session.waitingRoom.micOnLabel') : t('session.waitingRoom.micOffLabel') }}</span>
              </button>

              <!-- Cam Button -->
              <button
                type="button"
                :disabled="isTogglingCam"
                class="flex-1 flex items-center justify-center gap-2.5 rounded-2xl py-3 px-4 text-sm font-semibold border transition shadow-sm"
                :class="isCamEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20 dark:text-rose-400'"
                data-testid="toggle-cam"
                :aria-label="t('session.controls.camera')"
                @click="toggleCamera"
              >
                <Loader2 v-if="isTogglingCam" class="size-4 animate-spin" />
                <component :is="isCamEnabled ? Video : VideoOff" v-else class="size-4" />
                <span>{{ isCamEnabled ? t('session.waitingRoom.camOnLabel') : t('session.waitingRoom.camOffLabel') }}</span>
              </button>
            </div>

            <!-- Media Device Selectors in Waiting Room (Section 7) -->
            <div class="mt-5 rounded-2xl border border-border/80 bg-card/60 p-4 space-y-3.5 shadow-sm">
              <h5 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Settings class="size-3.5 text-primary" />
                {{ t('session.devices.title') }}
              </h5>

              <!-- Microphone Selector -->
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Mic class="size-3 text-muted-foreground" />
                  {{ t('session.devices.microphone') }}
                </label>
                <select
                  v-model="selectedAudioInputId"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="waiting-select-mic"
                  @change="switchMicrophone(selectedAudioInputId)"
                >
                  <option v-if="audioInputDevices.length === 0" value="">
                    {{ t('session.devices.defaultMic') }}
                  </option>
                  <option
                    v-for="(dev, idx) in audioInputDevices"
                    :key="dev.deviceId"
                    :value="dev.deviceId"
                  >
                    {{ formatDeviceLabel(dev, idx, 'audioinput') }}
                  </option>
                </select>
              </div>

              <!-- Speaker Selector -->
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Volume2 class="size-3 text-muted-foreground" />
                  {{ t('session.devices.speaker') }}
                </label>
                <select
                  v-model="selectedAudioOutputId"
                  :disabled="!isSpeakerOutputSupported"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  data-testid="waiting-select-speaker"
                  @change="switchSpeaker(selectedAudioOutputId)"
                >
                  <option v-if="audioOutputDevices.length === 0 || !isSpeakerOutputSupported" value="">
                    {{ isSpeakerOutputSupported ? t('session.devices.defaultSpeaker') : t('session.devices.speakerNotSupported') }}
                  </option>
                  <option
                    v-for="(dev, idx) in audioOutputDevices"
                    :key="dev.deviceId"
                    :value="dev.deviceId"
                  >
                    {{ formatDeviceLabel(dev, idx, 'audiooutput') }}
                  </option>
                </select>
                <p v-if="!isSpeakerOutputSupported" class="text-[10px] text-muted-foreground">
                  {{ t('session.devices.speakerNotSupported') }}
                </p>
              </div>

              <!-- Camera Selector -->
              <div class="space-y-1">
                <label class="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Video class="size-3 text-muted-foreground" />
                  {{ t('session.devices.camera') }}
                </label>
                <select
                  v-model="selectedVideoInputId"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="waiting-select-cam"
                  @change="switchCamera(selectedVideoInputId)"
                >
                  <option v-if="videoInputDevices.length === 0" value="">
                    {{ t('session.devices.defaultCam') }}
                  </option>
                  <option
                    v-for="(dev, idx) in videoInputDevices"
                    :key="dev.deviceId"
                    :value="dev.deviceId"
                  >
                    {{ formatDeviceLabel(dev, idx, 'videoinput') }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Column 2: Session Details & Doctor Approval State -->
        <div class="lg:col-span-5 flex flex-col justify-center">
          <div class="rounded-3xl border border-border/80 bg-card p-6 md:p-8 shadow-lg">
            <!-- Doctor Header -->
            <div class="flex items-center gap-4 pb-6 border-b border-border/50">
              <div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-soft">
                <Stethoscope class="size-7" />
              </div>
              <div class="min-w-0 flex-1">
                <span class="inline-block text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full mb-1">
                  {{ sessionInfo?.service || t('session.active.service') }}
                </span>
                <h3 class="text-xl font-bold text-foreground truncate">
                  {{ sessionInfo?.doctorName ? `Dr. ${sessionInfo.doctorName}` : t('session.waitingRoom.doctorAssigned') }}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {{ formatDate(sessionInfo?.date) }} {{ sessionInfo?.startTime ? `• ${sessionInfo.startTime}` : '' }}
                </p>
              </div>
            </div>

            <!-- Approval State Card -->
            <div class="mt-6">
              <!-- Case A: Doctor is present -> Waiting for approval -->
              <div
                v-if="isDoctorPresent"
                class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center"
              >
                <div class="relative mx-auto mb-3 flex size-12 items-center justify-center">
                  <span class="absolute inline-flex size-full rounded-full bg-amber-400 opacity-30 animate-ping"></span>
                  <div class="flex size-10 items-center justify-center rounded-full bg-amber-500 text-white shadow">
                    <Sparkles class="size-5" />
                  </div>
                </div>
                <h4 class="text-base font-bold text-amber-900 dark:text-amber-200">
                  {{ t('session.waitingRoom.doctorPresentTitle') }}
                </h4>
                <p class="mt-1 text-sm text-amber-800/90 dark:text-amber-300 font-medium">
                  {{ t('session.waitingRoom.waitingForApproval') }}
                </p>
                <p class="mt-2 text-xs text-amber-700/80 dark:text-amber-300/70">
                  {{ t('session.waitingRoom.autoJoinNote') }}
                </p>
              </div>

              <!-- Case B: Doctor not yet in room -->
              <div
                v-else
                class="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center"
              >
                <div class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Clock class="size-6 animate-pulse" />
                </div>
                <h4 class="text-base font-bold text-foreground">
                  {{ t('session.waitingRoom.waitingForDoctorTitle') }}
                </h4>
                <p class="mt-1 text-sm text-muted-foreground">
                  {{ t('session.waitingRoom.waitingForDoctorDesc') }}
                </p>
                <div class="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span class="size-2 rounded-full bg-emerald-500"></span>
                  <span>{{ t('session.waitingRoom.serverConnected') }}</span>
                </div>
              </div>
            </div>

            <!-- Helpful Guidance Tips -->
            <div class="mt-6 rounded-2xl bg-muted/60 p-4 text-xs text-muted-foreground leading-relaxed border border-border/40">
              <p class="font-semibold text-foreground mb-1.5">💡 {{ t('session.waitingRoom.tipsTitle') }}</p>
              <ul class="list-disc list-inside space-y-1">
                <li>{{ t('session.waitingRoom.tipHeadphones') }}</li>
                <li>{{ t('session.waitingRoom.tipLighting') }}</li>
                <li>{{ t('session.waitingRoom.tipPrivacy') }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- State 3: Active Online Session (Phase 6) -->
    <div v-else class="session-active-stage flex min-h-0 flex-1 flex-col relative bg-slate-950 text-white overflow-hidden">
      <!-- Top Session Info Bar -->
      <header class="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div class="flex items-center gap-3">
          <div class="flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-white">
            <Stethoscope class="size-5 text-primary" />
          </div>
          <div>
            <h2 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              {{ sessionInfo?.doctorName ? `Dr. ${sessionInfo.doctorName}` : t('session.waitingRoom.doctorAssigned') }}
              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-normal text-emerald-400">
                <span class="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {{ t('session.active.live') }}
              </span>
            </h2>
            <p class="text-xs text-slate-300/80">{{ sessionInfo?.service || t('session.active.service') }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-4">
          <!-- Call Duration Timer -->
          <div class="flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 text-xs text-white">
            <Clock class="size-3.5 text-slate-300" />
            <span class="font-mono tracking-wider font-semibold">{{ formattedTimer }}</span>
          </div>

          <!-- Security Badge -->
          <div class="hidden sm:flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs text-emerald-400">
            <ShieldCheck class="size-3.5" />
            <span>{{ t('session.active.encrypted') }}</span>
          </div>
        </div>
      </header>

      <!-- Main Video Stage (Remote Doctor) -->
      <main class="relative flex-1 flex items-center justify-center bg-slate-950 overflow-hidden">
        <!-- Remote Video Available -->
        <template v-if="primaryRemoteVideo">
          <div class="relative size-full flex items-center justify-center">
            <!-- Doctor Video Element -->
            <video
              v-show="!primaryRemoteVideo.isMuted"
              autoplay
              playsinline
              class="size-full object-cover"
              :ref="(el) => { if (el && primaryRemoteVideo) attachRemoteVideo(el as HTMLVideoElement, primaryRemoteVideo.track) }"
            />

            <!-- Doctor Camera Off State -->
            <div
              v-show="primaryRemoteVideo.isMuted"
              class="flex size-full flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 text-center p-6"
            >
              <div class="relative mb-4 flex size-28 items-center justify-center rounded-full bg-slate-800 border border-slate-700 shadow-2xl">
                <Stethoscope class="size-14 text-slate-400" />
                <span class="absolute bottom-1 right-1 flex size-8 items-center justify-center rounded-full bg-rose-500 text-white">
                  <VideoOff class="size-4" />
                </span>
              </div>
              <h3 class="text-lg font-bold text-white">Dr. {{ primaryRemoteVideo.participantName }}</h3>
              <p class="mt-1 text-xs text-slate-400">{{ t('session.active.remoteCamOff') }}</p>
            </div>

            <!-- Doctor Name & Mic Badge (Bottom Left) -->
            <div class="absolute bottom-24 left-6 z-20 flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-white">
              <span class="font-medium">Dr. {{ primaryRemoteVideo.participantName }}</span>
              <span class="size-1 rounded-full bg-white/40"></span>
              <component :is="isDoctorPresent ? Mic : MicOff" class="size-3.5 text-emerald-400" />
            </div>
          </div>
        </template>

        <!-- Doctor not in room or no video yet -->
        <div
          v-else
          class="flex size-full flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6 text-center"
        >
          <div class="relative mb-5 flex size-28 items-center justify-center">
            <span class="absolute inline-flex size-full rounded-full bg-primary/20 animate-ping"></span>
            <div class="flex size-20 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-primary shadow-2xl">
              <Stethoscope class="size-10" />
            </div>
          </div>
          <h3 class="text-xl font-bold text-white">{{ t('session.active.waitingForRemote') }}</h3>
          <p class="mt-2 text-sm text-slate-400 max-w-sm leading-relaxed">
            {{ t('session.active.waitingForRemoteDesc') }}
          </p>
        </div>

        <!-- Picture-in-Picture / Self-View (Patient Tile) -->
        <div
          class="absolute bottom-24 right-4 sm:right-6 z-20 w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 rounded-2xl overflow-hidden border border-white/20 bg-slate-900 shadow-2xl transition-all"
        >
          <!-- Local Video -->
          <video
            v-show="isCamEnabled"
            ref="sessionLocalVideoRef"
            autoplay
            playsinline
            muted
            class="size-full object-cover scale-x-[-1]"
          />

          <!-- Local Cam Off Placeholder -->
          <div
            v-show="!isCamEnabled"
            class="flex size-full flex-col items-center justify-center bg-slate-900 text-slate-400 text-center p-2"
          >
            <div class="flex size-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700 mb-1">
              <User class="size-5 text-slate-300" />
            </div>
            <span class="text-[11px] font-medium text-slate-400">{{ t('session.active.camOffSelf') }}</span>
          </div>

          <!-- Self Badge -->
          <div class="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] text-white">
            <span>{{ t('session.active.you') }}</span>
            <component :is="isMicEnabled ? Mic : MicOff" class="size-2.5" :class="isMicEnabled ? 'text-emerald-400' : 'text-rose-400'" />
          </div>
        </div>

        <!-- Media & Device Settings Popover / Dropdown (Section 8) -->
        <transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="transform scale-95 opacity-0 translate-y-2"
          enter-to-class="transform scale-100 opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="transform scale-100 opacity-100 translate-y-0"
          leave-to-class="transform scale-95 opacity-0 translate-y-2"
        >
          <div
            v-if="showSettingsMenu"
            class="absolute bottom-24 z-40 w-80 sm:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/20 p-5 shadow-2xl text-white"
          >
            <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h4 class="text-sm font-bold flex items-center gap-2">
                <Settings class="size-4 text-primary" />
                {{ t('session.devices.title') }}
              </h4>
              <button
                type="button"
                class="size-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
                @click="showSettingsMenu = false"
              >
                <X class="size-4" />
              </button>
            </div>

            <div class="space-y-4">
              <!-- Microphone Selector -->
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mic class="size-3.5 text-primary" />
                  {{ t('session.devices.microphone') }}
                </label>
                <select
                  v-model="selectedAudioInputId"
                  class="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="session-select-mic"
                  @change="switchMicrophone(selectedAudioInputId)"
                >
                  <option v-if="audioInputDevices.length === 0" value="">
                    {{ t('session.devices.defaultMic') }}
                  </option>
                  <option
                    v-for="(dev, idx) in audioInputDevices"
                    :key="dev.deviceId"
                    :value="dev.deviceId"
                  >
                    {{ formatDeviceLabel(dev, idx, 'audioinput') }}
                  </option>
                </select>
              </div>

              <!-- Speaker Selector -->
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Volume2 class="size-3.5 text-primary" />
                  {{ t('session.devices.speaker') }}
                </label>
                <select
                  v-model="selectedAudioOutputId"
                  :disabled="!isSpeakerOutputSupported"
                  class="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  data-testid="session-select-speaker"
                  @change="switchSpeaker(selectedAudioOutputId)"
                >
                  <option v-if="audioOutputDevices.length === 0 || !isSpeakerOutputSupported" value="">
                    {{ isSpeakerOutputSupported ? t('session.devices.defaultSpeaker') : t('session.devices.speakerNotSupported') }}
                  </option>
                  <option
                    v-for="(dev, idx) in audioOutputDevices"
                    :key="dev.deviceId"
                    :value="dev.deviceId"
                  >
                    {{ formatDeviceLabel(dev, idx, 'audiooutput') }}
                  </option>
                </select>
                <p v-if="!isSpeakerOutputSupported" class="text-[10px] text-slate-400">
                  {{ t('session.devices.speakerNotSupported') }}
                </p>
              </div>

              <!-- Camera Selector -->
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Video class="size-3.5 text-primary" />
                  {{ t('session.devices.camera') }}
                </label>
                <select
                  v-model="selectedVideoInputId"
                  class="w-full rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="session-select-cam"
                  @change="switchCamera(selectedVideoInputId)"
                >
                  <option v-if="videoInputDevices.length === 0" value="">
                    {{ t('session.devices.defaultCam') }}
                  </option>
                  <option
                    v-for="(dev, idx) in videoInputDevices"
                    :key="dev.deviceId"
                    :value="dev.deviceId"
                  >
                    {{ formatDeviceLabel(dev, idx, 'videoinput') }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </transition>
      </main>

      <!-- Floating Bottom Controls Bar (Glassmorphic Telemedicine Dock) -->
      <footer class="absolute bottom-4 inset-x-0 z-30 flex items-center justify-center px-4 pointer-events-none">
        <div class="pointer-events-auto flex items-center gap-3 sm:gap-4 rounded-full bg-slate-900/85 backdrop-blur-xl border border-white/10 px-5 py-3 shadow-2xl">
          <!-- Mic Toggle -->
          <button
            type="button"
            :disabled="isTogglingMic"
            class="flex size-12 items-center justify-center rounded-full transition shadow-soft focus:outline-none focus:ring-2 focus:ring-primary"
            :class="isMicEnabled
              ? 'bg-slate-800 text-white hover:bg-slate-700 border border-white/10'
              : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20'"
            :title="isMicEnabled ? t('session.controls.micMute') : t('session.controls.micUnmute')"
            :aria-label="isMicEnabled ? t('session.controls.micMute') : t('session.controls.micUnmute')"
            data-testid="toggle-mic"
            @click="toggleMicrophone"
          >
            <Loader2 v-if="isTogglingMic" class="size-5 animate-spin" />
            <component :is="isMicEnabled ? Mic : MicOff" v-else class="size-5" />
          </button>

          <!-- Camera Toggle -->
          <button
            type="button"
            :disabled="isTogglingCam"
            class="flex size-12 items-center justify-center rounded-full transition shadow-soft focus:outline-none focus:ring-2 focus:ring-primary"
            :class="isCamEnabled
              ? 'bg-slate-800 text-white hover:bg-slate-700 border border-white/10'
              : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20'"
            :title="isCamEnabled ? t('session.controls.camTurnOff') : t('session.controls.camTurnOn')"
            :aria-label="isCamEnabled ? t('session.controls.camTurnOff') : t('session.controls.camTurnOn')"
            data-testid="toggle-cam"
            @click="toggleCamera"
          >
            <Loader2 v-if="isTogglingCam" class="size-5 animate-spin" />
            <component :is="isCamEnabled ? Video : VideoOff" v-else class="size-5" />
          </button>

          <!-- Speaker Toggle -->
          <button
            type="button"
            class="flex size-12 items-center justify-center rounded-full transition shadow-soft focus:outline-none focus:ring-2 focus:ring-primary"
            :class="isSpeakerMuted
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-slate-800 text-white hover:bg-slate-700 border border-white/10'"
            :title="isSpeakerMuted ? t('session.controls.speakerUnmute') : t('session.controls.speakerMute')"
            :aria-label="isSpeakerMuted ? t('session.controls.speakerUnmute') : t('session.controls.speakerMute')"
            data-testid="toggle-speaker"
            @click="toggleSpeaker"
          >
            <component :is="isSpeakerMuted ? VolumeX : Volume2" class="size-5" />
          </button>

          <!-- Media Settings Toggle -->
          <button
            type="button"
            class="flex size-12 items-center justify-center rounded-full transition shadow-soft focus:outline-none focus:ring-2 focus:ring-primary"
            :class="showSettingsMenu
              ? 'bg-primary text-white'
              : 'bg-slate-800 text-white hover:bg-slate-700 border border-white/10'"
            :title="t('session.controls.settings')"
            :aria-label="t('session.controls.settings')"
            data-testid="toggle-settings"
            @click="showSettingsMenu = !showSettingsMenu"
          >
            <Settings class="size-5" />
          </button>

          <!-- Separator -->
          <div class="h-6 w-px bg-white/20 mx-1"></div>

          <!-- Leave / End Call Button -->
          <button
            type="button"
            class="flex items-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 font-semibold text-sm transition shadow-lg shadow-rose-600/30 focus:outline-none focus:ring-2 focus:ring-rose-500"
            data-testid="leave-session"
            :aria-label="t('session.controls.endCall')"
            @click="showLeaveModal = true"
          >
            <PhoneOff class="size-4" />
            <span class="hidden sm:inline">{{ t('session.controls.endCall') }}</span>
          </button>
        </div>
      </footer>

      <!-- Remote Audio Elements (Hidden) -->
      <div aria-hidden="true" class="hidden">
        <audio
          v-for="audio in remoteAudioTracks"
          :key="audio.sid"
          autoplay
          playsinline
          :muted="isSpeakerMuted"
          :ref="(el) => { if (el) attachRemoteAudio(el as HTMLAudioElement, audio.track) }"
        />
      </div>
    </div>

    <!-- Exit Confirmation Modal -->
    <div
      v-if="showLeaveModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl text-center">
        <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
          <PhoneOff class="size-7" />
        </div>
        <h4 class="text-lg font-bold text-foreground">{{ t('session.modal.leaveTitle') }}</h4>
        <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
          {{ t('session.modal.leaveDesc') }}
        </p>
        <div class="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            class="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition"
            data-testid="cancel-leave"
            @click="showLeaveModal = false"
          >
            {{ t('session.controls.stayInCall') }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition"
            data-testid="confirm-leave"
            @click="onConfirmLeave"
          >
            {{ t('session.controls.confirmEnd') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-root {
  background: transparent;
}
</style>
