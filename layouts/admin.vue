<script setup lang="ts">
import { CalendarDays, CreditCard, LayoutDashboard, LogOut, Menu as MenuIcon, Settings, Stethoscope, Users, UserCog } from 'lucide-vue-next'

const { logout, user, hasPermission } = useAuth()
const route = useRoute()
const mobileNavOpen = ref(false)

interface NavItem {
  label: string
  to: string
  icon: unknown
  dataTestId: string
  resource?: string
}

const navItems: NavItem[] = [
  {
    label: 'Overview',
    to: '/admin',
    icon: LayoutDashboard,
    dataTestId: 'nav-admin-overview',
  },
  {
    label: 'All Appointments',
    to: '/admin/appointments',
    icon: CalendarDays,
    dataTestId: 'nav-admin-appointments',
    resource: 'APPOINTMENTS',
  },
  {
    label: 'Manage Doctors',
    to: '/admin/doctors',
    icon: Stethoscope,
    dataTestId: 'nav-admin-doctors',
    resource: 'DOCTORS',
  },
  {
    label: 'Manage Patients',
    to: '/admin/patients',
    icon: Users,
    dataTestId: 'nav-admin-patients',
    resource: 'PATIENTS',
  },
  {
    label: 'Manage Payments',
    to: '/admin/payments',
    icon: CreditCard,
    dataTestId: 'nav-admin-payments',
    resource: 'PAYMENTS',
  },
  {
    label: 'Manage Staff',
    to: '/admin/staff',
    icon: UserCog,
    dataTestId: 'nav-admin-staff',
    resource: 'STAFF',
  },
  {
    label: 'Settings',
    to: '/admin/settings',
    icon: Settings,
    dataTestId: 'nav-admin-settings',
    resource: 'SETTINGS',
  },
]

const visibleNavItems = computed(() =>
  navItems.filter((item) => !item.resource || hasPermission(item.resource, 'READ')),
)

const isActive = (to: string) => route.path.startsWith(to)
</script>

<template>
  <div class="flex h-screen bg-background">
    <aside class="hidden w-[240px] shrink-0 border-r border-border bg-muted lg:flex lg:flex-col">
      <div class="flex h-full flex-col">
        <div class="flex h-16 items-center border-b border-border px-4">
          <NuxtLink to="/" class="flex items-center text-lg font-semibold">
            Tawasul <span class="text-primary">Academy</span>
          </NuxtLink>
        </div>

        <nav class="flex-1 space-y-1 p-4" aria-label="Admin dashboard">
          <NuxtLink
            v-for="item in visibleNavItems"
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
            data-testid="nav-admin-logout"
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
            aria-label="Toggle admin navigation"
            @click="mobileNavOpen = !mobileNavOpen"
          >
            <MenuIcon class="size-5" />
          </button>
        </div>
      </header>

      <nav v-if="mobileNavOpen" class="flex flex-col gap-1 border-b border-border bg-card px-4 py-4 lg:hidden">
        <NuxtLink
          v-for="item in visibleNavItems"
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
          data-testid="mobile-nav-admin-logout"
          @click="logout()"
        >
          <LogOut class="size-5" />
          Logout
        </button>
      </nav>

      <div class="flex-1 overflow-auto">
        <Toaster />
        <slot />
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur py-2 lg:hidden">
        <NuxtLink
          v-for="item in visibleNavItems"
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
          data-testid="mobile-nav-admin-logout"
          @click="logout()"
        >
          <LogOut class="size-5" />
          <span>Logout</span>
        </button>
      </nav>
    </main>
  </div>
</template>