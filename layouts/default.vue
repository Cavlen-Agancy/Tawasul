<script setup lang="ts">
import { Menu as MenuIcon, X as XIcon } from 'lucide-vue-next'
import { homeNavItems } from '~/lib/home-content'
import { siteConfig } from '~/lib/site'

const mobileMenuOpen = ref(false)
const showTextLogo = ref(false)
const route = useRoute()

const { isLoggedIn, user, logout } = useAuth()

watch(() => route.fullPath, () => {
  mobileMenuOpen.value = false
})

useHead({
  htmlAttrs: { dir: 'rtl', lang: 'ar' },
})

const year = new Date().getFullYear()

async function handleLogout() {
  mobileMenuOpen.value = false
  await logout()
}
</script>

<template>
  <div dir="rtl" lang="ar" class="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
    >
      تخطَّ إلى المحتوى
    </a>

    <!-- Top Navigation Bar -->
    <header class="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-xl">
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
            <span class="text-base font-bold tracking-tight sm:text-lg">
              {{ siteConfig.brand.nameAr }}
            </span>
            <span class="text-[10px] tracking-wider text-muted-foreground">
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
            class="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-primary"
            :class="link.href === '#hero' ? 'font-semibold text-primary' : ''"
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
            class="flex h-10 w-10 items-center justify-center rounded-2xl text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          class="flex flex-col border-t border-border/40 bg-background/95 px-5 py-5 backdrop-blur-xl lg:hidden"
          aria-label="تنقل الجوال"
        >
          <NuxtLink
            v-for="link in homeNavItems"
            :key="link.href"
            :to="`/${link.href}`"
            class="min-h-[2.75rem] rounded-xl px-3 py-2 text-base font-medium text-muted-foreground transition-colors hover:text-primary"
            :class="link.href === '#hero' ? 'font-bold text-primary' : ''"
            @click="mobileMenuOpen = false"
          >
            {{ link.label }}
          </NuxtLink>
          <div class="mt-4 flex flex-col gap-2.5 border-t border-border/40 pt-4">
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

    <!-- Footer matching Image 1 -->
    <footer class="border-t border-border/40 bg-card/60 backdrop-blur-md">
      <div class="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div class="flex flex-col items-center justify-between gap-6 md:flex-row">
          <!-- Logo & Slogan -->
          <div class="flex flex-col items-center gap-1.5 md:items-start">
            <div class="flex items-center gap-2.5">
              <img
                v-if="!showTextLogo"
                :src="siteConfig.brand.logoSrc"
                :alt="siteConfig.brand.nameAr"
                class="h-8 w-auto rounded-lg object-contain dark:brightness-110"
                loading="lazy"
                @error="showTextLogo = true"
              >
              <span class="text-lg font-bold tracking-tight">{{ siteConfig.brand.nameAr }}</span>
            </div>
            <p class="text-xs font-medium text-primary">
              نتواصل... نفهم... نساند
            </p>
          </div>

          <!-- Nav links -->
          <nav aria-label="روابط سريعة" class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground">
            <NuxtLink
              v-for="link in homeNavItems"
              :key="link.href"
              :to="`/${link.href}`"
              class="transition-colors hover:text-primary"
            >
              {{ link.label }}
            </NuxtLink>
          </nav>
        </div>

        <!-- Bottom Copyright & Policies -->
        <div class="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/30 pt-6 text-center text-xs text-muted-foreground md:flex-row md:text-start">
          <p>© <span class="tnum">{{ year }}</span> {{ siteConfig.brand.nameAr }} (Tawasul Academy) — جميع الحقوق محفوظة.</p>
          <div class="flex items-center gap-4 text-xs text-muted-foreground/80">
            <a href="#about" class="transition-colors hover:text-primary">سياسة الخصوصية والسرية</a>
            <span aria-hidden="true">·</span>
            <a href="#about" class="transition-colors hover:text-primary">ميثاق الشرف الأخلاقي</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
