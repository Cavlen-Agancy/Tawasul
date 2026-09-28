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
  UserCheck,
  Settings,
  X,
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
  middleware: ['auth', 'doctor-only'],
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
  if (import.meta.dev) console.log('[Doctor][Session] route mounted, fetching token')
  isFetchingToken.value = true
  tokenError.value = null
  try {
    const res = await $fetch<SessionTokenResponse>(`/api/doctor/session/${bookingId}`)
    tokenData.value = res
    if (import.meta.dev) console.log('[Doctor][Session] token received')
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

// Check if outside join window
const isOutsideJoinWindow = computed(() => {
  if (!tokenError.value) return false
  const status = tokenError.value.statusCode
  const msg = tokenError.value.data?.message || tokenError.value.message || ''
  return status === 403 && (msg.includes('not available') || msg.includes('window') || msg.includes('time'))
})

// Set before the LiveKit composable so `onDisconnected` can read it.
const confirmedExit = ref(false)

// Initialize LiveKit composable for Doctor
const {
  room,
  connectionState,
  isPatientPresent,
  waitingList,
  isMicEnabled,
  isCamEnabled,
  isSpeakerMuted,
  isTogglingMic,
  isTogglingCam,
  isConnecting,
  loadingStage,
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
  isModerator: true,
  onDisconnected: () => {
    // Intentional leave (End Session) navigates on its own after disconnect.
    // Skipping here avoids a second, post-unmount push to the same route.
    if (confirmedExit.value) return
    router.push('/doctor/calendar')
  },
})

// DOM References
const localVideoRef = ref<HTMLVideoElement | null>(null)
const showLeaveModal = ref(false)
const showSettingsMenu = ref(false)

// Admit participant state
const admittingId = ref<string | null>(null)
const admitError = ref('')

async function admit(identity: string) {
  admittingId.value = identity
  admitError.value = ''
  try {
    console.log('[LiveKit][doctor] admitting participant:', identity)
    await $fetch(`/api/doctor/session/${bookingId}/admit`, {
      method: 'POST',
      body: { identity },
    })
    waitingList.value = waitingList.value.filter((p) => p.identity !== identity)
  } catch (e) {
    console.error('[LiveKit][doctor] Failed to admit participant', e)
    admitError.value = t('session.doctor.admitError')
  } finally {
    admittingId.value = null
  }
}

// Session Timer
const sessionDuration = ref(0)
let sessionTimerInterval: ReturnType<typeof setInterval> | null = null

const formattedTimer = computed(() => {
  const m = Math.floor(sessionDuration.value / 60)
  const s = sessionDuration.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

// Attach local video track
watch(localVideoRef, (el) => {
  if (el && isCamEnabled.value) {
    attachLocalVideo(el)
  }
})

watch(isCamEnabled, (enabled) => {
  if (enabled) {
    nextTick(() => {
      if (localVideoRef.value) {
        attachLocalVideo(localVideoRef.value)
      }
    })
  }
})

// First remote video (the patient)
const primaryPatientVideo = computed(() => remoteVideoTracks.value[0] || null)

let bootInFlight = false

// ── Staged, non-blocking boot ────────────────────────────
// Doctor connects + publishes media; a slow/denied camera must never
// freeze the page — shell renders first, connect carries a 15s timeout.
async function bootSession() {
  if (bootInFlight) return
  bootInFlight = true
  try {
    await fetchToken()
    if (tokenError.value || !token.value) return

    // Start call timer immediately; UI is already mounted.
    if (!sessionTimerInterval) {
      sessionTimerInterval = setInterval(() => {
        sessionDuration.value++
      }, 1000)
    }

    if (import.meta.dev) console.log('[Doctor][Session] connecting to LiveKit')
    await connectRoom(token.value)
    if (localVideoRef.value && isCamEnabled.value) {
      attachLocalVideo(localVideoRef.value)
    }
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
  if (import.meta.dev) console.log('[Doctor][Session] cleanup complete')
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

async function onConfirmLeave() {
  confirmedExit.value = true
  showLeaveModal.value = false
  if (import.meta.dev) console.log('[Doctor][Session] leaving')
  await leaveSession()
  await router.push('/doctor/calendar')
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
            {{ t('session.state.backToCalendar') }}
          </button>
        </div>
      </div>
    </div>

    <!-- State 0: Outside Join Window -->
    <div
      v-else-if="isOutsideJoinWindow"
      class="flex flex-1 flex-col items-center justify-center p-6 text-center"
      data-testid="doctor-session-waiting"
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
            to="/doctor/calendar"
            class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90"
          >
            <ChevronLeft class="size-4" />
            {{ t('session.state.backToCalendar') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- State 1: General Error loading doctor session -->
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
            to="/doctor/calendar"
            class="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            {{ t('session.state.backToCalendar') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- State 2: Active Doctor Session Interface (Phase 6) -->
    <div v-else class="session-active-stage flex min-h-0 flex-1 flex-col relative bg-slate-950 text-white overflow-hidden">
      <!-- Transient connecting badge: room connect / media init in flight -->
      <div
        v-if="loadingStage === 'connecting' || loadingStage === 'initializing_media'"
        class="absolute top-16 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full border border-primary/40 bg-slate-900/95 px-4 py-1.5 text-xs font-medium text-primary shadow-xl"
        data-testid="session-connecting"
      >
        <Loader2 class="size-4 animate-spin" />
        <span>{{ loadingStage === 'connecting' ? t('session.loading.connecting') : t('session.loading.initMedia') }}</span>
      </div>

      <!-- Waiting Room / Admit Notification Banner for Doctor -->
      <transition-group
        tag="div"
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform -translate-y-4 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-4 opacity-0"
        class="absolute top-16 inset-x-0 z-40 flex flex-col items-center px-4 pointer-events-none"
      >
        <div
          v-for="p in waitingList"
          :key="p.identity"
          class="pointer-events-auto w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 mb-2"
          data-testid="admit-notification"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <User class="size-5" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-bold text-white truncate">{{ p.name }}</p>
              <p class="text-xs text-amber-300/90 flex items-center gap-1">
                <span class="size-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                {{ t('session.doctor.waitingBadge') }}
              </p>
            </div>
          </div>
          <button
            type="button"
            :disabled="admittingId === p.identity"
            class="flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white px-4 py-2 text-xs font-bold shadow-soft transition disabled:opacity-50"
            data-testid="admit-patient-btn"
            @click="admit(p.identity)"
          >
            <Loader2 v-if="admittingId === p.identity" class="size-3.5 animate-spin" />
            <UserCheck v-else class="size-3.5" />
            <span>{{ admittingId === p.identity ? t('session.doctor.admitting') : t('session.doctor.admitBtn') }}</span>
          </button>
        </div>
      </transition-group>

      <!-- Media Error or Notification Alert -->
      <div
        v-if="deviceNotification"
        class="absolute top-16 right-6 z-40 max-w-md rounded-2xl border border-primary/40 bg-slate-900/95 backdrop-blur-md p-3.5 text-xs text-primary shadow-xl flex items-center gap-2"
      >
        <Sparkles class="size-4 shrink-0" />
        <span>{{ deviceNotification }}</span>
      </div>

      <div
        v-if="mediaError || admitError"
        class="absolute top-16 right-6 z-40 max-w-md rounded-2xl border border-rose-500/40 bg-slate-900/95 backdrop-blur-md p-4 text-xs text-rose-300 shadow-xl flex items-start gap-2.5"
      >
        <AlertCircle class="size-4 shrink-0 text-rose-400 mt-0.5" />
        <div class="flex-1">
          <p class="font-medium text-rose-200">{{ t('session.media.alertTitle') }}</p>
          <p class="mt-0.5 text-rose-300/90">{{ mediaError || admitError }}</p>
        </div>
      </div>

      <!-- Top Session Header Bar -->
      <header class="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div class="flex items-center gap-3">
          <div class="flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-white">
            <Stethoscope class="size-5 text-primary" />
          </div>
          <div>
            <h2 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              {{ sessionInfo?.patientName ? `Patient: ${sessionInfo.patientName}` : t('session.active.service') }}
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

      <!-- Main Video Stage (Remote Patient) -->
      <main class="relative flex-1 flex items-center justify-center bg-slate-950 overflow-hidden">
        <!-- Patient Video Available -->
        <template v-if="primaryPatientVideo">
          <div class="relative size-full flex items-center justify-center">
            <!-- Patient Video Element -->
            <video
              v-show="!primaryPatientVideo.isMuted"
              autoplay
              playsinline
              class="size-full object-cover"
              :ref="(el) => { if (el && primaryPatientVideo) attachRemoteVideo(el as HTMLVideoElement, primaryPatientVideo.track) }"
            />

            <!-- Patient Camera Off State -->
            <div
              v-show="primaryPatientVideo.isMuted"
              class="flex size-full flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 text-center p-6"
            >
              <div class="relative mb-4 flex size-28 items-center justify-center rounded-full bg-slate-800 border border-slate-700 shadow-2xl">
                <User class="size-14 text-slate-400" />
                <span class="absolute bottom-1 right-1 flex size-8 items-center justify-center rounded-full bg-rose-500 text-white">
                  <VideoOff class="size-4" />
                </span>
              </div>
              <h3 class="text-lg font-bold text-white">{{ primaryPatientVideo.participantName }}</h3>
              <p class="mt-1 text-xs text-slate-400">{{ t('session.active.remoteCamOff') }}</p>
            </div>

            <!-- Patient Name & Mic Badge (Bottom Left) -->
            <div class="absolute bottom-24 left-6 z-20 flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-white">
              <span class="font-medium">{{ primaryPatientVideo.participantName }}</span>
              <span class="size-1 rounded-full bg-white/40"></span>
              <component :is="isPatientPresent ? Mic : MicOff" class="size-3.5 text-emerald-400" />
            </div>
          </div>
        </template>

        <!-- Patient not admitted or not joined yet -->
        <div
          v-else
          class="flex size-full flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6 text-center"
        >
          <div class="relative mb-5 flex size-28 items-center justify-center">
            <span class="absolute inline-flex size-full rounded-full bg-primary/20 animate-ping"></span>
            <div class="flex size-20 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-primary shadow-2xl">
              <User class="size-10" />
            </div>
          </div>
          <h3 class="text-xl font-bold text-white">{{ t('session.active.waitingForRemote') }}</h3>
          <p class="mt-2 text-sm text-slate-400 max-w-sm leading-relaxed">
            {{ t('session.active.waitingForRemoteDesc') }}
          </p>
        </div>

        <!-- Picture-in-Picture / Self-View (Doctor Tile) -->
        <div
          class="absolute bottom-24 right-4 sm:right-6 z-20 w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 rounded-2xl overflow-hidden border border-white/20 bg-slate-900 shadow-2xl transition-all"
        >
          <!-- Local Video -->
          <video
            v-show="isCamEnabled"
            ref="localVideoRef"
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
              <Stethoscope class="size-5 text-slate-300" />
            </div>
            <span class="text-[11px] font-medium text-slate-400">{{ t('session.active.camOffSelf') }}</span>
          </div>

          <!-- Self Badge -->
          <div class="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] text-white">
            <span>{{ t('session.active.youDoctor') }}</span>
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
                  data-testid="doctor-session-select-mic"
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
                  data-testid="doctor-session-select-speaker"
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
                  data-testid="doctor-session-select-cam"
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
            data-testid="doctor-toggle-settings"
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
        <h4 class="text-lg font-bold text-foreground">{{ t('session.modal.leaveDoctorTitle') }}</h4>
        <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
          {{ t('session.modal.leaveDoctorDesc') }}
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
