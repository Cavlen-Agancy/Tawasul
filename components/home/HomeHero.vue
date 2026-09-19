<script setup lang="ts">
import { ArrowLeft, ChevronDown } from 'lucide-vue-next'
import { trustMetrics, quickConsultServices } from '~/lib/home-content'
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
    <!-- EXACT MATCH TO IMAGE 1 SCREENSHOT                                  -->
    <!-- Centered hero with /hero.png full background, pill search bar,     -->
    <!-- and 4-column trust metrics card                                    -->
    <!-- ================================================================= -->
    <div
      class="hero-desktop-view relative w-full bg-cover bg-center bg-no-repeat pt-12 pb-20"
      style="background-image: url('/hero.png');"
    >
      <!-- Dark overlay to ensure contrast and match Image 1 -->
      <div class="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#111116]" aria-hidden="true" />

      <!-- Center content -->
      <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        <!-- Top Pill Badge -->
        <div class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-1.5 text-xs font-medium text-white shadow-soft backdrop-blur-md">
          <span class="h-2 w-2 rounded-full bg-[#e91e8c]" aria-hidden="true" />
          <span>أكاديمية تواصل — بجمهورية مصر العربية</span>
        </div>

        <!-- Main Headline -->
        <h1 class="mt-7 text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-white leading-[1.15]">
          <span>نتواصل </span>
          <span class="relative inline-block text-[#e91e8c]">
            نفهم
          </span>
          <span> نساند</span>
        </h1>

        <!-- Subtitle -->
        <p class="mt-5 max-w-2xl text-base lg:text-lg leading-relaxed text-white/80">
          نساعدك على استعادة التوازن النفسي والأسري من خلال جلسات استشارية وعلاجية مبنية على أسس علمية رصينة، مع نخبة من الاستشاريين والأخصائيين المعتمدين.
        </p>

        <!-- Search / Quick Booking Pill Bar -->
        <div class="mt-9 w-full max-w-4xl rounded-full border border-white/15 bg-[#171720]/85 p-2 shadow-medium backdrop-blur-xl">
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

            <!-- Submit Button -->
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
        <div class="mt-4 flex items-center justify-center gap-2 text-xs text-white/70">
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

        <!-- Trust Metrics 4 Columns Card matching Image 1 -->
        <div class="mt-12 w-full max-w-5xl rounded-3xl border border-white/10 bg-[#171720]/80 p-6 sm:p-8 backdrop-blur-md">
          <dl class="grid grid-cols-4 gap-4 divide-x divide-x-reverse divide-white/10">
            <div
              v-for="(m, idx) in trustMetrics"
              :key="m.title"
              class="flex flex-col items-center text-center"
              :class="idx > 0 ? 'pe-4' : ''"
            >
              <dd class="tnum text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {{ m.value }}
              </dd>
              <dt class="mt-2 text-sm font-bold text-white">
                {{ m.title }}
              </dt>
              <p class="mt-1 text-xs text-white/60 leading-snug">
                {{ m.sub }}
              </p>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 2. MOBILE HERO LAYOUT (@media max-width: 768px)                   -->
    <!-- Top card with /hero.png background + vertical stack                -->
    <!-- 3 stat cards in one row without horizontal scroll                  -->
    <!-- ================================================================= -->
    <div class="hero-mobile-view w-full bg-[#121218] px-3.5 py-4">
      <div class="mx-auto w-full max-w-[420px] flex flex-col gap-3.5">
        <!-- 1. Top Card with Background Image & Gradient Overlay -->
        <div class="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#161620] shadow-lg">
          <!-- Background Image covering top portion -->
          <div class="relative h-64 w-full overflow-hidden">
            <img
              src="/hero.png"
              alt="أكاديمية تواصل — جلسة استشارية"
              class="h-full w-full object-cover object-[center_20%]"
              loading="eager"
            >
            <!-- Gradient overlay at bottom for smooth blending into dark text area -->
            <div class="absolute inset-0 bg-gradient-to-b from-black/25 via-black/40 to-[#161620]" />
          </div>

          <!-- Content inside top card -->
          <div class="relative -mt-20 px-4 pb-6 pt-2 text-center">
            <!-- Top badge with pink dot -->
            <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3.5 py-1 text-[11px] font-medium text-white shadow-soft backdrop-blur-md">
              <span class="h-2 w-2 rounded-full bg-[#e91e8c]" aria-hidden="true" />
              <span>أكاديمية تواصل — جمهورية مصر العربية</span>
            </div>

            <!-- Main Heading -->
            <h1 class="mt-3.5 text-3xl font-extrabold tracking-tight text-white leading-tight">
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
            <p class="mt-2.5 text-xs leading-relaxed text-white/75 max-w-sm mx-auto">
              نساعدك على استعادة التوازن النفسي والأسري بجلسات استشارية وعلاجية مبنية على أسس علمية رصينة.
            </p>
          </div>
        </div>

        <!-- 2. Form Section Card -->
        <div class="rounded-[26px] border border-white/10 bg-[#171722] p-4 shadow-xl">
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
        <div class="flex flex-col gap-2 pt-1">
          <!-- Header row -->
          <div class="flex items-center justify-between px-1 text-xs">
            <span class="font-bold text-[#e91e8c]">أرقام نفخر بها</span>
            <span class="text-[11px] text-white/50">اسحب لليمين واليسار ←</span>
          </div>

          <!-- 3 cards in one row (no horizontal scroll) -->
          <div class="grid grid-cols-3 gap-2" role="region" aria-label="أرقام وإحصائيات">
            <!-- Card 1: 500+ جلسة ناجحة -->
            <div class="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center">
              <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">500+</span>
              <span class="mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">جلسة ناجحة</span>
              <span class="mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">نتائج إيجابية مستدامة</span>
            </div>

            <!-- Card 2: 50+ استشاري معتمد -->
            <div class="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center">
              <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">50+</span>
              <span class="mt-1 text-[11px] sm:text-xs font-bold text-white leading-tight">استشاري معتمد</span>
              <span class="mt-1 text-[9px] sm:text-[10px] leading-tight text-white/55">أطباء ذوو خبرة</span>
            </div>

            <!-- Card 3: 3+ خبرة -->
            <div class="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#171722] p-2.5 sm:p-3.5 text-center">
              <span class="tnum text-xl sm:text-2xl font-extrabold text-[#e91e8c]">3+</span>
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
</style>
