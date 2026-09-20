<script setup lang="ts">
import { Calendar, Users, Clock, ArrowLeft } from 'lucide-vue-next'
import { featuredTraining } from '~/lib/home-content'
import { siteConfig } from '~/lib/site'
</script>

<template>
  <section id="training" aria-labelledby="training-title" class="w-full bg-white dark:bg-transparent py-12 sm:py-16 transition-colors duration-200">
    <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="relative overflow-hidden rounded-[2.5rem] border border-black/[0.08] dark:border-primary/30 bg-[#f8f8fc] dark:bg-card/70 p-7 sm:p-12 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-medium backdrop-blur-xl transition-colors duration-200">
        <!-- Ambient decorative glow -->
        <div class="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-primary/15 dark:bg-primary/20 blur-3xl" aria-hidden="true" />

        <div class="relative flex flex-col gap-6">
          <!-- Top Badges Row -->
          <div class="flex flex-wrap items-center gap-3">
            <span class="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white shadow-magenta">
              {{ featuredTraining.badge }}
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-border/70 bg-white dark:bg-muted/60 px-3.5 py-1.5 text-xs font-medium text-[#555] dark:text-muted-foreground shadow-sm">
              <Calendar class="size-3.5 text-primary" aria-hidden="true" />
              <span>{{ featuredTraining.dateAr }}</span>
            </span>
          </div>

          <!-- Headline & Description -->
          <div class="max-w-3xl">
            <h2 id="training-title" class="text-2xl font-extrabold sm:text-3xl md:text-4xl text-[#1a1a2e] dark:text-foreground">
              {{ featuredTraining.title }}
            </h2>
            <p class="mt-4 text-xs sm:text-sm leading-relaxed text-[#555555] dark:text-muted-foreground">
              {{ featuredTraining.description }}
            </p>
          </div>

          <!-- Meta Line: Audience & Duration -->
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#1a1a2e] dark:text-foreground/90">
            <div class="inline-flex items-center gap-2">
              <Users class="size-4 text-primary" aria-hidden="true" />
              <span class="text-[#555] dark:text-muted-foreground">الفئة المستهدفة: </span>
              <span class="font-bold">{{ featuredTraining.audience }}</span>
            </div>
            <div class="inline-flex items-center gap-2">
              <Clock class="size-4 text-primary" aria-hidden="true" />
              <span class="text-[#555] dark:text-muted-foreground">المدة التدريبية: </span>
              <span class="font-bold">{{ featuredTraining.duration }}</span>
            </div>
          </div>

          <!-- CTA Buttons -->
          <div class="mt-2 flex flex-wrap items-center gap-3 pt-2">
            <Button
              size="sm"
              as="a"
              :href="siteConfig.booking.basePath"
              class="rounded-full bg-primary px-6 font-bold text-white shadow-magenta hover:bg-primary/90"
            >
              <span>{{ featuredTraining.primaryCta }}</span>
              <ArrowLeft class="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              as="a"
              href="#contact"
              class="rounded-full border-black/[0.12] dark:border-border/80 px-6 text-xs font-semibold text-[#1a1a2e] dark:text-foreground hover:border-primary hover:text-primary"
            >
              {{ featuredTraining.secondaryCta }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
