<script setup lang="ts">
import { LogOut, SlidersHorizontal } from 'lucide-vue-next'

const { logout, user } = useAuth()
const route = useRoute()

const backTo = computed<string>(() => {
  switch (user.value?.accountType) {
    case 'DOCTOR':
      return '/doctor'
    case 'STAFF':
      return '/admin'
    default:
      return '/dashboard/appointments'
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background">
    <header class="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-8">
      <NuxtLink to="/" class="flex items-center text-lg font-semibold">
        Tawasul <span class="text-primary">Academy</span>
      </NuxtLink>
      <div class="flex items-center gap-2">
        <span class="hidden text-xs text-muted-foreground sm:inline">{{ user?.name }}</span>
        <ThemeToggle size="sm" />
        <Button
          variant="ghost"
          size="sm"
          :data-testid="'meeting-back'"
          class="gap-2"
          :as="'a'"
          :href="backTo"
        >
          <SlidersHorizontal class="size-4" />
          Back
        </Button>
        <Button variant="outline" size="sm" data-testid="meeting-logout" class="gap-2" @click="logout()">
          <LogOut class="size-4" />
          Logout
        </Button>
      </div>
    </header>

    <main class="flex-1">
      <div class="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
        <slot />
      </div>
    </main>
  </div>
</template>