<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { quickConsultServices } from '~/lib/home-content'
import { siteConfig } from '~/lib/site'

definePageMeta({ layout: 'default' })

useHead({
  title: 'أكاديمية تواصل — نتواصل نفهم نساند',
  meta: [
    {
      name: 'description',
      content: 'أكاديمية تواصل — استشارات نفسية وتربوية وأسرية وتخاطب، أونلاين وحضوريًا بسرية تامة.',
    },
    { property: 'og:title', content: 'أكاديمية تواصل — نتواصل نفهم نساند' },
    {
      property: 'og:description',
      content: 'مساحتك الآمنة للدعم النفسي والتربوي والأسري — احجز أونلاين أو حضوريًا.',
    },
    { property: 'og:locale', content: 'ar_EG' },
  ],
  htmlAttrs: { dir: 'rtl', lang: 'ar' },
})

// ==========================================
// Hero Background Slideshow
// ==========================================
const heroImages = [
  '/hero.png',
  '/1.jpeg',
  '/2.jpeg',
  '/3.jpeg',
]

const currentImageIndex = ref(0)
const nextImageIndex = ref(1)
const isTransitioning = ref(false)

let slideshowInterval: ReturnType<typeof setInterval> | null = null

function startSlideshow() {
  slideshowInterval = setInterval(() => {
    isTransitioning.value = true
    currentImageIndex.value = (currentImageIndex.value + 1) % heroImages.length
    nextImageIndex.value = (currentImageIndex.value + 1) % heroImages.length
    setTimeout(() => {
      isTransitioning.value = false
    }, 2000)
  }, 5000) // كل 5 ثواني (3 عرض + 2 transition)
}

// ==========================================
// Hero Content State & Logic
// ==========================================
const selectedMode = ref<'online' | 'in-person'>('in-person')
const clientName = ref('')
const clientPhone = ref('')
const selectedService = ref('استشارة نفسية متخصصة (فردية)')
const formError = ref('')

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

onMounted(() => {
  startSlideshow()
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

onUnmounted(() => {
  if (slideshowInterval) clearInterval(slideshowInterval)
})

// ==========================================
// Courses Section Data
// ==========================================
interface TrainingCourse {
  id: string
  image: string
  badge: string
  title: string
  description: string
}

const courses: TrainingCourse[] = [
  {
    id: 'course-1',
    image: '/1.jpeg',
    badge: 'أطفال وآباء',
    title: 'تهيئة الطفل لمراحل النمو',
    description: 'برنامج تدريبي للآباء والأمهات لفهم احتياجات الطفل النفسية وتوجيه سلوكه بأساليب حديثة وفعّالة.',
  },
  {
    id: 'course-2',
    image: '/2.jpeg',
    badge: 'أزواج ومقبلون',
    title: 'بناء علاقة زوجية أقوى',
    description: 'دورة إرشادية متخصصة للأزواج لتعزيز التواصل الفعّال وحل الخلافات وبناء أسرة قائمة على الاحترام والمودة.',
  },
  {
    id: 'course-3',
    image: '/3.jpeg',
    badge: 'جلسات فردية',
    title: 'رحلتك نحو التوازن النفسي',
    description: 'برنامج تدريبي فردي لإدارة التوتر والقلق وبناء المرونة الذاتية في مواجهة ضغوط الحياة اليومية.',
  },
]
</script>

<template>
  <div dir="rtl" lang="ar">
    <!-- Hero Section with Background Slideshow -->
    <section id="hero" aria-labelledby="hero-title" class="hero-section relative w-full overflow-hidden">
      <!-- 1. DESKTOP HERO LAYOUT (@media min-width: 769px) -->
      <div class="hero-desktop-view relative w-full h-[calc(100vh-80px)] min-h-[calc(100vh-80px)] max-h-[calc(100vh-80px)] overflow-hidden flex flex-col justify-center items-center">
        <!-- Desktop Slideshow background -->
        <div class="pointer-events-none absolute inset-0 z-0">
          <div
            v-for="(img, idx) in heroImages"
            :key="`d-${img}`"
            class="hero-bg"
            :class="[
              idx === currentImageIndex ? 'current opacity-100' : 'opacity-0 pointer-events-none',
              idx === nextImageIndex ? 'next' : '',
            ]"
            :style="{
              backgroundImage: `url(${img})`,
              zIndex: idx === currentImageIndex ? 2 : 1,
            }"
          />
          <!-- Dark overlay adjusted for optimal text readability on desktop -->
          <div class="absolute inset-0 z-[3]" style="background: rgba(0, 0, 0, 0.55);" />
          <div class="absolute inset-0 z-[4] bg-gradient-to-b from-black/20 via-transparent to-[#111116]" />
        </div>

        <!-- Center content with vertical centering -->
        <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8 my-auto">
          <!-- Main Headline -->
          <h1 class="desktop-hero-heading animate-hero-heading mt-2 text-4xl lg:text-5xl xl:text-[3.75rem] font-extrabold tracking-tight text-white leading-[1.15]">
            <span>نتواصل </span>
            <span class="relative inline-block text-[#e91e8c]">
              نفهم
            </span>
            <span> نساند</span>
          </h1>

          <!-- Subtitle -->
          <p class="desktop-hero-subtext animate-hero-subtext mt-3 max-w-2xl text-xs sm:text-sm lg:text-base leading-relaxed text-white/80">
            نساعدك على استعادة التوازن النفسي والأسري من خلال جلسات استشارية وعلاجية مبنية على أسس علمية رصينة، مع نخبة من الاستشاريين والأخصائيين المعتمدين.
          </p>

          <!-- Search / Quick Booking Pill Bar -->
          <div class="desktop-hero-form animate-hero-form mt-6 w-full max-w-4xl rounded-full border border-white/15 bg-[#171720]/85 p-1.5 shadow-medium backdrop-blur-xl">
            <form class="flex items-center justify-between gap-2" @submit.prevent="() => handleBooking()">
              <!-- Name Input -->
              <div class="flex-1 px-3">
                <label for="d-name" class="sr-only">اسم العميل</label>
                <input
                  id="d-name"
                  v-model="clientName"
                  type="text"
                  autocomplete="name"
                  placeholder="اسم العميل"
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

              <!-- Service Dropdown -->
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

              <!-- Submit Button -->
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
              class="flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 cursor-pointer desktop-toggle-inactive border border-white/20 bg-black/50 text-white/80 hover:border-[#e91e8c] hover:text-white"
              @click="navigateTo(siteConfig.auth.loginPath)"
            >
              <span class="size-2 rounded-full bg-white/40" />
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

          <!-- Trust Metrics 4 Columns Card -->
          <div
            ref="statsContainerRef"
            class="desktop-hero-stats mt-6 w-full max-w-5xl rounded-3xl border border-white/10 bg-[#171720]/80 p-4 sm:p-5 backdrop-blur-md"
          >
            <dl class="grid grid-cols-4 gap-3 divide-x divide-x-reverse divide-white/10">
              <div class="stat-card-anim flex flex-col items-center text-center" :class="{ 'is-active': statsAnimated }" style="transition-delay: 0.1s;">
                <dd class="tnum text-2xl lg:text-3xl font-extrabold tracking-tight text-white">+{{ statsAnimated ? count500 : 500 }}</dd>
                <dt class="mt-1 text-xs lg:text-sm font-bold text-white">جلسة استشارية ناجحة</dt>
                <p class="mt-0.5 text-[11px] text-white/60 leading-snug">خلال العام الحالي بنسبة رضا عالية</p>
              </div>
              <div class="stat-card-anim flex flex-col items-center text-center pe-3" :class="{ 'is-active': statsAnimated }" style="transition-delay: 0.2s;">
                <dd class="tnum text-2xl lg:text-3xl font-extrabold tracking-tight text-white">+{{ statsAnimated ? count50 : 50 }}</dd>
                <dt class="mt-1 text-xs lg:text-sm font-bold text-white">استشاري ومعالج معتمد</dt>
                <p class="mt-0.5 text-[11px] text-white/60 leading-snug">أطباء وأخصائيون ذوو كفاءة وخبرة</p>
              </div>
              <div class="stat-card-anim flex flex-col items-center text-center pe-3" :class="{ 'is-active': statsAnimated }" style="transition-delay: 0.3s;">
                <dd class="tnum text-2xl lg:text-3xl font-extrabold tracking-tight text-white">+{{ statsAnimated ? count8 : 8 }}</dd>
                <dt class="mt-1 text-xs lg:text-sm font-bold text-white">سنوات من التميز والعطاء</dt>
                <p class="mt-0.5 text-[11px] text-white/60 leading-snug">في تقديم الخدمات النفسية والأسرية</p>
              </div>
              <div class="stat-card-anim flex flex-col items-center text-center pe-3" :class="{ 'is-active': statsAnimated }" style="transition-delay: 0.4s;">
                <dd class="tnum text-2xl lg:text-3xl font-extrabold tracking-tight text-white">{{ statsAnimated ? count100 : 100 }}%</dd>
                <dt class="mt-1 text-xs lg:text-sm font-bold text-white">خصوصية وسرية تامة</dt>
                <p class="mt-0.5 text-[11px] text-white/60 leading-snug">وفق ميثاق الشرف الأخلاقي والمهني</p>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <!-- 2. MOBILE HERO LAYOUT (@media max-width: 768px) MATCHING IMAGE 1 -->
      <div class="hero-mobile-view w-full bg-[#121218] px-3.5 py-4">
        <div class="mx-auto w-full max-w-[420px] flex flex-col gap-3.5">
          <!-- 1. Top Card with Slideshow Background Image & Gradient Overlay -->
          <div class="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#161620] shadow-lg min-h-[380px] flex flex-col justify-end">
            <!-- Mobile Background Slideshow -->
            <div class="pointer-events-none absolute inset-0 z-0">
              <div
                v-for="(img, idx) in heroImages"
                :key="`m-${img}`"
                class="hero-bg"
                :class="[
                  idx === currentImageIndex ? 'current opacity-100' : 'opacity-0 pointer-events-none',
                  idx === nextImageIndex ? 'next' : '',
                ]"
                :style="{
                  backgroundImage: `url(${img})`,
                  backgroundPosition: 'center 15%',
                  zIndex: idx === currentImageIndex ? 2 : 1,
                }"
              />
              <!-- Gradient overlay at bottom matching Image 1 -->
              <div class="absolute inset-0 z-[3] bg-gradient-to-b from-black/20 via-black/45 to-[#161620]/95" />
            </div>

            <!-- Content inside top card -->
            <div class="relative z-10 px-4 pb-6 pt-28 text-center flex flex-col items-center">
              <!-- Main Heading with curvy underline under 'نفهم' -->
              <h1 class="animate-hero-heading text-3xl font-extrabold tracking-tight text-white leading-tight">
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

              <!-- Subtext paragraph (same copy as desktop hero) -->
              <p class="animate-hero-subtext mt-2.5 text-xs leading-relaxed text-white/80 max-w-sm mx-auto">
                نساعدك على استعادة التوازن النفسي والأسري من خلال جلسات استشارية وعلاجية مبنية على أسس علمية رصينة، مع نخبة من الاستشاريين والأخصائيين المعتمدين.
              </p>
            </div>
          </div>

          <!-- 2. Form Section Card matching Image 1 -->
          <div class="animate-hero-form relative rounded-[26px] border border-white/10 bg-[#171722] p-4 shadow-xl">
            <form class="flex flex-col gap-3.5" @submit.prevent="() => handleBooking()">
              <!-- Two Toggle Buttons Side-by-Side matching Image 1 -->
              <div class="grid grid-cols-2 gap-1 rounded-full bg-[#0e0e14] p-1 border border-white/5">
                <button
                  type="button"
                  class="rounded-full py-2.5 px-3 text-xs font-bold transition-all duration-200 text-center truncate cursor-pointer text-white/70 hover:text-white"
                  @click="navigateTo(siteConfig.auth.loginPath)"
                >
                  جلسة أونلاين مباشرة
                </button>
                <button
                  type="button"
                  class="rounded-full py-2.5 px-3 text-xs font-medium transition-all duration-200 text-center truncate cursor-pointer"
                  :class="selectedMode === 'in-person' ? 'bg-[#e91e8c] text-white shadow-magenta' : 'text-white/70 hover:text-white'"
                  @click="selectedMode = 'in-person'"
                >
                  حضور شخصي بمقر تواصل
                </button>
              </div>

              <!-- Input 1: Client Name matching Image 1 -->
              <div class="flex flex-col gap-1.5 text-right">
                <label for="m-client-name" class="text-xs font-medium text-white/90">
                  اسم العميل
                </label>
                <input
                  id="m-client-name"
                  v-model="clientName"
                  type="text"
                  autocomplete="name"
                  placeholder="ادخل اسمك بالكامل"
                  class="h-11 w-full rounded-2xl border border-white/10 bg-[#101017] px-4 text-xs text-white placeholder:text-white/35 focus:border-[#e91e8c] focus:outline-none focus:ring-1 focus:ring-[#e91e8c]"
                >
              </div>

              <!-- Input 2: Phone / WhatsApp -->
              <div class="flex flex-col gap-1.5 text-right">
                <label for="m-client-phone" class="text-xs font-medium text-white/90">
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

              <!-- Dropdown 3: Service -->
              <div class="flex flex-col gap-1.5 text-right w-full">
                <label for="m-native-select" class="text-xs font-medium text-white/90">
                  نوع الاستشارة المطلوبة
                </label>
                <select
                  id="m-native-select"
                  v-model="selectedService"
                  class="native-mobile-select h-11 w-full rounded-2xl border border-white/10 bg-[#101017] px-4 text-xs text-white focus:border-[#e91e8c] focus:outline-none focus:ring-1 focus:ring-[#e91e8c]"
                >
                  <option value="">نوع الاستشارة المطلوبة...</option>
                  <option v-for="s in quickConsultServices" :key="s" :value="s">{{ s }}</option>
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

          <!-- 3. Stats Section below form: same 4 stats as desktop hero -->
          <div ref="mobileStatsRef" class="flex flex-col gap-2 pt-1">
            <div class="flex items-center justify-center px-1 text-xs">
              <span class="font-bold text-[#e91e8c]">أرقام نفخر بها</span>
            </div>

            <div class="grid grid-cols-2 gap-2" role="region" aria-label="أرقام وإحصائيات">
              <div class="stat-card-anim flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center" :class="{ 'is-active': statsAnimated }" style="transition-delay: 0.1s;">
                <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">+{{ statsAnimated ? count500 : 500 }}</span>
                <span class="mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">جلسة استشارية ناجحة</span>
                <span class="mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">خلال العام الحالي بنسبة رضا عالية</span>
              </div>

              <div class="stat-card-anim flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center" :class="{ 'is-active': statsAnimated }" style="transition-delay: 0.2s;">
                <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">+{{ statsAnimated ? count50 : 50 }}</span>
                <span class="mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">استشاري ومعالج معتمد</span>
                <span class="mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">أطباء وأخصائيون ذوو كفاءة وخبرة</span>
              </div>

              <div class="stat-card-anim flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center" :class="{ 'is-active': statsAnimated }" style="transition-delay: 0.3s;">
                <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">+{{ statsAnimated ? count8 : 8 }}</span>
                <span class="mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">سنوات من التميز والعطاء</span>
                <span class="mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">في تقديم الخدمات النفسية والأسرية</span>
              </div>

              <div class="stat-card-anim flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center" :class="{ 'is-active': statsAnimated }" style="transition-delay: 0.4s;">
                <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">{{ statsAnimated ? count100 : 100 }}%</span>
                <span class="mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">خصوصية وسرية تامة</span>
                <span class="mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">وفق ميثاق الشرف الأخلاقي والمهني</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <HomeServices />
    <HomeAbout />
    
    <!-- سكشن البرامج التدريبية المتخصصة -->
    <section id="training" aria-labelledby="training-title" class="training-section w-full py-16 sm:py-20 transition-colors duration-200">
      <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <!-- عنوان السكشن ووصفه في الوسط -->
        <div class="mx-auto max-w-2xl text-center">
          <h2 id="training-title" class="text-2xl font-extrabold sm:text-3xl md:text-4xl text-[#1a1a2e] dark:text-foreground">
            برامجنا التدريبية المتخصصة
          </h2>
          <p class="mt-3 text-sm sm:text-base leading-relaxed text-[#555555] dark:text-muted-foreground">
            برامج مصممة بعناية لمساعدتك في كل مرحلة من مراحل حياتك
          </p>
        </div>

        <!-- شبكة الكروت: 2 columns على الموبايل و 3 columns على desktop -->
        <div class="mt-8 sm:mt-12 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
          <article
            v-for="course in courses"
            :key="course.id"
            class="course-card flex flex-col justify-between"
          >
            <!-- 1. صورة في الأعلى تأخذ العرض الكامل وحواف علوية مستديرة فقط -->
            <div class="relative w-full h-[140px] sm:h-[200px] lg:h-[240px] overflow-hidden">
              <img
                :src="course.image"
                :alt="course.title"
                class="w-full h-full object-cover"
                style="object-fit: cover; border-top-left-radius: 16px; border-top-right-radius: 16px;"
                loading="lazy"
              />
            </div>

            <!-- 2. محتوى تحت الصورة داخل الكارد -->
            <div class="course-content flex flex-col flex-1 justify-between gap-2 sm:gap-4 p-3 sm:p-6">
              <div class="flex flex-col gap-2 sm:gap-3">
                <!-- باج صغير فوق العنوان: خلفية ماجنتا خفيفة مع نص ماجنتا -->
                <span class="course-badge self-start inline-flex items-center rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold">
                  {{ course.badge }}
                </span>

                <!-- عنوان الدورة: bold، كبير -->
                <h3 class="text-sm sm:text-xl lg:text-2xl font-bold text-[#1a1a2e] dark:text-foreground leading-snug">
                  {{ course.title }}
                </h3>

                <!-- وصف قصير: muted، 2-3 سطور -->
                <p class="text-[11px] sm:text-sm leading-relaxed text-[#555555] dark:text-muted-foreground line-clamp-2 sm:line-clamp-3">
                  {{ course.description }}
                </p>
              </div>

              <!-- خط فاصل -->
              <hr class="course-divider my-1 sm:my-2 border-0 h-px w-full" />

              <!-- زر احجز الآن في الأسفل في يمين الكارد (start في RTL) -->
              <div class="flex items-center justify-start pt-1">
                <!-- زر (filled، ماجنتا) -->
                <NuxtLink
                  :to="siteConfig.booking.basePath"
                  class="btn-filled-magenta inline-flex items-center justify-center rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold text-white transition-all cursor-pointer"
                >
                  احجز الآن
                </NuxtLink>
              </div>
            </div>
          </article>
        </div>

        <!-- زر استكشف جميع مساراتنا التدريبية -->
        <div style="text-align: center; margin-top: 40px;">
          <a
            href="#"
            class="explore-btn"
          >
            استكشف جميع مساراتنا التدريبية ←
          </a>
        </div>
      </div>
    </section>

    <HomeBookingChannels />
    <HomeFaq />
    <HomeContact />
  </div>
</template>

<style scoped>
/* ==========================================
   Hero Desktop & Mobile Responsive Styles
   ========================================== */
.hero-section {
  position: relative;
  overflow: hidden;
  --brand-bg: hsl(var(--background));
  --brand-text: hsl(var(--foreground));
  --brand-card: hsl(var(--card));
  --brand-border: hsl(var(--border));
  --brand-magenta: hsl(var(--primary));
}

.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: opacity 2s ease-in-out;
  will-change: opacity;
}

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
    display: flex !important;
    height: calc(100vh - 80px) !important;
    min-height: calc(100vh - 80px) !important;
    max-height: calc(100vh - 80px) !important;
  }

  .hero-mobile-view {
    display: none !important;
  }

  .desktop-hero-heading {
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  }

  .desktop-hero-subtext {
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
  }
}

/* ==========================================
   Hero Content Animations
   ========================================== */
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

.native-mobile-select {
  width: 100%;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  padding-left: 2.5rem;
  font-size: 0.9rem;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(136,136,136,0.7)' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: left 1rem center;
  background-size: 1.25rem;
  cursor: pointer;
}

.native-mobile-select option {
  background-color: var(--brand-card);
  color: var(--brand-text);
}

@media (prefers-reduced-motion: reduce) {
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

/* ==========================================
   Training Courses Section Styles
   ========================================== */
.training-section {
  --brand-card: hsl(var(--card));
  --brand-border: hsl(var(--border));
  --brand-magenta: hsl(var(--primary));
  direction: rtl;
  font-family: 'IBM Plex Sans Arabic', sans-serif;
}

.course-card {
  background-color: var(--brand-card);
  border: 1px solid var(--brand-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.course-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(233, 30, 140, 0.12);
}

.course-badge {
  background-color: rgba(233, 30, 140, 0.1);
  color: var(--brand-magenta);
}

:deep(.dark) .course-badge,
.dark .course-badge {
  background-color: rgba(233, 30, 140, 0.2);
  color: var(--brand-magenta);
}

.course-divider {
  background-color: var(--brand-border);
}

.btn-filled-magenta {
  background-color: var(--brand-magenta);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(233, 30, 140, 0.25);
}

.btn-filled-magenta:hover {
  opacity: 0.92;
  transform: scale(1.02);
}

.explore-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: 1.5px solid #E91E8C;
  color: #E91E8C;
  padding: 14px 32px;
  border-radius: 9999px;
  font-family: 'IBM Plex Sans Arabic', sans-serif;
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.explore-btn:hover {
  background-color: #E91E8C;
  color: #ffffff;
}
</style>
