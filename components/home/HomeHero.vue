<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { quickConsultServices } from '~/lib/home-content'
import { siteConfig } from '~/lib/site'

const selectedMode = ref<'online' | 'in-person'>('online')
const clientName = ref('')
const clientPhone = ref('')
const selectedService = ref('استشارة نفسية متخصصة (فردية)')
const formError = ref('')

const serviceOptions = [
  'استشارة نفسية متخصصة (فردية)',
  'الاستشارات التربوية وإرشاد الأسرة',
  'الاستشارات الزوجية والأسرية',
  'التخاطب وعيوب النطق والكلام',
  'تعديل وتوجيه السلوك',
  'تنمية المهارات والقدرات',
]

// Animated count-up numbers for stats
const statsContainerRef = ref<HTMLElement | null>(null)
const mobileStatsRef = ref<HTMLElement | null>(null)
const statsAnimated = ref(false)

const count500 = ref(0)
const count50 = ref(0)
const count8 = ref(0)
const count100 = ref(0)
const count3 = ref(0)

function animateCount(target: number, duration: number, callback: (v: number) => void) {
  if (typeof window === 'undefined') {
    callback(target)
    return
  }
  const isReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (isReducedMotion) {
    callback(target)
    return
  }

  const start = 0
  const startTime = performance.now()

  function step(now: number) {
    const elapsed = Math.min((now - startTime) / duration, 1)
    const progress = 1 - Math.pow(1 - elapsed, 3)
    callback(Math.round(start + (target - start) * progress))

    if (elapsed < 1) {
      requestAnimationFrame(step)
    } else {
      callback(target)
    }
  }
  requestAnimationFrame(step)
}

function triggerStatsAnimation() {
  if (statsAnimated.value) return
  statsAnimated.value = true
  animateCount(500, 1500, (v) => { count500.value = v })
  animateCount(50, 1300, (v) => { count50.value = v })
  animateCount(8, 1100, (v) => { count8.value = v })
  animateCount(100, 1400, (v) => { count100.value = v })
  animateCount(3, 1000, (v) => { count3.value = v })
}

onMounted(() => {
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            triggerStatsAnimation()
            observer.disconnect()
          }
        })
      },
      { threshold: 0.15 }
    )
    if (statsContainerRef.value) observer.observe(statsContainerRef.value)
    if (mobileStatsRef.value) observer.observe(mobileStatsRef.value)
  } else {
    triggerStatsAnimation()
  }
})

function handleBooking(overrideMode?: 'online' | 'in-person') {
  formError.value = ''
  if (clientPhone.value && !/^[+\d][\d\s-]{6,}$/.test(clientPhone.value.trim())) {
    formError.value = 'يرجى إدخال رقم هاتف صحيح.'
    return
  }

  const mode = overrideMode || selectedMode.value
  const base = mode === 'online'
    ? siteConfig.booking.onlinePath
    : mode === 'in-person'
      ? siteConfig.booking.inPersonPath
      : siteConfig.booking.basePath

  try {
    sessionStorage.setItem('tawasul-quick-consult', JSON.stringify({
      name: clientName.value.trim(),
      phone: clientPhone.value.trim(),
      service: selectedService.value || quickConsultServices[0],
      mode,
    }))
  } catch { /* storage fallback */ }

  navigateTo(base)
}
</script>

<template>
  <section id="hero" aria-labelledby="hero-title" class="hero-section relative w-full">
    <!-- ================================================================= -->
    <!-- 1. DESKTOP HERO LAYOUT (@media min-width: 769px)                  -->
    <!-- EXACT REMAINING VIEWPORT HEIGHT: calc(100vh - 80px)               -->
    <!-- Vertically centered content, zero overlap, no bleed from below    -->
    <!-- ================================================================= -->
    <div class="hero-desktop-view relative w-full h-[calc(100vh-80px)] min-h-[calc(100vh-80px)] max-h-[calc(100vh-80px)] overflow-hidden bg-[#111116] flex flex-col justify-center items-center">
      <!-- Background image covering the entire remaining viewport height below navbar -->
      <div
        class="hero-bg-zoom pointer-events-none absolute inset-0 h-full w-full bg-cover bg-center bg-no-repeat"
        style="background-image: url('/hero.png');"
        aria-hidden="true"
      />

      <!-- Dark overlay adjusted for optimal text readability on desktop -->
      <div class="absolute inset-0" style="background: rgba(0, 0, 0, 0.55);" aria-hidden="true" />
      <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#111116]" aria-hidden="true" />

      <!-- Center content with vertical centering -->
      <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8 py-0 my-auto">
        <!-- Top Pill Badge -->
        <div class="animate-hero-heading inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-1 text-xs font-medium text-white shadow-soft backdrop-blur-md mb-2">
          <span class="h-2 w-2 rounded-full bg-[#e91e8c] animate-pulse" aria-hidden="true" />
          <span>أكاديمية تواصل — بجمهورية مصر العربية</span>
        </div>

        <!-- Main Headline (fade in + slide up) -->
        <h1 class="desktop-hero-heading animate-hero-heading mt-2 text-4xl lg:text-5xl xl:text-[3.75rem] font-extrabold tracking-tight text-white leading-[1.15]">
          <span>نتواصل </span>
          <span class="relative inline-block text-[#e91e8c]">
            نفهم
          </span>
          <span> نساند</span>
        </h1>

        <!-- Subtitle (0.2s delay stagger) -->
        <p class="desktop-hero-subtext animate-hero-subtext mt-3 max-w-2xl text-xs sm:text-sm lg:text-base leading-relaxed text-white/80">
          نساعدك على استعادة التوازن النفسي والأسري من خلال جلسات استشارية وعلاجية مبنية على أسس علمية رصينة، مع نخبة من الاستشاريين والأخصائيين المعتمدين.
        </p>

        <!-- Search / Quick Booking Pill Bar (0.4s delay stagger) -->
        <div class="desktop-hero-form animate-hero-form mt-6 w-full max-w-4xl rounded-full border border-white/15 bg-[#171720]/85 p-1.5 shadow-medium backdrop-blur-xl">
          <form class="flex items-center justify-between gap-2" @submit.prevent="() => handleBooking()">
            <!-- Name Input -->
            <div class="flex-1 px-3">
              <label for="d-name" class="sr-only">اسم العميل الكريم</label>
              <input
                id="d-name"
                v-model="clientName"
                type="text"
                autocomplete="name"
                placeholder="اسم العميل الكريم"
                class="desktop-hero-input h-10 w-full rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/50 focus:outline-none"
              >
            </div>

            <div class="h-6 w-px bg-white/20" aria-hidden="true" />

            <!-- Phone Input -->
            <div class="flex-1 px-3">
              <label for="d-phone" class="sr-only">رقم الهاتف / واتساب</label>
              <input
                id="d-phone"
                v-model="clientPhone"
                type="tel"
                dir="ltr"
                autocomplete="tel"
                placeholder="رقم الهاتف / واتساب"
                class="desktop-hero-input tnum h-10 w-full rounded-full bg-transparent px-3 text-right text-sm text-white placeholder:text-white/50 focus:outline-none"
              >
            </div>

            <div class="h-6 w-px bg-white/20" aria-hidden="true" />

            <!-- Service Dropdown on Desktop (unchanged) -->
            <div class="flex-1 px-3">
              <label for="d-service" class="sr-only">نوع الاستشارة</label>
              <select
                id="d-service"
                v-model="selectedService"
                class="desktop-hero-input h-10 w-full cursor-pointer rounded-full bg-transparent px-3 text-sm text-white focus:outline-none"
              >
                <option value="" disabled selected class="bg-[#171720] text-white/50">نوع الاستشارة...</option>
                <option v-for="s in quickConsultServices" :key="s" :value="s" class="bg-[#171720] text-white">{{ s }}</option>
              </select>
            </div>

            <!-- Submit Button with hover scale -->
            <button
              type="submit"
              class="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#e91e8c] px-6 text-sm font-bold text-white shadow-magenta transition-transform hover:bg-[#d8157e] active:scale-95 cursor-pointer"
            >
              <span>احجز استشارتك</span>
              <ArrowLeft class="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>

        <p v-if="formError" role="alert" class="mt-1 text-xs font-medium text-red-400">
          {{ formError }}
        </p>

        <!-- Desktop Session Type Toggle Buttons below the main form row -->
        <div class="animate-hero-form mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 cursor-pointer"
            :class="selectedMode === 'online' ? 'bg-[#e91e8c] text-white shadow-magenta' : 'desktop-toggle-inactive border border-white/20 bg-black/50 text-white/80 hover:border-[#e91e8c] hover:text-white'"
            @click="selectedMode = 'online'"
          >
            <span class="size-2 rounded-full" :class="selectedMode === 'online' ? 'bg-white animate-pulse' : 'bg-white/40'" />
            <span>جلسة أونلاين مباشرة</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 cursor-pointer"
            :class="selectedMode === 'in-person' ? 'bg-[#e91e8c] text-white shadow-magenta' : 'desktop-toggle-inactive border border-white/20 bg-black/50 text-white/80 hover:border-[#e91e8c] hover:text-white'"
            @click="selectedMode = 'in-person'"
          >
            <span class="size-2 rounded-full" :class="selectedMode === 'in-person' ? 'bg-white animate-pulse' : 'bg-white/40'" />
            <span>حضور شخصي بمقر تواصل</span>
          </button>
        </div>

        <!-- Trust Metrics 4 Columns Card with count-up & viewport fade-in/scale-up -->
        <div
          ref="statsContainerRef"
          class="desktop-hero-stats mt-6 w-full max-w-5xl rounded-3xl border border-white/10 bg-[#171720]/80 p-4 sm:p-5 backdrop-blur-md"
        >
          <dl class="grid grid-cols-4 gap-3 divide-x divide-x-reverse divide-white/10">
            <!-- 500+ -->
            <div
              class="stat-card-anim flex flex-col items-center text-center"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.1s;"
            >
              <dd class="tnum text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                +{{ statsAnimated ? count500 : 500 }}
              </dd>
              <dt class="mt-1 text-xs lg:text-sm font-bold text-white">
                جلسة استشارية ناجحة
              </dt>
              <p class="mt-0.5 text-[11px] text-white/60 leading-snug">
                خلال العام الحالي بنسبة رضا عالية
              </p>
            </div>

            <!-- 50+ -->
            <div
              class="stat-card-anim flex flex-col items-center text-center pe-3"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.2s;"
            >
              <dd class="tnum text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                +{{ statsAnimated ? count50 : 50 }}
              </dd>
              <dt class="mt-1 text-xs lg:text-sm font-bold text-white">
                استشاري ومعالج معتمد
              </dt>
              <p class="mt-0.5 text-[11px] text-white/60 leading-snug">
                أطباء وأخصائيون ذوو كفاءة وخبرة
              </p>
            </div>

            <!-- 8+ -->
            <div
              class="stat-card-anim flex flex-col items-center text-center pe-3"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.3s;"
            >
              <dd class="tnum text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                +{{ statsAnimated ? count8 : 8 }}
              </dd>
              <dt class="mt-1 text-xs lg:text-sm font-bold text-white">
                سنوات من التميز والعطاء
              </dt>
              <p class="mt-0.5 text-[11px] text-white/60 leading-snug">
                في تقديم الخدمات النفسية والأسرية
              </p>
            </div>

            <!-- 100% -->
            <div
              class="stat-card-anim flex flex-col items-center text-center pe-3"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.4s;"
            >
              <dd class="tnum text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                {{ statsAnimated ? count100 : 100 }}%
              </dd>
              <dt class="mt-1 text-xs lg:text-sm font-bold text-white">
                خصوصية وسرية تامة
              </dt>
              <p class="mt-0.5 text-[11px] text-white/60 leading-snug">
                وفق ميثاق الشرف الأخلاقي والمهني
              </p>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 2. MOBILE HERO LAYOUT (@media max-width: 768px)                   -->
    <!-- Top card with /hero.png background + vertical stack                -->
    <!-- 3 stat cards in one row with count-up & scale-up                   -->
    <!-- ================================================================= -->
    <div class="hero-mobile-view w-full bg-[#121218] px-3.5 py-4">
      <div class="mx-auto w-full max-w-[420px] flex flex-col gap-3.5">
        <!-- 1. Top Card with Background Image & Gradient Overlay -->
        <div class="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#161620] shadow-lg">
          <!-- Background Image with slow zoom -->
          <div class="relative h-64 w-full overflow-hidden">
            <img
              src="/hero.png"
              alt="أكاديمية تواصل — جلسة استشارية"
              class="hero-bg-zoom h-full w-full object-cover object-[center_20%]"
              loading="eager"
            >
            <!-- Gradient overlay at bottom -->
            <div class="mobile-hero-overlay absolute inset-0 bg-gradient-to-b from-black/25 via-black/40 to-[#161620]" />
          </div>

          <!-- Content inside top card (animated) -->
          <div class="relative -mt-20 px-4 pb-6 pt-2 text-center">
            <!-- Top badge with pink dot -->
            <div class="animate-hero-heading mobile-hero-badge inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3.5 py-1 text-[11px] font-medium text-white shadow-soft backdrop-blur-md">
              <span class="h-2 w-2 rounded-full bg-[#e91e8c]" aria-hidden="true" />
              <span>أكاديمية تواصل — جمهورية مصر العربية</span>
            </div>

            <!-- Main Heading -->
            <h1 class="animate-hero-heading mt-3.5 text-3xl font-extrabold tracking-tight text-white leading-tight">
              <span>نتواصل </span>
              <span class="relative inline-block text-[#e91e8c]">
                نفهم
                <svg
                  class="absolute -bottom-1.5 left-0 w-full text-[#e91e8c]"
                  viewBox="0 0 120 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M2 8C35 2 85 2 118 7"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
              <span> نساند</span>
            </h1>

            <!-- Subtext paragraph -->
            <p class="animate-hero-subtext mt-2.5 text-xs leading-relaxed text-white/75 max-w-sm mx-auto">
              نساعدك على استعادة التوازن النفسي والأسري بجلسات استشارية وعلاجية مبنية على أسس علمية رصينة.
            </p>
          </div>
        </div>

        <!-- 2. Form Section Card -->
        <div class="animate-hero-form mobile-hero-form relative rounded-[26px] border border-white/10 bg-[#171722] p-4 shadow-xl">
          <form class="flex flex-col gap-3.5" @submit.prevent="() => handleBooking()">
            <!-- Two Toggle Buttons Side-by-Side -->
            <div class="mobile-toggle-container grid grid-cols-2 gap-1 rounded-full bg-[#0e0e14] p-1 border border-white/5">
              <button
                type="button"
                class="rounded-full py-2.5 px-3 text-xs font-bold transition-all duration-200 text-center truncate cursor-pointer"
                :class="selectedMode === 'online' ? 'bg-[#e91e8c] text-white shadow-magenta' : 'mobile-toggle-inactive text-white/70 hover:text-white'"
                @click="selectedMode = 'online'"
              >
                جلسة أونلاين مشفرة
              </button>
              <button
                type="button"
                class="mobile-toggle-inactive rounded-full py-2.5 px-3 text-xs font-medium transition-all duration-200 text-center truncate cursor-pointer"
                :class="selectedMode === 'in-person' ? 'bg-[#e91e8c] text-white shadow-magenta' : 'text-white/70 hover:text-white'"
                @click="selectedMode = 'in-person'"
              >
                حضور شخصي بمقر تواصل
              </button>
            </div>

            <!-- Input 1: Client Name -->
            <div class="flex flex-col gap-1.5">
              <label for="m-client-name" class="mobile-hero-label text-xs font-medium text-white/90 text-right">
                الاسم الكريم
              </label>
              <input
                id="m-client-name"
                v-model="clientName"
                type="text"
                autocomplete="name"
                placeholder="أدخل اسمك بالكامل"
                class="mobile-hero-input h-11 w-full rounded-2xl border border-white/10 bg-[#101017] px-4 text-xs text-white placeholder:text-white/35 focus:border-[#e91e8c] focus:outline-none focus:ring-1 focus:ring-[#e91e8c]"
              >
            </div>

            <!-- Input 2: Phone / WhatsApp -->
            <div class="flex flex-col gap-1.5">
              <label for="m-client-phone" class="mobile-hero-label text-xs font-medium text-white/90 text-right">
                رقم الهاتف أو الواتساب
              </label>
              <input
                id="m-client-phone"
                v-model="clientPhone"
                type="tel"
                dir="ltr"
                autocomplete="tel"
                placeholder="+20 100 000 0000"
                class="mobile-hero-input tnum h-11 w-full rounded-2xl border border-white/10 bg-[#101017] px-4 text-left text-xs text-white placeholder:text-white/35 focus:border-[#e91e8c] focus:outline-none focus:ring-1 focus:ring-[#e91e8c]"
              >
            </div>

            <!-- Dropdown 3: Native HTML <select> on Mobile -->
            <div class="flex flex-col gap-1.5 w-full">
              <label for="m-native-select" class="mobile-hero-label text-xs font-medium text-white/90 text-right">
                نوع الاستشارة المطلوبة
              </label>
              <select
                id="m-native-select"
                v-model="selectedService"
                class="native-mobile-select"
              >
                <option value="">نوع الاستشارة المطلوبة...</option>
                <option value="استشارة نفسية متخصصة (فردية)">استشارة نفسية متخصصة (فردية)</option>
                <option value="الاستشارات التربوية وإرشاد الأسرة">الاستشارات التربوية وإرشاد الأسرة</option>
                <option value="الاستشارات الزوجية والأسرية">الاستشارات الزوجية والأسرية</option>
                <option value="التخاطب وعيوب النطق والكلام">التخاطب وعيوب النطق والكلام</option>
                <option value="تعديل وتوجيه السلوك">تعديل وتوجيه السلوك</option>
                <option value="تنمية المهارات والقدرات">تنمية المهارات والقدرات</option>
              </select>
            </div>

            <p v-if="formError" role="alert" class="text-xs font-medium text-red-400">
              {{ formError }}
            </p>

            <!-- Full-width CTA button -->
            <button
              type="submit"
              class="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#e91e8c] px-6 text-sm font-bold text-white shadow-magenta transition-transform hover:bg-[#d8157e] active:scale-[0.98] cursor-pointer"
            >
              <span>احجز استشارتك الآن</span>
              <ArrowLeft class="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>

        <!-- 3. Stats Section below form: 3 cards in ONE row without horizontal scroll -->
        <div ref="mobileStatsRef" class="flex flex-col gap-2 pt-1">
          <!-- Header row -->
          <div class="flex items-center justify-between px-1 text-xs">
            <span class="font-bold text-[#e91e8c]">أرقام نفخر بها</span>
            <span class="mobile-stats-hint text-[11px] text-white/50">اسحب لليمين واليسار ←</span>
          </div>

          <!-- 3 cards in one row -->
          <div class="grid grid-cols-3 gap-2" role="region" aria-label="أرقام وإحصائيات">
            <!-- Card 1: 500+ جلسة ناجحة -->
            <div
              class="stat-card-anim mobile-stat-card flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.1s;"
            >
              <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">+{{ statsAnimated ? count500 : 500 }}</span>
              <span class="mobile-stat-title mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">جلسة ناجحة</span>
              <span class="mobile-stat-sub mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">نتائج إيجابية مستدامة</span>
            </div>

            <!-- Card 2: 50+ استشاري معتمد -->
            <div
              class="stat-card-anim mobile-stat-card flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.2s;"
            >
              <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">+{{ statsAnimated ? count50 : 50 }}</span>
              <span class="mobile-stat-title mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">استشاري معتمد</span>
              <span class="mobile-stat-sub mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">أطباء ذوو خبرة</span>
            </div>

            <!-- Card 3: 3+ خبرة -->
            <div
              class="stat-card-anim mobile-stat-card flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.3s;"
            >
              <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">+{{ statsAnimated ? count3 : 3 }}</span>
              <span class="mobile-stat-title mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">سنوات خبرة</span>
              <span class="mobile-stat-sub mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">مسار علاجي معتمد</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Slow subtle zoom-in on hero background image (8s looping) */
@keyframes heroBgZoom {
  0% {
    transform: scale(1.05);
  }
  50% {
    transform: scale(1);
  }
  100% {
    transform: scale(1.05);
  }
}

.hero-bg-zoom {
  animation: heroBgZoom 8s ease-in-out infinite;
  will-change: transform;
}

/* Fade in + slide up (opacity 0->1, translateY 20px->0) */
@keyframes heroFadeUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-hero-heading {
  animation: heroFadeUp 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s both;
}

.animate-hero-subtext {
  animation: heroFadeUp 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s both;
}

.animate-hero-form {
  animation: heroFadeUp 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.5s both;
}

/* Stats card fade in + scale up */
.stat-card-anim {
  opacity: 0;
  transform: scale(0.95) translateY(12px);
  transition: opacity 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.stat-card-anim.is-active {
  opacity: 1;
  transform: scale(1) translateY(0);
}

/* Native HTML <select> styling on mobile */
.native-mobile-select {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  padding-left: 2.5rem;
  color: #ffffff;
  font-size: 0.9rem;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.7)' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: left 1rem center;
  background-size: 1.25rem;
  cursor: pointer;
}

.native-mobile-select:focus {
  border-color: #e91e8c;
  outline: none;
  box-shadow: 0 0 0 1px #e91e8c;
}

.native-mobile-select option {
  background-color: #1a1a2e;
  color: #ffffff;
}

/* Light mode glassy styling for hero overlay elements */
:root:not(.dark) .desktop-hero-form,
.light .desktop-hero-form,
[data-theme="light"] .desktop-hero-form {
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
}

:root:not(.dark) .desktop-hero-input,
.light .desktop-hero-input,
[data-theme="light"] .desktop-hero-input {
  background-color: rgba(255, 255, 255, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
  color: #ffffff !important;
}

:root:not(.dark) .desktop-hero-input::placeholder,
.light .desktop-hero-input::placeholder,
[data-theme="light"] .desktop-hero-input::placeholder {
  color: rgba(255, 255, 255, 0.8) !important;
}

:root:not(.dark) .desktop-toggle-inactive,
.light .desktop-toggle-inactive,
[data-theme="light"] .desktop-toggle-inactive {
  background: rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
}

:root:not(.dark) .desktop-hero-stats,
.light .desktop-hero-stats,
[data-theme="light"] .desktop-hero-stats {
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}

:root:not(.dark) .desktop-hero-stats dd,
.light .desktop-hero-stats dd,
[data-theme="light"] .desktop-hero-stats dd {
  color: #ffffff !important;
}

:root:not(.dark) .desktop-hero-stats dt,
:root:not(.dark) .desktop-hero-stats p,
.light .desktop-hero-stats dt,
.light .desktop-hero-stats p,
[data-theme="light"] .desktop-hero-stats dt,
[data-theme="light"] .desktop-hero-stats p {
  color: rgba(255, 255, 255, 0.85) !important;
}

:root:not(.dark) .desktop-hero-stats dl > div,
.light .desktop-hero-stats dl > div,
[data-theme="light"] .desktop-hero-stats dl > div {
  border-color: rgba(255, 255, 255, 0.2) !important;
}

/* Strict CSS media query separation */
@media (max-width: 768px) {
  .hero-section {
    overflow: visible !important;
  }
  .hero-desktop-view {
    display: none !important;
  }
  .hero-mobile-view {
    display: block !important;
  }

  /* Mobile Hero in light mode */
  :root:not(.dark) .mobile-hero-overlay,
  .light .mobile-hero-overlay,
  [data-theme="light"] .mobile-hero-overlay {
    background: rgba(255, 255, 255, 0.12) !important;
  }

  :root:not(.dark) .mobile-hero-badge,
  .light .mobile-hero-badge,
  [data-theme="light"] .mobile-hero-badge {
    background: rgba(255, 255, 255, 0.2) !important;
    color: #ffffff !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
  }

  :root:not(.dark) .mobile-hero-form,
  .light .mobile-hero-form,
  [data-theme="light"] .mobile-hero-form {
    background: #f5f5fa !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05) !important;
  }

  :root:not(.dark) .mobile-toggle-container,
  .light .mobile-toggle-container,
  [data-theme="light"] .mobile-toggle-container {
    background: #e8e8f2 !important;
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
  }

  :root:not(.dark) .mobile-toggle-inactive,
  .light .mobile-toggle-inactive,
  [data-theme="light"] .mobile-toggle-inactive {
    background: #f0f0f8 !important;
    color: #1a1a2e !important;
    border: 1px solid rgba(0, 0, 0, 0.1) !important;
  }

  :root:not(.dark) .mobile-hero-label,
  .light .mobile-hero-label,
  [data-theme="light"] .mobile-hero-label {
    color: #1a1a2e !important;
  }

  :root:not(.dark) .mobile-hero-input,
  .light .mobile-hero-input,
  [data-theme="light"] .mobile-hero-input {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
    color: #1a1a2e !important;
  }

  :root:not(.dark) .mobile-hero-input::placeholder,
  .light .mobile-hero-input::placeholder,
  [data-theme="light"] .mobile-hero-input::placeholder {
    color: rgba(0, 0, 0, 0.4) !important;
  }

  :root:not(.dark) .native-mobile-select,
  .light .native-mobile-select,
  [data-theme="light"] .native-mobile-select {
    background-color: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
    color: #1a1a2e !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(26,26,46,0.7)' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E") !important;
  }

  :root:not(.dark) .native-mobile-select option,
  .light .native-mobile-select option,
  [data-theme="light"] .native-mobile-select option {
    background: #ffffff !important;
    color: #1a1a2e !important;
  }

  :root:not(.dark) .mobile-stat-card,
  .light .mobile-stat-card,
  [data-theme="light"] .mobile-stat-card {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
  }

  :root:not(.dark) .mobile-stat-title,
  .light .mobile-stat-title,
  [data-theme="light"] .mobile-stat-title {
    color: #1a1a2e !important;
  }

  :root:not(.dark) .mobile-stat-sub,
  .light .mobile-stat-sub,
  [data-theme="light"] .mobile-stat-sub {
    color: #444444 !important;
  }

  :root:not(.dark) .mobile-stats-hint,
  .light .mobile-stats-hint,
  [data-theme="light"] .mobile-stats-hint {
    color: #666666 !important;
  }
}

@media (min-width: 769px) {
  .desktop-hero-heading {
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  }
  .desktop-hero-subtext {
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
  }
  .hero-section {
    overflow: hidden !important;
  }
  .hero-desktop-view {
    display: flex !important;
    height: calc(100vh - 80px) !important;
    min-height: calc(100vh - 80px) !important;
    max-height: calc(100vh - 80px) !important;
  }
  .hero-mobile-view {
    display: none !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-bg-zoom {
    animation: none !important;
    transform: none !important;
  }
  .animate-hero-heading,
  .animate-hero-subtext,
  .animate-hero-form {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .stat-card-anim {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
</style>
