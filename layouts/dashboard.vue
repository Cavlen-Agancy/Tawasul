<script setup lang="ts">
import { Menu as MenuIcon } from 'lucide-vue-next'

const mobileNavOpen = ref(false)
</script>

<template>
  <div class="flex h-screen bg-background">
    <aside class="hidden w-[240px] shrink-0 border-r border-border bg-muted lg:flex lg:flex-col">
      <slot name="sidebar" />
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
        <slot name="sidebar" />
      </nav>

      <div class="flex-1 overflow-auto">
        <slot />
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur py-2 lg:hidden">
        <slot name="mobile-nav" />
      </nav>
    </main>
  </div>
</template>