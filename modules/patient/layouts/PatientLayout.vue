<script setup lang="ts">
import {
  CalendarDays,
  CreditCard,
  LogOut,
  Menu as MenuIcon,
  User,
} from 'lucide-vue-next'

// Patient panel is English-only → force LTR, overriding global RTL
useHead({
  htmlAttrs: { dir: 'ltr', lang: 'en' },
})

const { logout, user } = useAuth()
const route = useRoute()

const mobileNavOpen = ref(false)

const navItems = [
  { label: 'My Appointments', to: '/dashboard/appointments', icon: CalendarDays, dataTestId: 'nav-appointments' },
  { label: 'My Payments', to: '/dashboard/payments', icon: CreditCard, dataTestId: 'nav-payments' },
  { label: 'Profile', to: '/dashboard/profile', icon: User, dataTestId: 'nav-profile' },
]

const isActive = (to: string) => route.path.startsWith(to)
</script>

<template>
  <div dir="ltr" lang="en" class="flex h-screen bg-background text-left">
    <aside class="hidden w-[240px] shrink-0 border-r border-border bg-muted lg:flex lg:flex-col">
      <div class="flex h-full flex-col">
        <div class="flex h-16 items-center border-b border-border px-4">
          <NuxtLink to="/" class="flex items-center text-lg font-semibold">
            Tawasul <span class="text-primary">Academy</span>
          </NuxtLink>
        </div>

        <nav class="flex-1 space-y-1 p-4" aria-label="Patient dashboard">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :data-testid="item.dataTestId"
            class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150"
            :class="isActive(item.to)
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'"
          >
            <component :is="item.icon" class="size-5" />
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="border-t border-border p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <Avatar class="size-10 shrink-0">
                <AvatarImage :src="user?.photo" :alt="user?.name" />
                <AvatarFallback class="text-base">{{ user?.name?.slice(0, 1).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-foreground">{{ user?.name }}</p>
                <p class="truncate text-xs text-muted-foreground">{{ user?.email }}</p>
              </div>
            </div>
            <ThemeToggle size="sm" />
          </div>
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition-colors duration-150 hover:bg-destructive/10"
            data-testid="nav-logout"
            @click="logout()"
          >
            <LogOut class="size-5" />
            Logout
          </button>
        </div>
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col overflow-auto">
      <header class="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <NuxtLink to="/" class="flex items-center text-lg font-semibold">
          Tawasul <span class="text-primary">Academy</span>
        </NuxtLink>
        <div class="flex items-center gap-2">
          <ThemeToggle size="sm" />
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-2xl text-foreground transition-colors duration-150 hover:bg-secondary"
            :aria-expanded="mobileNavOpen"
            aria-label="Toggle dashboard navigation"
            @click="mobileNavOpen = !mobileNavOpen"
          >
            <MenuIcon class="size-5" />
          </button>
        </div>
      </header>

      <nav
        v-if="mobileNavOpen"
        class="flex flex-col gap-1 border-b border-border bg-card px-4 py-4 lg:hidden"
      >
        <div class="flex h-full flex-col">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :data-testid="`mobile-${item.dataTestId}`"
            class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium"
            :class="isActive(item.to) ? 'text-primary' : 'text-muted-foreground'"
          >
            <component :is="item.icon" class="size-5" />
            {{ item.label }}
          </NuxtLink>
          <button
            type="button"
            class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-destructive"
            data-testid="mobile-nav-logout"
            @click="logout()"
          >
            <LogOut class="size-5" />
            Logout
          </button>
        </div>
      </nav>

      <div class="flex-1 overflow-auto">
        <div class="p-4 md:p-8">
          <Toaster />
          <slot />
        </div>
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur py-2 lg:hidden">
        <div class="flex items-center justify-around rounded-2xl bg-card/90 backdrop-blur">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :data-testid="`mobile-${item.dataTestId}`"
            class="flex min-w-[64px] flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium"
            :class="isActive(item.to) ? 'text-primary' : 'text-muted-foreground'"
          >
            <component :is="item.icon" class="size-5" />
            <span>{{ item.label }}</span>
          </NuxtLink>
          <button
            type="button"
            class="flex min-w-[64px] flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium text-muted-foreground"
            data-testid="mobile-nav-logout"
            @click="logout()"
          >
            <LogOut class="size-5" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </main>
  </div>
</template>