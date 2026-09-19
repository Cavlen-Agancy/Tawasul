<script setup lang="ts">
import { CheckCircle2 } from 'lucide-vue-next'
import { homeBenefits } from '~/lib/home-content'
</script>

<template>
  <section id="why-us" aria-labelledby="about-title" class="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <!-- Right Column: Content (in RTL, this appears on the right) -->
      <div class="flex flex-col">
        <p class="text-xs font-bold uppercase tracking-wider text-primary">رؤيتنا ورسالتنا الإنسانية</p>
        <h2 id="about-title" class="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl leading-tight">
          لماذا تختار أكاديمية تواصل لمسارك العلاجي؟
        </h2>
        <p class="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          في أكاديمية تواصل، نؤمن بأن الصحة النفسية ليست رفاهية، بل هي الركيزة الأساسية لحياة هادئة ومستقرة. نلتزم بأعلى معايير الدقة العلمية والميثاق الأخلاقي لنوفر لك مساحة استماع صادقة ومنهجية بالكامل، تضمن لك الأمان لاستكشاف ذاتك وتجاوز التحديات.
        </p>

        <!-- 3 Benefit Checkpoints -->
        <ul class="mt-8 flex flex-col gap-5" role="list">
          <li
            v-for="b in homeBenefits"
            :key="b.title"
            class="flex items-start gap-3.5"
          >
            <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
              <CheckCircle2 class="size-4" />
            </span>
            <div>
              <h3 class="text-sm font-bold text-foreground">{{ b.title }}</h3>
              <p class="mt-1 text-xs leading-6 text-muted-foreground">{{ b.description }}</p>
            </div>
          </li>
        </ul>

        <!-- Social Proof Doctors Row -->
        <div class="mt-10 flex items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md">
          <!-- Overlapping Avatars -->
          <div class="flex -space-x-2 space-x-reverse" aria-hidden="true">
            <div class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-primary font-bold text-white text-xs">
              أ.د
            </div>
            <div class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-[#383842] font-semibold text-white text-xs">
              د.م
            </div>
            <div class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-[#282830] font-semibold text-white text-xs">
              أ.ن
            </div>
          </div>
          <div class="text-xs">
            <span class="font-bold text-foreground">+50 طبيب ومختص </span>
            <span class="text-muted-foreground">من أكفأ الاستشاريين والمعالجين النفسيين في خدمتك</span>
          </div>
        </div>
      </div>

      <!-- Left Column: Clinic Visual Layout matching Image 1 -->
      <div class="relative">
        <div class="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-[#2a2428] via-[#1a171c] to-card p-6 shadow-medium backdrop-blur-md">
          <!-- Editorial Clinic Preview Frame -->
          <div class="relative flex flex-col gap-4 rounded-2xl bg-black/40 p-4 border border-white/10">
            <!-- Mini header mockup -->
            <div class="flex items-center justify-between border-b border-white/10 pb-3">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span class="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span class="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <span class="text-[11px] text-white/50">Tawasul Clinic Environment</span>
            </div>

            <!-- Visual cards inside -->
            <div class="grid grid-cols-2 gap-3 pt-2">
              <div class="rounded-xl bg-white/5 p-4 border border-white/5">
                <div class="h-16 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                    <path d="M6 6h10"/>
                    <path d="M6 10h10"/>
                  </svg>
                </div>
                <p class="mt-3 text-xs font-bold text-white">A calmer path to expert care.</p>
                <p class="mt-1 text-[10px] text-white/60">مساحة سرية ومريحة للاستماع والعلاج.</p>
              </div>

              <div class="rounded-xl bg-white/5 p-4 border border-white/5 flex flex-col justify-between">
                <div class="space-y-2">
                  <div class="h-2 w-3/4 rounded bg-white/20" />
                  <div class="h-2 w-1/2 rounded bg-white/10" />
                  <div class="h-2 w-2/3 rounded bg-white/15" />
                </div>
                <div class="mt-4 rounded-lg bg-primary/20 p-2 text-center text-[11px] font-bold text-primary">
                  خصوصية 100%
                </div>
              </div>
            </div>

            <!-- Floating Badge matching Image 1 -->
            <div class="mt-2 rounded-xl border border-primary/30 bg-card/90 p-3.5 shadow-soft">
              <div class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full bg-primary" />
                <p class="text-xs font-bold text-primary">بيئة عيادية مجهزة</p>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                فضاء هادئ مصمم للمساعدة على الاسترخاء والأمان النفسي طوال الجلسة
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
