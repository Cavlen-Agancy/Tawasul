<script setup lang="ts">
import {
  Heart, Users, HeartHandshake, MessageSquare, Brain, Sparkles, ArrowLeft,
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
</script>

<template>
  <section id="services" aria-labelledby="services-title" class="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mx-auto max-w-2xl text-center">
      <p class="text-xs font-bold uppercase tracking-wider text-primary">الرعاية المتخصصة</p>
      <h2 id="services-title" class="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
        خدماتنا الاستشارية والعلاجية
      </h2>
      <p class="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
        حلول مرئية متكاملة ومدروسة يقدمها نخبة من الأطباء والخبراء المعتمدين لمساعدتك في مختلف جوانب حياتك.
      </p>

      <!-- Category Filter Pills -->
      <div class="mt-8 inline-flex items-center rounded-full border border-border/70 bg-card/60 p-1 backdrop-blur-md">
        <button
          type="button"
          class="rounded-full px-5 py-2 text-xs font-bold transition-all duration-200"
          :class="activeTab === 'individual' ? 'bg-primary text-white shadow-magenta' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'individual'"
        >
          استشارات الأفراد والأسرة
        </button>
        <button
          type="button"
          class="rounded-full px-5 py-2 text-xs font-bold transition-all duration-200"
          :class="activeTab === 'corporate' ? 'bg-primary text-white shadow-magenta' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'corporate'"
        >
          حلول المؤسسات وبيئات العمل
        </button>
      </div>
    </div>

    <!-- 6 Cards Grid -->
    <div v-show="activeTab === 'individual'" class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="service in homeServices"
        :key="service.key"
        class="group relative flex flex-col justify-between rounded-3xl border border-border/70 bg-card/70 p-6 shadow-soft backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-magenta"
      >
        <!-- Top bar: Category Badge + Icon -->
        <div class="flex items-center justify-between">
          <span class="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            {{ service.category }}
          </span>
          <span class="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-white" aria-hidden="true">
            <Component :is="iconMap[service.icon]" class="size-5" />
          </span>
        </div>

        <!-- Body -->
        <div class="mt-5 flex-1">
          <h3 class="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
            {{ service.title }}
          </h3>
          <p class="mt-2.5 text-xs leading-6 text-muted-foreground">
            {{ service.description }}
          </p>
        </div>

        <!-- Action Buttons matching Image 1 -->
        <div class="mt-6 grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            as="a"
            :href="siteConfig.booking.inPersonPath"
            class="rounded-full border-border/80 text-xs font-semibold hover:border-primary hover:text-primary"
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
    <div v-show="activeTab === 'corporate'" class="mt-12 rounded-3xl border border-border/70 bg-card/70 p-8 text-center backdrop-blur-md">
      <h3 class="text-xl font-bold">{{ institutionalSolutions.title }}</h3>
      <p class="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{{ institutionalSolutions.description }}</p>
      <Button as="a" href="#contact" class="mt-6 rounded-full bg-primary px-8 font-bold text-white shadow-magenta">
        {{ institutionalSolutions.cta }}
      </Button>
    </div>

    <!-- Institutional Solutions Banner (matching Image 1 bottom strip) -->
    <div class="mt-10 overflow-hidden rounded-3xl border border-border/70 bg-card/60 p-6 sm:p-8 backdrop-blur-md">
      <div class="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div class="flex-1">
          <p class="text-xs font-bold text-primary">{{ institutionalSolutions.tag }}</p>
          <h3 class="mt-1 text-lg font-bold sm:text-xl text-foreground">
            {{ institutionalSolutions.title }}
          </h3>
          <p class="mt-2 max-w-2xl text-xs sm:text-sm leading-6 text-muted-foreground">
            {{ institutionalSolutions.description }}
          </p>
        </div>
        <Button
          variant="outline"
          as="a"
          href="#contact"
          class="rounded-full border-border/80 px-6 text-xs font-semibold hover:border-primary hover:text-primary shrink-0"
        >
          <span>{{ institutionalSolutions.cta }}</span>
          <ArrowLeft class="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  </section>
</template>
