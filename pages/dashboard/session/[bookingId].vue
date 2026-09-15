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
  Wifi,
  ChevronLeft,
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
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
  pageTransition: false,
  layoutTransition: false,
})

const route = useRoute()
const router = useRouter()
const bookingId = String(route.params.bookingId ?? '')
const config = useRuntimeConfig()
const serverUrl = String(config.public.liveKitUrl || 'ws://localhost:7880')

// Fetch session token
const { data, error, refresh } = await useFetch<SessionTokenResponse>(`/api/patient/session/${bookingId}`)

const token = computed(() => data.value?.liveKitToken)
const sessionInfo = computed(() => data.value?.sessionInfo)

// Determine if we're outside join window or in a waiting state
const isOutsideJoinWindow = computed(() => {
  if (!error.value) return false
  const status = error.value.statusCode
  const msg = error.value.data?.message || error.value.message || ''
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
  localVideoTrack,
  remoteVideoTracks,
  remoteAudioTracks,
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

onMounted(async () => {
  if (isOutsideJoinWindow.value) return

  // 1. Ask for media permissions once and start local preview in waiting room
  await initLocalPreview(true, true)
  if (waitingVideoRef.value && isCamEnabled.value) {
    attachLocalVideo(waitingVideoRef.value)
  }

  // 2. Connect to LiveKit room
  if (token.value) {
    await connectRoom()
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
  router.push('/dashboard/appointments')
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
    <!-- State 0: Outside Join Window (E2E & Safety Fallback) -->
    <div
      v-if="isOutsideJoinWindow"
      class="flex flex-1 flex-col items-center justify-center p-6 text-center"
      data-testid="session-waiting"
    >
      <div class="w-full max-w-md rounded-3xl border border-border/80 bg-card p-8 shadow-xl">
        <div class="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Clock class="size-8" />
        </div>
        <h2 class="text-2xl font-bold tracking-tight text-foreground">Your session starts soon</h2>
        <p class="mt-2 text-base font-semibold text-primary">تبدأ الجلسة قريباً</p>
        <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
          تفتح غرفة الجلسة قبل موعدها المحدد بـ 5 دقائق. يرجى العودة في الوقت المحدد للانضمام.
        </p>
        <div class="mt-8 flex justify-center">
          <NuxtLink
            to="/dashboard/appointments"
            class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90"
          >
            <ChevronLeft class="size-4" />
            العودة للمواعيد
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
            to="/dashboard/appointments"
            class="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            العودة للمواعيد
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- State 2: Patient Virtual Waiting Room (Phase 5) -->
    <div v-else-if="isWaiting" class="waiting-room-wrapper flex-1 flex flex-col justify-between p-4 md:p-6 lg:p-8">
      <!-- Waiting Room Header -->
      <header class="flex items-center justify-between border-b border-border/40 pb-4 mb-6">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
            ت
          </div>
          <div>
            <h1 class="text-lg font-bold text-foreground flex items-center gap-2">
              تواصل <span class="text-primary">أكاديمي</span>
            </h1>
            <p class="text-xs text-muted-foreground">عيادة الاستشارات النفسية والصحية</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border text-xs text-muted-foreground">
            <span class="size-2 rounded-full bg-amber-500 animate-pulse"></span>
            غرفة الانتظار الافتراضية
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition"
            data-testid="leave-waiting-room"
            @click="showLeaveModal = true"
          >
            <PhoneOff class="size-4" />
            <span class="hidden sm:inline">مغادرة الغرفة</span>
          </button>
        </div>
      </header>

      <!-- Media Error Alert if any -->
      <div
        v-if="mediaError"
        class="mb-4 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
      >
        <AlertCircle class="size-5 shrink-0 text-rose-400 mt-0.5" />
        <div class="flex-1">
          <p class="font-medium text-rose-200">تنبيه بالوسائط</p>
          <p class="mt-0.5 text-xs text-rose-300/90">{{ mediaError }}</p>
        </div>
      </div>

      <!-- Main Waiting Room Content (2-Column Grid on Desktop) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-center">
        <!-- Right Column: Camera Preview & Local Controls -->
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
                <h4 class="text-base font-semibold text-white">الكاميرا متوقفة حاليًا</h4>
                <p class="mt-1 text-xs text-slate-400 max-w-xs">
                  يمكنك تفعيل الكاميرا للتحقق من مظهرك وإضاءتك قبل بدء الجلسة مع الطبيب.
                </p>
              </div>

              <!-- Top Overlay Badge -->
              <div class="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs text-white border border-white/10">
                <span class="size-2 rounded-full" :class="isCamEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'"></span>
                {{ isCamEnabled ? 'معاينة الكاميرا نشطة' : 'الكاميرا مغلقة' }}
              </div>

              <!-- Bottom Overlay Badge: Mic state -->
              <div class="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs text-white border border-white/10">
                <component :is="isMicEnabled ? Mic : MicOff" class="size-3.5" :class="isMicEnabled ? 'text-emerald-400' : 'text-rose-400'" />
                {{ isMicEnabled ? 'الميكروفون جاهز' : 'الميكروفون مكتوم' }}
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
                aria-label="تبديل الميكروفون"
                @click="toggleMicrophone"
              >
                <Loader2 v-if="isTogglingMic" class="size-4 animate-spin" />
                <component :is="isMicEnabled ? Mic : MicOff" v-else class="size-4" />
                <span>{{ isMicEnabled ? 'الميكروفون مفعّل' : 'الميكروفون مكتوم' }}</span>
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
                aria-label="تبديل الكاميرا"
                @click="toggleCamera"
              >
                <Loader2 v-if="isTogglingCam" class="size-4 animate-spin" />
                <component :is="isCamEnabled ? Video : VideoOff" v-else class="size-4" />
                <span>{{ isCamEnabled ? 'الكاميرا مفعّلة' : 'الكاميرا متوقفة' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Left Column: Session Details & Doctor Approval State -->
        <div class="lg:col-span-5 flex flex-col justify-center">
          <div class="rounded-3xl border border-border/80 bg-card p-6 md:p-8 shadow-lg">
            <!-- Doctor Header -->
            <div class="flex items-center gap-4 pb-6 border-b border-border/50">
              <div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-soft">
                <Stethoscope class="size-7" />
              </div>
              <div class="min-w-0 flex-1">
                <span class="inline-block text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full mb-1">
                  {{ sessionInfo?.service || 'جلسة استشارة طبية' }}
                </span>
                <h3 class="text-xl font-bold text-foreground truncate">
                  {{ sessionInfo?.doctorName ? `د. ${sessionInfo.doctorName}` : 'الطبيب المعالج' }}
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
                  الطبيب متواجد حالياً
                </h4>
                <p class="mt-1 text-sm text-amber-800/90 dark:text-amber-300 font-medium">
                  بانتظار موافقة الطبيب للانضمام إلى الجلسة
                </p>
                <p class="mt-2 text-xs text-amber-700/80 dark:text-amber-300/70">
                  ستنتقل للشاشة الرئيسية للمكالمة تلقائياً بمجرد قبول الطبيب.
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
                  أنت الآن في غرفة الانتظار
                </h4>
                <p class="mt-1 text-sm text-muted-foreground">
                  في انتظار دخول الطبيب إلى الغرفة...
                </p>
                <div class="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span class="size-2 rounded-full bg-emerald-500"></span>
                  <span>الاتصال بالخادم نشط وجاهز</span>
                </div>
              </div>
            </div>

            <!-- Helpful Tips -->
            <div class="mt-6 rounded-2xl bg-muted/60 p-4 text-xs text-muted-foreground leading-relaxed border border-border/40">
              <p class="font-semibold text-foreground mb-1">💡 إرشادات لجلسة مريحة:</p>
              <ul class="list-disc list-inside space-y-1">
                <li>استخدم سماعات الرأس للحصول على أفضل وضوح للصوت.</li>
                <li>تأكد من الجلوس في مكان هادئ ذي إضاءة مناسبة أمام الكاميرا.</li>
                <li>الجلسة مشفرة ومحمية بأعلى معايير الخصوصية الطبية.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- State 3: Active Online Session (Phase 6) -->
    <div v-else class="session-active-stage flex-1 flex flex-col relative bg-slate-950 text-white overflow-hidden rounded-3xl">
      <!-- Top Session Info Bar -->
      <header class="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div class="flex items-center gap-3">
          <div class="flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-white">
            <Stethoscope class="size-5 text-primary" />
          </div>
          <div>
            <h2 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              {{ sessionInfo?.doctorName ? `د. ${sessionInfo.doctorName}` : 'الطبيب المعالج' }}
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
              :ref="(el) => attachRemoteVideo(el as HTMLVideoElement, primaryRemoteVideo.track)"
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
              <h3 class="text-lg font-bold text-white">د. {{ primaryRemoteVideo.participantName }}</h3>
              <p class="mt-1 text-xs text-slate-400">الكاميرا مغلقة من قِبل الطبيب</p>
            </div>

            <!-- Doctor Name & Mic Badge (Bottom Left) -->
            <div class="absolute bottom-24 right-6 z-20 flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-white">
              <span class="font-medium">د. {{ primaryRemoteVideo.participantName }}</span>
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
          <h3 class="text-xl font-bold text-white">في انتظار انضمام الطبيب للجلسة...</h3>
          <p class="mt-2 text-sm text-slate-400 max-w-sm leading-relaxed">
            تم قبولك في الجلسة بنجاح. ستظهر صورة وصوت الطبيب هنا فور اتصاله.
          </p>
        </div>

        <!-- Picture-in-Picture / Self-View (Patient Tile) -->
        <div
          class="absolute bottom-24 left-4 sm:left-6 z-20 w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 rounded-2xl overflow-hidden border border-white/20 bg-slate-900 shadow-2xl transition-all"
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
            <span class="text-[11px] font-medium text-slate-400">الكاميرا متوقفة</span>
          </div>

          <!-- Self Badge -->
          <div class="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] text-white">
            <span>أنت</span>
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
        <h4 class="text-lg font-bold text-foreground">هل أنت متأكد من رغبتك في المغادرة؟</h4>
        <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
          عند المغادرة سيتم قطع اتصال الجلسة والعودة إلى قائمة مواعيدك.
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
