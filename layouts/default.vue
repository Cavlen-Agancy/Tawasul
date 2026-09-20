<script setup lang="ts">
import { Menu as MenuIcon, X as XIcon, MapPin, Phone, Mail, Clock } from 'lucide-vue-next'
import { homeNavItems } from '~/lib/home-content'
import { siteConfig } from '~/lib/site'

const mobileMenuOpen = ref(false)
const showTextLogo = ref(false)
const route = useRoute()

const { isLoggedIn, user, logout } = useAuth()
const { email, phone, whatsappUrl } = useSiteSettings()

const isAuthPage = computed(() => {
  const p = route.path
  return p === '/login' || p === '/register' || p === '/forgot-password' || p === '/reset-password'
})

watch(() => route.fullPath, () => {
  mobileMenuOpen.value = false
})

useHead({
  htmlAttrs: { dir: 'rtl', lang: 'ar' },
  link: [
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossorigin: '',
    },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&display=swap',
    },
  ],
})

const year = 2026

const serviceFooterLinks = [
  { label: 'الاستشارات النفسية', href: '#services' },
  { label: 'الاستشارات الزوجية والأسرية', href: '#services' },
  { label: 'الاستشارات التربوية', href: '#services' },
  { label: 'التخاطب وعيوب النطق', href: '#services' },
  { label: 'تنمية المهارات', href: '#services' },
  { label: 'تعديل وتوجيه السلوك', href: '#services' },
]

async function handleLogout() {
  mobileMenuOpen.value = false
  await logout()
}
</script>

<template>
  <div
    dir="rtl"
    lang="ar"
    class="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary"
    :class="{ 'marketing-layout': !isAuthPage }"
  >
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
    >
      تخطَّ إلى المحتوى
    </a>

    <!-- Top Navigation Bar: Light mode white/95 with dark text; Dark mode dark with white text -->
    <header class="animate-navbar-slide-down sticky top-0 z-50 h-20 border-b border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-[#111116]/95 backdrop-blur-xl transition-colors duration-200">
      <div class="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <!-- Logo -->
        <NuxtLink to="/" class="flex shrink-0 items-center gap-3" aria-label="أكاديمية تواصل — الرئيسية">
          <img
            v-if="!showTextLogo"
            :src="siteConfig.brand.logoSrc"
            :alt="siteConfig.brand.nameAr"
            class="h-10 w-auto rounded-lg object-contain dark:brightness-110"
            loading="eager"
            @error="showTextLogo = true"
          >
          <div class="flex flex-col leading-none">
            <span class="text-base font-bold tracking-tight sm:text-lg text-[#1a1a2e] dark:text-white">
              {{ siteConfig.brand.nameAr }}
            </span>
            <span class="text-[10px] tracking-wider text-[#1a1a2e]/60 dark:text-white/60">
              TAWASUL ACADEMY
            </span>
          </div>
        </NuxtLink>

        <!-- Desktop Menu -->
        <nav class="hidden items-center gap-1 xl:gap-2 lg:flex" aria-label="التنقل الرئيسي">
          <NuxtLink
            v-for="link in homeNavItems"
            :key="link.href"
            :to="`/${link.href}`"
            class="rounded-full px-3.5 py-1.5 text-sm font-medium text-[#1a1a2e] dark:text-white/80 transition-colors duration-150 hover:text-primary"
            :class="link.href === '#hero' ? 'font-semibold text-primary dark:text-primary' : ''"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <!-- Actions -->
        <div class="hidden items-center gap-3 lg:flex">
          <ThemeToggle size="sm" />
          <template v-if="isLoggedIn">
            <Button
              variant="outline"
              size="sm"
              as="a"
              :href="user?.accountType === 'PATIENT' ? '/dashboard' : user?.accountType === 'DOCTOR' ? '/doctor' : '/admin'"
              class="rounded-full px-4"
            >
              لوحتي
            </Button>
            <Button variant="ghost" size="sm" class="rounded-full px-3 text-xs" @click="handleLogout">
              خروج
            </Button>
          </template>
          <template v-else>
            <Button
              size="sm"
              as="a"
              :href="siteConfig.booking.basePath"
              class="rounded-full bg-primary px-6 font-semibold text-white shadow-magenta transition-transform hover:bg-primary/90 active:scale-95"
            >
              تسجيل الآن
            </Button>
          </template>
        </div>

        <!-- Mobile Controls -->
        <div class="flex items-center gap-2 lg:hidden">
          <ThemeToggle size="sm" />
          <Button
            size="sm"
            as="a"
            :href="siteConfig.booking.basePath"
            class="rounded-full bg-primary px-4 text-xs font-semibold text-white shadow-magenta"
          >
            تسجيل الآن
          </Button>
          <button
            class="flex h-10 w-10 items-center justify-center rounded-2xl text-[#1a1a2e] dark:text-white transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            :aria-expanded="mobileMenuOpen"
            aria-label="القائمة"
            aria-controls="mobile-nav"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <MenuIcon v-if="!mobileMenuOpen" class="size-5" />
            <XIcon v-else class="size-5" />
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="-translate-y-2 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="-translate-y-2 opacity-0"
      >
        <nav
          v-if="mobileMenuOpen"
          id="mobile-nav"
          class="flex flex-col border-t border-black/[0.08] dark:border-border/40 bg-white/95 dark:bg-background/95 px-5 py-5 backdrop-blur-xl lg:hidden"
          aria-label="تنقل الجوال"
        >
          <NuxtLink
            v-for="link in homeNavItems"
            :key="link.href"
            :to="`/${link.href}`"
            class="min-h-[2.75rem] rounded-xl px-3 py-2 text-base font-medium text-[#1a1a2e] dark:text-muted-foreground transition-colors hover:text-primary"
            :class="link.href === '#hero' ? 'font-bold text-primary' : ''"
            @click="mobileMenuOpen = false"
          >
            {{ link.label }}
          </NuxtLink>
          <div class="mt-4 flex flex-col gap-2.5 border-t border-black/[0.08] dark:border-border/40 pt-4">
            <template v-if="isLoggedIn">
              <Button variant="outline" as="a" href="/dashboard" class="w-full rounded-full" @click="mobileMenuOpen = false">
                لوحة التحكم
              </Button>
              <Button variant="ghost" class="w-full rounded-full" @click="handleLogout">
                تسجيل الخروج
              </Button>
            </template>
            <template v-else>
              <Button variant="outline" as="a" :href="siteConfig.auth.loginPath" class="w-full rounded-full" @click="mobileMenuOpen = false">
                تسجيل الدخول
              </Button>
            </template>
            <Button as="a" :href="siteConfig.booking.basePath" class="w-full rounded-full bg-primary font-bold text-white shadow-magenta" @click="mobileMenuOpen = false">
              تسجيل الآن
            </Button>
          </div>
        </nav>
      </Transition>
    </header>

    <main id="main-content" class="flex-1">
      <slot />
    </main>

    <!-- Professional Footer (Hidden on auth pages) -->
    <footer v-if="!isAuthPage" class="border-t border-white/[0.08] bg-[#0a0a0f] text-white">
      <!-- ============================================================= -->
      <!-- 1. DESKTOP FOOTER (min-width: 769px) — 4 COLUMNS UNTOUCHED    -->
      <!-- ============================================================= -->
      <div class="hidden md:block mx-auto w-full max-w-7xl px-6 lg:px-8 pt-16 pb-8">
        <div class="grid grid-cols-12 gap-10">
          <!-- Column 1: Logo, Slogan, About & Social Media (4 cols) -->
          <div class="flex flex-col items-start text-start col-span-4">
            <div class="flex items-center gap-3">
              <img
                v-if="!showTextLogo"
                :src="siteConfig.brand.logoSrc"
                :alt="siteConfig.brand.nameAr"
                class="h-9 w-auto rounded-lg object-contain brightness-110"
                loading="lazy"
                @error="showTextLogo = true"
              >
              <div class="flex flex-col leading-none">
                <span class="text-lg font-bold tracking-tight text-white">{{ siteConfig.brand.nameAr }}</span>
                <span class="text-[10px] tracking-wider text-white/50">TAWASUL ACADEMY</span>
              </div>
            </div>

            <p class="mt-3 text-xs font-bold text-[#e91e8c]">
              نتواصل... نفهم... نساند
            </p>

            <p class="mt-3 text-xs leading-relaxed text-white/65 max-w-sm">
              أكاديمية تواصل منصة رائدة متخصصة في تقديم الاستشارات النفسية والتربوية والأسرية وخدمات التخاطب وفق أعلى معايير الجودة والسرية التامة.
            </p>

            <!-- Social Media Icons -->
            <div class="mt-5 flex items-center gap-2.5" aria-label="وسائل التواصل الاجتماعي">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-[#e91e8c] hover:bg-[#e91e8c] hover:text-white"
              >
                <svg class="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>

              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-[#e91e8c] hover:bg-[#e91e8c] hover:text-white"
              >
                <svg class="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>

              <a
                :href="whatsappUrl || 'https://wa.me/201234567890'"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-[#e91e8c] hover:bg-[#e91e8c] hover:text-white"
              >
                <svg class="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564c.173.087.289.129.332.202.043.073.043.423-.101.828zM12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.396C8.423 21.499 10.155 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                </svg>
              </a>

              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-[#e91e8c] hover:bg-[#e91e8c] hover:text-white"
              >
                <svg class="size-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          <!-- Column 2: روابط سريعة (2 cols) -->
          <div class="flex flex-col items-start text-start col-span-2">
            <h3 class="text-sm font-bold text-white tracking-wide">روابط سريعة</h3>
            <ul class="mt-4 flex flex-col gap-2.5">
              <li v-for="link in homeNavItems" :key="link.href">
                <NuxtLink
                  :to="`/${link.href}`"
                  class="text-xs sm:text-sm text-white/65 transition-colors duration-200 hover:text-[#e91e8c]"
                >
                  {{ link.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <!-- Column 3: خدماتنا (3 cols) -->
          <div class="flex flex-col items-start text-start col-span-3">
            <h3 class="text-sm font-bold text-white tracking-wide">خدماتنا</h3>
            <ul class="mt-4 flex flex-col gap-2.5">
              <li v-for="item in serviceFooterLinks" :key="item.label">
                <a
                  :href="item.href"
                  class="text-xs sm:text-sm text-white/65 transition-colors duration-200 hover:text-[#e91e8c]"
                >
                  {{ item.label }}
                </a>
              </li>
            </ul>
          </div>

          <!-- Column 4: تواصل معنا (3 cols) -->
          <div class="flex flex-col items-start text-start col-span-3">
            <h3 class="text-sm font-bold text-white tracking-wide">تواصل معنا</h3>
            <ul class="mt-4 flex flex-col gap-3 text-xs sm:text-sm text-white/65">
              <li class="flex items-start gap-2.5">
                <MapPin class="size-4 shrink-0 text-[#e91e8c] mt-0.5" aria-hidden="true" />
                <span>جمهورية مصر العربية — القاهرة</span>
              </li>

              <li class="flex items-center gap-2.5">
                <Phone class="size-4 shrink-0 text-[#e91e8c]" aria-hidden="true" />
                <a :href="`tel:${phone || '+201234567890'}`" dir="ltr" class="tnum transition-colors hover:text-[#e91e8c]">
                  {{ phone || '+201234567890' }}
                </a>
              </li>

              <li class="flex items-center gap-2.5">
                <Mail class="size-4 shrink-0 text-[#e91e8c]" aria-hidden="true" />
                <a :href="`mailto:${email || 'admin@tawasul.com'}`" dir="ltr" class="tnum transition-colors hover:text-[#e91e8c]">
                  {{ email || 'admin@tawasul.com' }}
                </a>
              </li>

              <li class="flex items-start gap-2.5">
                <Clock class="size-4 shrink-0 text-[#e91e8c] mt-0.5" aria-hidden="true" />
                <span>السبت - الخميس (١٠ ص حتى ١٠ م)</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Bottom Bar Desktop -->
        <div class="mt-12 flex items-center justify-between border-t border-white/[0.08] pt-6 text-xs text-white/50">
          <p>© {{ year }} أكاديمية تواصل (Tawasul Academy) — جميع الحقوق محفوظة.</p>
          <div class="flex items-center gap-4 text-white/60">
            <a href="#about" class="transition-colors hover:text-[#e91e8c]">سياسة الخصوصية والسرية</a>
            <span aria-hidden="true" class="text-white/30">·</span>
            <a href="#about" class="transition-colors hover:text-[#e91e8c]">ميثاق الشرف الأخلاقي</a>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- 2. MOBILE FOOTER (max-width: 768px) — PRO UI/UX REDESIGN      -->
      <!-- ============================================================= -->
      <div class="block md:hidden w-full px-5 py-6 text-center">
        <!-- 1. Logo & Brand Section -->
        <div class="flex flex-col items-center pb-6 border-b border-white/[0.08]">
          <div class="flex items-center gap-2.5">
            <img
              v-if="!showTextLogo"
              :src="siteConfig.brand.logoSrc"
              :alt="siteConfig.brand.nameAr"
              class="h-10 w-auto rounded-lg object-contain brightness-110"
              loading="lazy"
              @error="showTextLogo = true"
            >
            <div class="flex flex-col leading-none text-start">
              <span class="text-lg font-extrabold text-white tracking-tight">{{ siteConfig.brand.nameAr }}</span>
              <span class="text-[10px] text-white/50 tracking-wider">TAWASUL ACADEMY</span>
            </div>
          </div>

          <!-- Tagline in pink, centered -->
          <p class="mt-2.5 text-xs font-bold text-[#e91e8c]">
            نتواصل... نفهم... نساند
          </p>

          <!-- Description text: max 2 lines, centered, color: rgba(255,255,255,0.6), font-size: 0.8rem -->
          <p class="mt-2 text-[0.8rem] leading-relaxed text-white/60 max-w-xs line-clamp-2">
            منصة رائدة متخصصة في تقديم الاستشارات النفسية والتربوية والأسرية وخدمات التخاطب بأعلى معايير الجودة والسرية.
          </p>

          <!-- Social icons: evenly spaced, each icon in a subtle dark circle (40x40px), hover: pink background -->
          <div class="mt-5 flex items-center justify-center gap-3.5">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-[#e91e8c] hover:bg-[#e91e8c] hover:text-white active:scale-95"
            >
              <svg class="size-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
              </svg>
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-[#e91e8c] hover:bg-[#e91e8c] hover:text-white active:scale-95"
            >
              <svg class="size-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a
              :href="whatsappUrl || 'https://wa.me/201234567890'"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-[#e91e8c] hover:bg-[#e91e8c] hover:text-white active:scale-95"
            >
              <svg class="size-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564c.173.087.289.129.332.202.043.073.043.423-.101.828zM12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.985-1.396C8.423 21.499 10.155 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
              </svg>
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-[#e91e8c] hover:bg-[#e91e8c] hover:text-white active:scale-95"
            >
              <svg class="size-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
        </div>

        <!-- 2. Navigation Grid — Two Columns Side-by-Side (py-6 border-b border-white/[0.08]) -->
        <div class="py-6 border-b border-white/[0.08] grid grid-cols-2 gap-4 text-start">
          <!-- Right Column: روابط سريعة -->
          <div>
            <h4 class="text-[0.95rem] font-bold text-white mb-3 tracking-[0.05em] pe-2 border-r-[3px] border-[#e91e8c]">
              روابط سريعة
            </h4>
            <ul class="flex flex-col">
              <li v-for="link in homeNavItems" :key="link.href" class="min-h-[44px] flex items-center">
                <NuxtLink
                  :to="`/${link.href}`"
                  class="text-[0.82rem] text-white/60 hover:text-[#e91e8c] transition-colors leading-[2.2] py-1"
                >
                  {{ link.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <!-- Left Column: خدماتنا -->
          <div>
            <h4 class="text-[0.95rem] font-bold text-white mb-3 tracking-[0.05em] pe-2 border-r-[3px] border-[#e91e8c]">
              خدماتنا
            </h4>
            <ul class="flex flex-col">
              <li v-for="item in serviceFooterLinks" :key="item.label" class="min-h-[44px] flex items-center">
                <a
                  :href="item.href"
                  class="text-[0.82rem] text-white/60 hover:text-[#e91e8c] transition-colors leading-[2.2] py-1"
                >
                  {{ item.label }}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <!-- 3. Contact Section (Right-aligned rows with icons) -->
        <div class="py-6 border-b border-white/[0.08] text-start">
          <h4 class="text-[0.95rem] font-bold text-white mb-4 tracking-[0.05em] pe-2 border-r-[3px] border-[#e91e8c]">
            تواصل معنا
          </h4>
          <ul class="flex flex-col gap-3 text-[0.82rem]">
            <li class="min-h-[44px] flex items-center text-white/75">
              <MapPin class="size-4 shrink-0 text-[#e91e8c] ms-2.5" />
              <span>جمهورية مصر العربية — القاهرة</span>
            </li>
            <li class="min-h-[44px] flex items-center">
              <Phone class="size-4 shrink-0 text-[#e91e8c] ms-2.5" />
              <a :href="`tel:${phone || '+201234567890'}`" dir="ltr" class="tnum text-white/75 hover:text-[#e91e8c] transition-colors">
                {{ phone || '+201234567890' }}
              </a>
            </li>
            <li class="min-h-[44px] flex items-center">
              <Mail class="size-4 shrink-0 text-[#e91e8c] ms-2.5" />
              <a :href="`mailto:${email || 'admin@tawasul.com'}`" dir="ltr" class="tnum text-white/75 hover:text-[#e91e8c] transition-colors">
                {{ email || 'admin@tawasul.com' }}
              </a>
            </li>
            <li class="min-h-[44px] flex items-center text-white/75">
              <Clock class="size-4 shrink-0 text-[#e91e8c] ms-2.5" />
              <span>السبت - الخميس (١٠ ص حتى ١٠ م)</span>
            </li>
          </ul>
        </div>

        <!-- 4. Bottom Bar -->
        <div class="pt-5 flex flex-col items-center gap-2.5 text-center">
          <p class="text-[0.72rem] text-white/40">
            © {{ year }} أكاديمية تواصل (Tawasul Academy) — جميع الحقوق محفوظة.
          </p>
          <div class="flex items-center justify-center gap-4 min-h-[44px]">
            <a href="#about" class="text-[0.75rem] text-white/60 hover:text-[#e91e8c] transition-colors py-2 px-1">
              سياسة الخصوصية والسرية
            </a>
            <span class="text-white/30" aria-hidden="true">·</span>
            <a href="#about" class="text-[0.75rem] text-white/60 hover:text-[#e91e8c] transition-colors py-2 px-1">
              ميثاق الشرف الأخلاقي
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.marketing-layout {
  font-family: 'Almarai', sans-serif;
}

@keyframes navbarSlideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-navbar-slide-down {
  animation: navbarSlideDown 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .animate-navbar-slide-down {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
</style>
