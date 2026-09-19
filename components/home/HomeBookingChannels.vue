<script setup lang="ts">
import { Video, Building2, Check, ArrowLeft } from 'lucide-vue-next'
import { bookingChannels } from '~/lib/home-content'
import { siteConfig } from '~/lib/site'

const icons: Record<string, unknown> = {
  online: Video,
  'in-person': Building2,
}

function channelHref(key: string): string {
  return key === 'online' ? siteConfig.booking.onlinePath : siteConfig.booking.inPersonPath
}
</script>

<template>
  <section id="booking" aria-labelledby="booking-title" class="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-2xl text-center">
      <p class="text-xs font-bold uppercase tracking-wider text-primary">قنوات التقديم المتاحة</p>
      <h2 id="booking-title" class="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
        اختر الطريقة الأنسب لك
      </h2>
      <p class="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
        سواء كنت تفضل اللقاء المباشر وجهًا لوجه أو التواصل عن بُعد، نحن جاهزون لنمنحك نفس الجودة والاهتمام.
      </p>
    </div>

    <!-- Two Cards Grid matching Image 1 -->
    <div class="mt-12 grid gap-6 md:grid-cols-2">
      <article
        v-for="channel in bookingChannels"
        :key="channel.key"
        class="flex flex-col justify-between rounded-3xl border border-border/70 bg-card/70 p-7 sm:p-9 shadow-soft backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-magenta"
        :aria-labelledby="`booking-${channel.key}`"
      >
        <div>
          <!-- Top: Icon + Category Badge -->
          <div class="flex items-center justify-between">
            <span
              class="flex h-12 w-12 items-center justify-center rounded-2xl"
              :class="channel.key === 'online' ? 'bg-primary text-white shadow-magenta' : 'border border-border/80 bg-muted/60 text-foreground'"
              aria-hidden="true"
            >
              <Component :is="icons[channel.key]" class="size-6" />
            </span>
            <span class="rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {{ channel.category }}
            </span>
          </div>

          <!-- Title & Description -->
          <h3 :id="`booking-${channel.key}`" class="mt-6 text-xl font-bold text-foreground">
            {{ channel.title }}
          </h3>
          <p class="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {{ channel.description }}
          </p>

          <!-- Checkpoints -->
          <ul class="mt-6 flex flex-col gap-3" role="list">
            <li
              v-for="point in channel.points"
              :key="point"
              class="flex items-center gap-2.5 text-xs sm:text-sm text-foreground/90"
            >
              <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary" aria-hidden="true">
                <Check class="size-3 stroke-[3]" />
              </span>
              <span>{{ point }}</span>
            </li>
          </ul>
        </div>

        <!-- CTA Button matching Image 1 -->
        <div class="mt-8 pt-2">
          <Button
            as="a"
            :href="channelHref(channel.key)"
            :class="channel.key === 'online' ? 'bg-primary text-white shadow-magenta hover:bg-primary/90' : 'border border-border/80 text-foreground hover:border-primary hover:text-primary'"
            class="w-full rounded-full py-6 font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <span>{{ channel.cta }}</span>
            <ArrowLeft class="size-4" aria-hidden="true" />
          </Button>
        </div>
      </article>
    </div>
  </section>
</template>
