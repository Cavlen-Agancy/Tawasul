<script setup lang="ts">
import { ArrowLeft, ChevronDown } from 'lucide-vue-next'
import { quickConsultServices } from '~/lib/home-content'
import { siteConfig } from '~/lib/site'

const selectedMode = ref<'online' | 'in-person'>('online')
const clientName = ref('')
const clientPhone = ref('')
const selectedService = ref('')
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
  <section id="hero" aria-labelledby="hero-title" class="relative w-full overflow-hidden">
    <!-- ================================================================= -->
    <!-- 1. DESKTOP HERO LAYOUT (@media min-width: 769px)                  -->
    <!-- EXACT MATCH TO IMAGE 1 SCREENSHOT WITH SUBTLE ANIMATIONS          -->
    <!-- ================================================================= -->
    <div class="hero-desktop-view relative w-full overflow-hidden bg-[#111116] pt-12 pb-20">
      <!-- Background image with looping slow zoom-in (scale 1.05 -> 1) -->
      <div
        class="hero-bg-zoom pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style="background-image: url('/hero.png');"
        aria-hidden="true"
      />

      <!-- Dark overlay -->
      <div class="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#111116]" aria-hidden="true" />

      <!-- Center content with staggered entrance animations -->
      <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        <!-- Top Pill Badge -->
        <div class="animate-hero-heading inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-1.5 text-xs font-medium text-white shadow-soft backdrop-blur-md">
          <span class="h-2 w-2 rounded-full bg-[#e91e8c] animate-pulse" aria-hidden="true" />
          <span>أكاديمية تواصل — بجمهورية مصر العربية</span>
        </div>

        <!-- Main Headline (fade in + slide up) -->
        <h1 class="animate-hero-heading mt-7 text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-white leading-[1.15]">
          <span>نتواصل </span>
          <span class="relative inline-block text-[#e91e8c]">
            نفهم
          </span>
          <span> نساند</span>
        </h1>

        <!-- Subtitle (0.2s delay stagger) -->
        <p class="animate-hero-subtext mt-5 max-w-2xl text-base lg:text-lg leading-relaxed text-white/80">
          نساعدك على استعادة التوازن النفسي والأسري من خلال جلسات استشارية وعلاجية مبنية على أسس علمية رصينة، مع نخبة من الاستشاريين والأخصائيين المعتمدين.
        </p>

        <!-- Search / Quick Booking Pill Bar (0.4s delay stagger) -->
        <div class="animate-hero-form mt-9 w-full max-w-4xl rounded-full border border-white/15 bg-[#171720]/85 p-2 shadow-medium backdrop-blur-xl">
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
                class="h-11 w-full rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/50 focus:outline-none"
              >
            </div>

            <div class="h-7 w-px bg-white/20" aria-hidden="true" />

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
                class="tnum h-11 w-full rounded-full bg-transparent px-3 text-right text-sm text-white placeholder:text-white/50 focus:outline-none"
              >
            </div>

            <div class="h-7 w-px bg-white/20" aria-hidden="true" />

            <!-- Service Dropdown -->
            <div class="flex-1 px-3">
              <label for="d-service" class="sr-only">نوع الاستشارة</label>
              <select
                id="d-service"
                v-model="selectedService"
                class="h-11 w-full cursor-pointer rounded-full bg-transparent px-3 text-sm text-white focus:outline-none"
              >
                <option value="" disabled selected class="bg-[#171720] text-white/50">نوع الاستشارة...</option>
                <option v-for="s in quickConsultServices" :key="s" :value="s" class="bg-[#171720] text-white">{{ s }}</option>
              </select>
            </div>

            <!-- Submit Button with hover scale -->
            <button
              type="submit"
              class="flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#e91e8c] px-7 font-bold text-white shadow-magenta transition-transform hover:bg-[#d8157e] active:scale-95"
            >
              <span>احجز استشارتك</span>
              <ArrowLeft class="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>

        <p v-if="formError" role="alert" class="mt-2 text-xs font-medium text-red-400">
          {{ formError }}
        </p>

        <!-- Direct Selection Badges -->
        <div class="animate-hero-form mt-4 flex items-center justify-center gap-2 text-xs text-white/70">
          <span>أو تفضل باختيار طريقة الجلسة مباشرة:</span>
          <button
            type="button"
            class="rounded-full border border-white/20 bg-black/50 px-4 py-1 text-xs text-white/90 transition-colors hover:border-[#e91e8c] hover:text-[#e91e8c] active:scale-95"
            @click="handleBooking('online')"
          >
            جلسة أونلاين مباشرة
          </button>
          <button
            type="button"
            class="rounded-full border border-white/20 bg-black/50 px-4 py-1 text-xs text-white/90 transition-colors hover:border-[#e91e8c] hover:text-[#e91e8c] active:scale-95"
            @click="handleBooking('in-person')"
          >
            حضور شخصي بمقر تواصل
          </button>
        </div>

        <!-- Trust Metrics 4 Columns Card with count-up & viewport fade-in/scale-up -->
        <div
          ref="statsContainerRef"
          class="mt-12 w-full max-w-5xl rounded-3xl border border-white/10 bg-[#171720]/80 p-6 sm:p-8 backdrop-blur-md"
        >
          <dl class="grid grid-cols-4 gap-4 divide-x divide-x-reverse divide-white/10">
            <!-- 500+ -->
            <div
              class="stat-card-anim flex flex-col items-center text-center"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.1s;"
            >
              <dd class="tnum text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                +{{ statsAnimated ? count500 : 500 }}
              </dd>
              <dt class="mt-2 text-sm font-bold text-white">
                جلسة استشارية ناجحة
              </dt>
              <p class="mt-1 text-xs text-white/60 leading-snug">
                خلال العام الحالي بنسبة رضا عالية
              </p>
            </div>

            <!-- 50+ -->
            <div
              class="stat-card-anim flex flex-col items-center text-center pe-4"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.2s;"
            >
              <dd class="tnum text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                +{{ statsAnimated ? count50 : 50 }}
              </dd>
              <dt class="mt-2 text-sm font-bold text-white">
                استشاري ومعالج معتمد
              </dt>
              <p class="mt-1 text-xs text-white/60 leading-snug">
                أطباء وأخصائيون ذوو كفاءة وخبرة
              </p>
            </div>

            <!-- 8+ -->
            <div
              class="stat-card-anim flex flex-col items-center text-center pe-4"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.3s;"
            >
              <dd class="tnum text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                +{{ statsAnimated ? count8 : 8 }}
              </dd>
              <dt class="mt-2 text-sm font-bold text-white">
                سنوات من التميز والعطاء
              </dt>
              <p class="mt-1 text-xs text-white/60 leading-snug">
                في تقديم الخدمات النفسية والأسرية
              </p>
            </div>

            <!-- 100% -->
            <div
              class="stat-card-anim flex flex-col items-center text-center pe-4"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.4s;"
            >
              <dd class="tnum text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {{ statsAnimated ? count100 : 100 }}%
              </dd>
              <dt class="mt-2 text-sm font-bold text-white">
                خصوصية وسرية تامة
              </dt>
              <p class="mt-1 text-xs text-white/60 leading-snug">
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
            <div class="absolute inset-0 bg-gradient-to-b from-black/25 via-black/40 to-[#161620]" />
          </div>

          <!-- Content inside top card (animated) -->
          <div class="relative -mt-20 px-4 pb-6 pt-2 text-center">
            <!-- Top badge with pink dot -->
            <div class="animate-hero-heading inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3.5 py-1 text-[11px] font-medium text-white shadow-soft backdrop-blur-md">
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
        <div class="animate-hero-form rounded-[26px] border border-white/10 bg-[#171722] p-4 shadow-xl">
          <form class="flex flex-col gap-3.5" @submit.prevent="() => handleBooking()">
            <!-- Two Toggle Buttons Side-by-Side -->
            <div class="grid grid-cols-2 gap-1 rounded-full bg-[#0e0e14] p-1 border border-white/5">
              <button
                type="button"
                class="rounded-full py-2.5 px-3 text-xs font-bold transition-all duration-200 text-center truncate"
                :class="selectedMode === 'online' ? 'bg-[#e91e8c] text-white shadow-magenta' : 'text-white/70 hover:text-white'"
                @click="selectedMode = 'online'"
              >
                جلسة أونلاين مشفرة
              </button>
              <button
                type="button"
                class="rounded-full py-2.5 px-3 text-xs font-medium transition-all duration-200 text-center truncate"
                :class="selectedMode === 'in-person' ? 'bg-[#e91e8c] text-white shadow-magenta' : 'text-white/70 hover:text-white'"
                @click="selectedMode = 'in-person'"
              >
                حضور شخصي بمقر تواصل
              </button>
            </div>

            <!-- Input 1: Client Name -->
            <div class="flex flex-col gap-1.5">
              <label for="m-client-name" class="text-xs font-medium text-white/90 text-right">
                الاسم الكريم
              </label>
              <input
                id="m-client-name"
                v-model="clientName"
                type="text"
                autocomplete="name"
                placeholder="أدخل اسمك بالكامل"
                class="h-11 w-full rounded-2xl border border-white/10 bg-[#101017] px-4 text-xs text-white placeholder:text-white/35 focus:border-[#e91e8c] focus:outline-none focus:ring-1 focus:ring-[#e91e8c]"
              >
            </div>

            <!-- Input 2: Phone / WhatsApp -->
            <div class="flex flex-col gap-1.5">
              <label for="m-client-phone" class="text-xs font-medium text-white/90 text-right">
                رقم الهاتف أو الواتساب
              </label>
              <input
                id="m-client-phone"
                v-model="clientPhone"
                type="tel"
                dir="ltr"
                autocomplete="tel"
                placeholder="+20 100 000 0000"
                class="tnum h-11 w-full rounded-2xl border border-white/10 bg-[#101017] px-4 text-left text-xs text-white placeholder:text-white/35 focus:border-[#e91e8c] focus:outline-none focus:ring-1 focus:ring-[#e91e8c]"
              >
            </div>

            <!-- Dropdown 3: Service Selection -->
            <div class="flex flex-col gap-1.5">
              <label for="m-service-select" class="text-xs font-medium text-white/90 text-right">
                نوع الاستشارة المطلوبة
              </label>
              <div class="relative">
                <select
                  id="m-service-select"
                  v-model="selectedService"
                  class="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-[#101017] pe-10 ps-4 text-xs text-white focus:border-[#e91e8c] focus:outline-none focus:ring-1 focus:ring-[#e91e8c]"
                >
                  <option
                    v-for="s in serviceOptions"
                    :key="s"
                    :value="s"
                    class="bg-[#171722] text-white"
                  >
                    {{ s }}
                  </option>
                </select>
                <span class="pointer-events-none absolute inset-y-0 start-3 flex items-center text-white/60">
                  <ChevronDown class="size-4" />
                </span>
              </div>
            </div>

            <p v-if="formError" role="alert" class="text-xs font-medium text-red-400">
              {{ formError }}
            </p>

            <!-- Full-width CTA button -->
            <button
              type="submit"
              class="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#e91e8c] px-6 text-sm font-bold text-white shadow-magenta transition-transform hover:bg-[#d8157e] active:scale-[0.98]"
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
            <span class="text-[11px] text-white/50">اسحب لليمين واليسار ←</span>
          </div>

          <!-- 3 cards in one row -->
          <div class="grid grid-cols-3 gap-2" role="region" aria-label="أرقام وإحصائيات">
            <!-- Card 1: 500+ جلسة ناجحة -->
            <div
              class="stat-card-anim flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.1s;"
            >
              <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">+{{ statsAnimated ? count500 : 500 }}</span>
              <span class="mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">جلسة ناجحة</span>
              <span class="mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">نتائج إيجابية مستدامة</span>
            </div>

            <!-- Card 2: 50+ استشاري معتمد -->
            <div
              class="stat-card-anim flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.2s;"
            >
              <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">+{{ statsAnimated ? count50 : 50 }}</span>
              <span class="mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">استشاري معتمد</span>
              <span class="mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">أطباء ذوو خبرة</span>
            </div>

            <!-- Card 3: 3+ خبرة -->
            <div
              class="stat-card-anim flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center"
              :class="{ 'is-active': statsAnimated }"
              style="transition-delay: 0.3s;"
            >
              <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">+{{ statsAnimated ? count3 : 3 }}</span>
              <span class="mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">سنوات خبرة</span>
              <span class="mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">مسار علاجي معتمد</span>
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

/* Strict CSS media query separation */
@media (max-width: 768px) {
  .hero-desktop-view {
    display: none !important;
  }
  .hero-mobile-view {
    display: block !important;
  }
}

@media (min-width: 769px) {
  .hero-desktop-view {
    display: block !important;
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
