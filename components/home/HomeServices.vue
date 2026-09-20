<script setup lang="ts">
import {
  Heart, Users, HeartHandshake, MessageSquare, Brain, Sparkles, ArrowLeft, ArrowUpRight, GraduationCap, Compass,
} from 'lucide-vue-next'
import { homeServices, institutionalSolutions } from '~/lib/home-content'
import { siteConfig } from '~/lib/site'

const activeTab = ref<'individual' | 'corporate'>('individual')

const iconMap: Record<string, unknown> = {
  heart: Heart,
  users: Users,
  handshake: HeartHandshake,
  speech: MessageSquare,
  brain: Brain,
  sparkles: Sparkles,
}

// Mobile specific 6 cards list matching the user prompt
const mobileServices = [
  {
    title: 'الاستشارات التربوية',
    description: 'إرساء تربية قيمة لتحديات الطفولة وبناء المراهقة',
    icon: GraduationCap,
  },
  {
    title: 'الاستشارات النفسية',
    description: 'دعم متخصص للاكتئاب، القلق، وتوابع الفقد والصدمات',
    icon: Heart,
  },
  {
    title: 'التخاطب وعيوب النطق والكلام',
    description: 'علاج أمناء النطاق، وتأخر الكلام لجميع الأعمار',
    icon: MessageSquare,
  },
  {
    title: 'الاستشارات الزوجية والأسرية',
    description: 'إعادة جسور التفاهم وحل الخلافات الأسرية العالقة',
    icon: HeartHandshake,
  },
  {
    title: 'تنمية المهارات والقدرات',
    description: 'تمارين تحفيز بصري وإدراكي لتقوية التركيز والذاكرة',
    icon: Sparkles,
  },
  {
    title: 'تعديل وتوجيه السلوك',
    description: 'خطط علاجية لفرط الحركة وتشتت الانتباه والعصبية',
    icon: Compass,
  },
]

// Scroll-triggered staggered reveal via IntersectionObserver
const desktopGridRef = ref<HTMLElement | null>(null)
const mobileGridRef = ref<HTMLElement | null>(null)
const isServicesVisible = ref(false)

onMounted(() => {
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isServicesVisible.value = true
            observer.disconnect()
          }
        })
      },
      { threshold: 0.1 }
    )
    if (desktopGridRef.value) observer.observe(desktopGridRef.value)
    if (mobileGridRef.value) observer.observe(mobileGridRef.value)
  } else {
    isServicesVisible.value = true
  }
})
</script>

<template>
  <section id="services" aria-labelledby="services-title" class="w-full">
    <!-- ================================================================= -->
    <!-- 1. DESKTOP SERVICES LAYOUT (@media min-width: 769px)              -->
    <!-- UNTOUCHED DESKTOP DESIGN WITH INTENTIONAL LIGHT/DARK MODE         -->
    <!-- ================================================================= -->
    <div class="services-desktop-view mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 bg-[#f8f8fc] dark:bg-transparent transition-colors duration-200">
      <!-- Header -->
      <div class="mx-auto max-w-2xl text-center">
        <p class="text-xs font-bold uppercase tracking-wider text-primary">الرعاية المتخصصة</p>
        <h2 id="services-title" class="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl text-[#1a1a2e] dark:text-foreground">
          خدماتنا الاستشارية والعلاجية
        </h2>
        <p class="mt-4 text-sm leading-relaxed text-[#555555] dark:text-muted-foreground sm:text-base">
          حلول مرئية متكاملة ومدروسة يقدمها نخبة من الأطباء والخبراء المعتمدين لمساعدتك في مختلف جوانب حياتك.
        </p>

        <!-- Category Filter Pills -->
        <div class="mt-8 inline-flex items-center rounded-full border border-black/[0.08] dark:border-border/70 bg-white dark:bg-card/60 p-1 backdrop-blur-md shadow-sm">
          <button
            type="button"
            class="rounded-full px-5 py-2 text-xs font-bold transition-all duration-200 cursor-pointer"
            :class="activeTab === 'individual' ? 'bg-primary text-white shadow-magenta' : 'text-[#555] dark:text-muted-foreground hover:text-[#1a1a2e] dark:hover:text-foreground'"
            @click="activeTab = 'individual'"
          >
            استشارات الأفراد والأسرة
          </button>
          <button
            type="button"
            class="rounded-full px-5 py-2 text-xs font-bold transition-all duration-200 cursor-pointer"
            :class="activeTab === 'corporate' ? 'bg-primary text-white shadow-magenta' : 'text-[#555] dark:text-muted-foreground hover:text-[#1a1a2e] dark:hover:text-foreground'"
            @click="activeTab = 'corporate'"
          >
            حلول المؤسسات وبيئات العمل
          </button>
        </div>
      </div>

      <!-- 6 Cards Grid with staggered scroll reveal -->
      <div
        ref="desktopGridRef"
        v-show="activeTab === 'individual'"
        class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="(service, index) in homeServices"
          :key="service.key"
          class="service-card-anim group relative flex flex-col justify-between rounded-3xl border border-black/[0.08] dark:border-border/70 bg-white dark:bg-card/70 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-soft backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-magenta"
          :class="{ 'is-visible': isServicesVisible }"
          :style="{ transitionDelay: `${index * 0.08}s` }"
        >
          <!-- Top bar: Category Badge + Icon (with pulse on hover) -->
          <div class="flex items-center justify-between">
            <span class="rounded-full border border-black/[0.06] dark:border-border/70 bg-black/5 dark:bg-muted/60 px-3 py-1 text-[11px] font-semibold text-[#555] dark:text-muted-foreground">
              {{ service.category }}
            </span>
            <span class="service-icon-badge flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-white" aria-hidden="true">
              <Component :is="iconMap[service.icon]" class="size-5" />
            </span>
          </div>

          <!-- Body -->
          <div class="mt-5 flex-1">
            <h3 class="text-lg font-bold text-[#1a1a2e] dark:text-foreground transition-colors group-hover:text-primary">
              {{ service.title }}
            </h3>
            <p class="mt-2.5 text-xs leading-6 text-[#555555] dark:text-muted-foreground">
              {{ service.description }}
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="mt-6 grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              as="a"
              :href="siteConfig.booking.inPersonPath"
              class="rounded-full border-black/[0.12] dark:border-border/80 text-xs font-semibold text-[#1a1a2e] dark:text-foreground hover:border-primary hover:text-primary"
            >
              احجز حضوري
            </Button>
            <Button
              size="sm"
              as="a"
              :href="siteConfig.booking.onlinePath"
              class="rounded-full border border-primary/40 bg-primary/15 text-xs font-semibold text-primary hover:bg-primary hover:text-white"
            >
              احجز أونلاين
            </Button>
          </div>
        </div>
      </div>

      <!-- Corporate tab preview if switched -->
      <div v-show="activeTab === 'corporate'" class="mt-12 rounded-3xl border border-black/[0.08] dark:border-border/70 bg-white dark:bg-card/70 p-8 text-center backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none">
        <h3 class="text-xl font-bold text-[#1a1a2e] dark:text-white">{{ institutionalSolutions.title }}</h3>
        <p class="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#555555] dark:text-muted-foreground">{{ institutionalSolutions.description }}</p>
        <Button as="a" href="#contact" class="mt-6 rounded-full bg-primary px-8 font-bold text-white shadow-magenta">
          {{ institutionalSolutions.cta }}
        </Button>
      </div>

      <!-- Institutional Solutions Banner -->
      <div class="mt-10 overflow-hidden rounded-3xl border border-black/[0.08] dark:border-border/70 bg-white dark:bg-card/60 p-6 sm:p-8 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none">
        <div class="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div class="flex-1">
            <p class="text-xs font-bold text-primary">{{ institutionalSolutions.tag }}</p>
            <h3 class="mt-1 text-lg font-bold sm:text-xl text-[#1a1a2e] dark:text-foreground">
              {{ institutionalSolutions.title }}
            </h3>
            <p class="mt-2 max-w-2xl text-xs sm:text-sm leading-6 text-[#555555] dark:text-muted-foreground">
              {{ institutionalSolutions.description }}
            </p>
          </div>
          <Button
            variant="outline"
            as="a"
            href="#contact"
            class="rounded-full border-black/[0.12] dark:border-border/80 px-6 text-xs font-semibold text-[#1a1a2e] dark:text-foreground hover:border-primary hover:text-primary shrink-0"
          >
            <span>{{ institutionalSolutions.cta }}</span>
            <ArrowLeft class="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 2. MOBILE SERVICES LAYOUT (@media max-width: 768px)               -->
    <!-- 2-COLUMN GRID MATCHING MOBILE DESIGN WITH INTENTIONAL LIGHT/DARK  -->
    <!-- ================================================================= -->
    <div class="services-mobile-view w-full bg-[#f8f8fc] dark:bg-[#121218] px-3.5 py-8 transition-colors duration-200">
      <div class="mx-auto w-full max-w-[420px] flex flex-col gap-5">
        <!-- Section Header -->
        <div class="text-center">
          <p class="text-xs font-bold text-[#e91e8c]">
            تخصصاتنا الإكلينيكية
          </p>
          <h2 class="mt-2 text-2xl font-extrabold text-[#1a1a2e] dark:text-white tracking-tight">
            خدماتنا الاستشارية والعلاجية
          </h2>
          <p class="mt-2 text-xs leading-relaxed text-[#555555] dark:text-white/70 max-w-xs mx-auto">
            مسارات متكاملة مصممة لتلائم احتياجك بأعلى معايير الرعاية
          </p>
        </div>

        <!-- 2-Column Grid (6 Cards: 2x3) with staggered entrance -->
        <div ref="mobileGridRef" class="grid grid-cols-2 gap-2.5">
          <NuxtLink
            v-for="(card, index) in mobileServices"
            :key="card.title"
            :to="siteConfig.booking.basePath"
            class="service-card-anim group relative flex flex-col justify-between rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#1a1a28] p-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-sm transition-all duration-200 active:scale-[0.98] hover:border-[#e91e8c]/50"
            :class="{ 'is-visible': isServicesVisible }"
            :style="{ transitionDelay: `${index * 0.07}s` }"
          >
            <!-- Top: Pink icon + top-right arrow -->
            <div class="flex items-start justify-between">
              <span class="service-icon-badge flex h-9 w-9 items-center justify-center rounded-xl bg-[#e91e8c]/15 text-[#e91e8c] transition-all" aria-hidden="true">
                <Component :is="card.icon" class="size-4" />
              </span>
              <span class="text-black/30 dark:text-white/40 group-hover:text-[#e91e8c] transition-colors" aria-hidden="true">
                <ArrowUpRight class="size-4" />
              </span>
            </div>

            <!-- Body: Title + Gray Description -->
            <div class="mt-3 flex-1 flex flex-col">
              <h3 class="text-xs font-bold text-[#1a1a2e] dark:text-white leading-snug group-hover:text-[#e91e8c] transition-colors">
                {{ card.title }}
              </h3>
              <p class="mt-1 text-[10px] leading-relaxed text-[#555555] dark:text-white/60">
                {{ card.description }}
              </p>
            </div>
          </NuxtLink>
        </div>

        <!-- Full-width pink CTA button at the bottom -->
        <NuxtLink
          :to="siteConfig.booking.basePath"
          class="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#e91e8c] px-6 text-sm font-bold text-white shadow-magenta transition-transform hover:bg-[#d8157e] active:scale-[0.98]"
        >
          <span>احجز استشارتك الان</span>
          <ArrowLeft class="size-4" aria-hidden="true" />
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Staggered card fade in + slide up */
.service-card-anim {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.service-card-anim.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Subtle pink glow pulse on card icon on hover */
.service-card-anim:hover .service-icon-badge {
  animation: pinkIconPulse 1.5s ease-in-out infinite;
}

@keyframes pinkIconPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(233, 30, 140, 0.45);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(233, 30, 140, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(233, 30, 140, 0);
  }
}

/* Strict CSS media query separation */
@media (max-width: 768px) {
  .services-desktop-view {
    display: none !important;
  }
  .services-mobile-view {
    display: block !important;
  }
}

@media (min-width: 769px) {
  .services-desktop-view {
    display: block !important;
  }
  .services-mobile-view {
    display: none !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .service-card-anim {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .service-card-anim:hover .service-icon-badge {
    animation: none !important;
  }
}
</style>
