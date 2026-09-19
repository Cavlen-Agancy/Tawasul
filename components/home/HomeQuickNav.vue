<script setup lang="ts">
import { Calendar, MapPin, CircleHelp, Phone } from 'lucide-vue-next'
import { siteConfig } from '~/lib/site'

const { whatsappUrl } = useSiteSettings()

const items = computed(() => [
  { key: 'book', label: 'احجز الآن', href: siteConfig.booking.basePath, icon: Calendar, external: false },
  { key: 'location', label: 'مقر الأكاديمية', href: '#contact', icon: MapPin, external: false },
  { key: 'faq', label: 'الأسئلة الشائعة', href: '#faq', icon: CircleHelp, external: false },
  {
    key: 'contact',
    label: 'واتساب وتواصل',
    href: whatsappUrl.value || '#contact',
    icon: Phone,
    external: !!whatsappUrl.value,
  },
])
</script>

<template>
  <!-- Floating quick dock on the right screen edge matching Image 1 -->
  <aside
    class="fixed right-3 top-1/3 z-40 hidden flex-col gap-1.5 rounded-2xl border border-border/70 bg-card/85 p-1.5 shadow-medium backdrop-blur-xl lg:flex"
    aria-label="تنقل سريع"
  >
    <component
      :is="item.external ? 'a' : 'NuxtLink'"
      v-for="item in items"
      :key="item.key"
      :to="!item.external ? (item.href.startsWith('/') ? item.href : `/${item.href}`) : undefined"
      :href="item.href"
      v-bind="item.external ? { target: '_blank', rel: 'noopener' } : {}"
      :aria-label="item.label"
      class="group relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-primary/15 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Component :is="item.icon" class="size-4" aria-hidden="true" />
      <!-- Tooltip on hover (slides to the left in RTL) -->
      <span
        class="pointer-events-none absolute end-full me-2.5 whitespace-nowrap rounded-xl border border-border/70 bg-card px-3 py-1 text-xs font-semibold text-foreground opacity-0 shadow-medium transition-all duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        {{ item.label }}
      </span>
    </component>
  </aside>
</template>
