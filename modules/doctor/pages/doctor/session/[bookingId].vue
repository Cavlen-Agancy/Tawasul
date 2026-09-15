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
} from 'lucide-vue-next'

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
  layout: 'doctor-layout',
  middleware: ['auth', 'doctor-only'],
  pageTransition: false,
  layoutTransition: false,
})

const route = useRoute()
const router = useRouter()
const bookingId = String(route.params.bookingId ?? '')
const config = useRuntimeConfig()
const serverUrl = String(config.public.liveKitUrl || 'ws://localhost:7880')

// Fetch session token & details
const { data, error, refresh } = await useFetch<SessionTokenResponse>(`/api/doctor/session/${bookingId}`)

const token = computed(() => data.value?.liveKitToken)
const sessionInfo = computed(() => data.value?.sessionInfo)

// Check if outside join window
const isOutsideJoinWindow = computed(() => {
  if (!error.value) return false
  const status = error.value.statusCode
  const msg = error.value.data?.message || error.value.message || ''
  return status === 403 && (msg.includes('not available') || msg.includes('window') || msg.includes('time'))
})

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
  mediaError,
  connectionError,
  localVideoTrack,
  remoteVideoTracks,
  remoteAudioTracks,
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
    router.push('/doctor/calendar')
  },
})

// DOM References
const localVideoRef = ref<HTMLVideoElement | null>(null)
const showLeaveModal = ref(false)

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
    admitError.value = 'تعذر قبول المريض. حاول مرة أخرى.'
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

onMounted(async () => {
  if (isOutsideJoinWindow.value) return

  // Start session call duration counter
  sessionTimerInterval = setInterval(() => {
    sessionDuration.value++
  }, 1000)

  // Connect to LiveKit room and publish doctor media
  if (token.value) {
    await connectRoom()
    if (localVideoRef.value && isCamEnabled.value) {
      attachLocalVideo(localVideoRef.value)
    }
  }
})

onUnmounted(() => {
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval)
    sessionTimerInterval = null
  }
  leaveSession()
})

function onConfirmLeave() {
  showLeaveModal.value = false
  leaveSession()
  router.push('/doctor/calendar')
}

function formatDate(val: string | Date | undefined) {
  if (!val) return 'اليوم'
  try {
    const d = new Date(val)
    return d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return String(val)
  }
}
</script>

<template>
  <div dir="rtl" class="session-root min-h-[calc(100vh-5rem)] flex flex-col font-sans text-foreground">
    <!-- State 0: Outside Join Window -->
    <div
      v-if="isOutsideJoinWindow"
      class="flex flex-1 flex-col items-center justify-center p-6 text-center"
      data-testid="doctor-session-waiting"
    >
      <div class="w-full max-w-md rounded-3xl border border-border/80 bg-card p-8 shadow-xl">
        <div class="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Clock class="size-8" />
        </div>
        <h2 class="text-2xl font-bold tracking-tight text-foreground">الجلسة ليست متاحة حالياً</h2>
        <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
          تفتح غرفة الجلسة قبل موعدها المحدد بـ 5 دقائق. يرجى مراجعة جدول المواعيد.
        </p>
        <div class="mt-8 flex justify-center">
          <NuxtLink
            to="/doctor/calendar"
            class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90"
          >
            <ChevronLeft class="size-4" />
            العودة لجدول المواعيد
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
        <h3 class="text-xl font-bold text-foreground">تعذر فتح الجلسة</h3>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ error.data?.message || error.message || 'حدث خطأ أثناء تحميل بيانات الجلسة.' }}
        </p>
        <div class="mt-6 flex justify-center gap-3">
          <button
            class="rounded-xl bg-secondary px-5 py-2.5 text-sm font-medium hover:bg-secondary/80"
            @click="() => refresh()"
          >
            إعادة المحاولة
          </button>
          <NuxtLink
            to="/doctor/calendar"
            class="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            العودة للجدول
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- State 2: Active Doctor Session Interface (Phase 6) -->
    <div v-else class="session-active-stage flex-1 flex flex-col relative bg-slate-950 text-white overflow-hidden rounded-3xl">
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
                في غرفة الانتظار
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
            <span>{{ admittingId === p.identity ? 'جاري القبول...' : 'قبول المريض' }}</span>
          </button>
        </div>
      </transition-group>

      <!-- Media Error Alert if any -->
      <div
        v-if="mediaError || admitError"
        class="absolute top-16 right-6 z-40 max-w-md rounded-2xl border border-rose-500/40 bg-slate-900/95 backdrop-blur-md p-4 text-xs text-rose-300 shadow-xl flex items-start gap-2.5"
      >
        <AlertCircle class="size-4 shrink-0 text-rose-400 mt-0.5" />
        <div class="flex-1">
          <p class="font-medium text-rose-200">تنبيه بالوسائط</p>
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
              {{ sessionInfo?.patientName ? `المريض: ${sessionInfo.patientName}` : 'جلسة الاستشارة' }}
              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-normal text-emerald-400">
                <span class="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                مباشر
              </span>
            </h2>
            <p class="text-xs text-slate-300/80">{{ sessionInfo?.service || 'استشارة طبية' }}</p>
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
            <span>مشفرة وآمنة</span>
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
              :ref="(el) => attachRemoteVideo(el as HTMLVideoElement, primaryPatientVideo.track)"
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
              <p class="mt-1 text-xs text-slate-400">الكاميرا مغلقة من قِبل المريض</p>
            </div>

            <!-- Patient Name & Mic Badge (Bottom Right) -->
            <div class="absolute bottom-24 right-6 z-20 flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-white">
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
          <h3 class="text-xl font-bold text-white">في انتظار انضمام المريض للجلسة...</h3>
          <p class="mt-2 text-sm text-slate-400 max-w-sm leading-relaxed">
            عندما يدخل المريض غرفة الانتظار، سيظهر إشعار في أعلى الشاشة لقبوله وبدء المكالمة.
          </p>
        </div>

        <!-- Picture-in-Picture / Self-View (Doctor Tile) -->
        <div
          class="absolute bottom-24 left-4 sm:left-6 z-20 w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 rounded-2xl overflow-hidden border border-white/20 bg-slate-900 shadow-2xl transition-all"
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
            <span class="text-[11px] font-medium text-slate-400">الكاميرا متوقفة</span>
          </div>

          <!-- Self Badge -->
          <div class="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] text-white">
            <span>أنت (د.)</span>
            <component :is="isMicEnabled ? Mic : MicOff" class="size-2.5" :class="isMicEnabled ? 'text-emerald-400' : 'text-rose-400'" />
          </div>
        </div>
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
            :title="isMicEnabled ? 'كتم الميكروفون' : 'تشغيل الميكروفون'"
            :aria-label="isMicEnabled ? 'كتم الميكروفون' : 'تشغيل الميكروفون'"
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
            :title="isCamEnabled ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'"
            :aria-label="isCamEnabled ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'"
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
            :title="isSpeakerMuted ? 'تشغيل صوت الجلسة' : 'كتم صوت الجلسة'"
            :aria-label="isSpeakerMuted ? 'تشغيل صوت الجلسة' : 'كتم صوت الجلسة'"
            data-testid="toggle-speaker"
            @click="toggleSpeaker"
          >
            <component :is="isSpeakerMuted ? VolumeX : Volume2" class="size-5" />
          </button>

          <!-- Separator -->
          <div class="h-6 w-px bg-white/20 mx-1"></div>

          <!-- Leave / End Call Button -->
          <button
            type="button"
            class="flex items-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 font-semibold text-sm transition shadow-lg shadow-rose-600/30 focus:outline-none focus:ring-2 focus:ring-rose-500"
            data-testid="leave-session"
            aria-label="إنهاء الجلسة والمغادرة"
            @click="showLeaveModal = true"
          >
            <PhoneOff class="size-4" />
            <span class="hidden sm:inline">إنهاء الجلسة</span>
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
          :ref="(el) => attachRemoteAudio(el as HTMLAudioElement, audio.track)"
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
        <h4 class="text-lg font-bold text-foreground">هل تريد إنهاء الجلسة والمغادرة؟</h4>
        <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
          سيتم قطع اتصال المكالمة والعودة إلى جدول المواعيد الخاص بك.
        </p>
        <div class="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            class="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition"
            data-testid="cancel-leave"
            @click="showLeaveModal = false"
          >
            البقاء في الجلسة
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition"
            data-testid="confirm-leave"
            @click="onConfirmLeave"
          >
            تأكيد المغادرة
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
