<script setup lang="ts">
import { Menu as MenuIcon, X as XIcon } from 'lucide-vue-next'

const mobileMenuOpen = ref(false)
const showTextLogo = ref(false)

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Services', to: '/services' },
  { label: 'Our Experts', to: '/experts' },
  { label: 'Contact', to: '/contact' },
]
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white">
    <header class="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur">
      <div class="mx-auto flex h-20 w-full max-w-[1200px] items-center justify-between px-4 lg:px-12">
        <NuxtLink to="/" class="flex shrink-0 items-center gap-2" aria-label="Tawasul Academy home">
          <img
            v-if="!showTextLogo"
            src="/logo.png"
            alt="Tawasul Academy"
            class="h-14 w-auto"
            @error="showTextLogo = true"
          >
          <span v-else class="text-xl font-semibold tracking-tight">
            Tawasul <span class="text-primary">Academy</span>
          </span>
        </NuxtLink>

        <nav class="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="text-base text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="hidden items-center gap-3 md:flex">
          <Button variant="outline" size="sm" as="a" href="/login">
            Login
          </Button>
          <Button size="sm" as="a" href="/book">
            Book Now
          </Button>
        </div>

        <button
          class="flex h-10 w-10 items-center justify-center rounded-2xl text-foreground transition-colors duration-150 hover:bg-secondary md:hidden"
          type="button"
          :aria-expanded="mobileMenuOpen"
          aria-label="Toggle navigation menu"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <MenuIcon v-if="!mobileMenuOpen" class="size-5" />
          <XIcon v-else class="size-5" />
        </button>
      </div>

      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="-translate-y-2 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="-translate-y-2 opacity-0"
      >
        <nav
          v-if="mobileMenuOpen"
          class="flex flex-col border-t border-border bg-white px-4 py-4 md:hidden"
          aria-label="Mobile navigation"
        >
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="rounded-xl px-3 py-3 text-base text-muted-foreground transition-colors duration-150 hover:text-primary"
            @click="mobileMenuOpen = false"
          >
            {{ link.label }}
          </NuxtLink>
          <div class="mt-3 flex flex-col gap-3 border-t border-border pt-4">
            <Button variant="outline" as="a" href="/login" @click="mobileMenuOpen = false">
              Login
            </Button>
            <Button as="a" href="/book" @click="mobileMenuOpen = false">
              Book Now
            </Button>
          </div>
        </nav>
      </Transition>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-border bg-white">
      <div class="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-2 px-4 py-8 text-center lg:px-12">
        <p class="text-sm text-muted-foreground">© 2024 Tawasul Academy</p>
        <p class="text-sm text-muted-foreground">
          contact@tawasul.com · +20 100 000 0000
        </p>
      </div>
    </footer>
  </div>
</template>