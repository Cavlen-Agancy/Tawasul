<script setup lang="ts">
import { CheckCircle2, Stethoscope } from 'lucide-vue-next'

const features = [
  {
    title: 'نخبة من الاستشارين والأطباء المعتمدين',
    description: 'خبرات إكلينيكية وعلاجية متخصصة ومسجلة بأرقى الهيئات والبروتوكولات العلاجية العالمية.',
  },
  {
    title: 'مرونة تامة في اختيار مكان وطريقة الجلسة',
    description: 'حضور شخصي في عيادتنا برعاية تامة، أو بجلسات فيديو مشفرة عالية الخصوصية من أي مكان.',
  },
  {
    title: 'سرية تامة ومحيط آمن وخالٍ من الأحكام',
    description: 'نضمن الحفاظ المطلق على سرية بياناتك وتفاصيل جلساتك وفق أشد اللوائح المهنية صرامة.',
  },
]
</script>

<template>
  <section id="why-us" aria-labelledby="about-title" class="relative w-full py-14 sm:py-20 overflow-hidden">
    <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <!-- Layout: On Mobile stacks vertically (text then visual); On Desktop two columns (text right, visual left in RTL) -->
      <div class="flex flex-col lg:grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <!-- ============================================================= -->
        <!-- TEXT CONTENT (Right side in RTL desktop, top on mobile)       -->
        <!-- ============================================================= -->
        <div class="w-full flex flex-col lg:col-span-7 text-start">
          <!-- Small pink label -->
          <p class="text-xs font-bold uppercase tracking-wider text-[#e91e8c]">
            رؤيتنا ورسالتنا الإنسانية
          </p>

          <!-- Large bold heading -->
          <h2 id="about-title" class="mt-2.5 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.25]">
            لماذا تختار أكاديمية تواصل لمسارك العلاجي؟
          </h2>

          <!-- Paragraph text -->
          <p class="mt-4 text-xs sm:text-sm lg:text-base leading-relaxed text-muted-foreground">
            في أكاديمية تواصل، نؤمن بأن الصحة النفسية ليست رفاهية، بل هي الركيزة الأساسية لحياة هادئة ومستقرة. نلتزم بأعلى معايير الدقة العلمية والميثاق الأخلاقي لنوفر لك مساحة استماع صادقة ومنهجية بالكامل، تضمن لك الأمان لاستكشاف ذاتك وتجاوز التحديات.
          </p>

          <!-- 3 Feature rows with pink checkmark icon -->
          <ul class="mt-7 flex flex-col gap-4 sm:gap-5" role="list">
            <li
              v-for="item in features"
              :key="item.title"
              class="flex items-start gap-3.5 group"
            >
              <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e91e8c]/15 text-[#e91e8c]" aria-hidden="true">
                <CheckCircle2 class="size-4 stroke-[2.5]" />
              </span>
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-foreground group-hover:text-[#e91e8c] transition-colors">
                  {{ item.title }}
                </h3>
                <p class="mt-1 text-[11px] sm:text-xs leading-relaxed text-muted-foreground">
                  {{ item.description }}
                </p>
              </div>
            </li>
          </ul>

          <!-- Bottom Trust Badge -->
          <div class="mt-8 flex items-center gap-3.5 rounded-2xl border border-border/80 bg-[#161622]/80 p-3.5 sm:p-4 backdrop-blur-md shadow-sm">
            <!-- Avatars -->
            <div class="flex -space-x-2 space-x-reverse shrink-0" aria-hidden="true">
              <div class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#161622] bg-[#e91e8c] text-white font-bold text-xs shadow-sm">
                أ.د
              </div>
              <div class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#161622] bg-[#36364a] text-white font-semibold text-xs shadow-sm">
                د.م
              </div>
              <div class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#161622] bg-[#222232] text-white font-semibold text-xs shadow-sm">
                أ.ن
              </div>
            </div>

            <!-- Trust Text -->
            <div class="text-xs sm:text-sm">
              <span class="font-extrabold text-[#e91e8c]">50+ طبيب ومختص </span>
              <span class="text-muted-foreground">من أكفأ الاستشارين والمعالجين النفسيين في خدمتك</span>
            </div>
          </div>
        </div>

        <!-- ============================================================= -->
        <!-- VISUAL CARD (Left side in RTL desktop, bottom on mobile)      -->
        <!-- ============================================================= -->
        <div class="w-full lg:col-span-5 relative">
          <!-- Subtle pink gradient glow behind the visual card -->
          <div class="pointer-events-none absolute -inset-3 rounded-[28px] bg-gradient-to-tr from-[#e91e8c]/25 via-primary/10 to-transparent blur-2xl opacity-75 -z-10" aria-hidden="true" />

          <!-- Main Visual Card with shimmer border glow -->
          <div class="clinic-card relative overflow-hidden rounded-2xl border border-white/15 bg-[#161624] p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
            <!-- Subtle animated border shimmer glow overlay -->
            <div class="shimmer-glow pointer-events-none absolute -inset-full opacity-15" aria-hidden="true" />

            <!-- Top bar: colored dots + label -->
            <div class="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div class="flex items-center gap-1.5" aria-hidden="true">
                <span class="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                <span class="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <span class="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <span class="text-[11px] font-mono font-medium text-white/50 tracking-wider">
                Tawasul Clinic Environment
              </span>
            </div>

            <!-- Two sub-cards side by side -->
            <div class="grid grid-cols-2 gap-3">
              <!-- Right Sub-Card: Pink icon card with text & subtext -->
              <div class="rounded-2xl border border-white/10 bg-[#1c1c2e] p-3.5 flex flex-col justify-between shadow-sm">
                <div>
                  <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#e91e8c]/15 text-[#e91e8c] shadow-sm" aria-hidden="true">
                    <Stethoscope class="size-5" />
                  </span>
                  <h4 class="mt-2.5 text-xs font-bold text-white leading-snug">
                    A calmer path to expert care
                  </h4>
                </div>
                <p class="mt-1.5 text-[10px] leading-relaxed text-white/60">
                  مساحة آمنة ومريحة للاستماع والعلاج النفسي المتخصص
                </p>
              </div>

              <!-- Left Sub-Card: Placeholder UI lines & pink 100% badge -->
              <div class="rounded-2xl border border-white/10 bg-[#1c1c2e] p-3.5 flex flex-col justify-between shadow-sm">
                <!-- Placeholder UI lines -->
                <div class="space-y-2 pt-1" aria-hidden="true">
                  <div class="h-2 w-4/5 rounded-full bg-white/20" />
                  <div class="h-2 w-1/2 rounded-full bg-white/10" />
                  <div class="h-2 w-2/3 rounded-full bg-white/15" />
                </div>

                <!-- Pink "خصوصية 100%" badge -->
                <div class="mt-4 rounded-xl border border-[#e91e8c]/40 bg-[#e91e8c]/15 py-1.5 px-2.5 text-center shadow-sm">
                  <div class="flex items-center justify-center gap-1.5">
                    <span class="h-1.5 w-1.5 rounded-full bg-[#e91e8c] animate-pulse" aria-hidden="true" />
                    <span class="text-[11px] font-bold text-[#e91e8c]">خصوصية 100%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bottom wide card: pink dot + "بيئة عيادية مجهزة" title + description -->
            <div class="mt-3 rounded-2xl border border-[#e91e8c]/35 bg-[#1a1a2b] p-3.5 sm:p-4 shadow-md">
              <div class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full bg-[#e91e8c] shadow-sm" aria-hidden="true" />
                <h4 class="text-xs sm:text-sm font-bold text-[#e91e8c]">
                  بيئة عيادية مجهزة
                </h4>
              </div>
              <p class="mt-1.5 text-[11px] sm:text-xs leading-relaxed text-white/75">
                فضاء هادئ مصمم للمساعدة على الاسترخاء والأمان النفسي طوال الجلسة
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Subtle animated shimmer glow on clinic card */
.clinic-card {
  transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.clinic-card:hover {
  border-color: rgba(233, 30, 140, 0.45);
  box-shadow: 0 10px 30px -10px rgba(233, 30, 140, 0.25);
}

.shimmer-glow {
  background: linear-gradient(
    135deg,
    transparent 0%,
    rgba(233, 30, 140, 0.15) 50%,
    transparent 100%
  );
  animation: subtle-shimmer 8s infinite linear;
}

@keyframes subtle-shimmer {
  0% {
    transform: translate(-30%, -30%);
  }
  50% {
    transform: translate(30%, 30%);
  }
  100% {
    transform: translate(-30%, -30%);
  }
}
</style>
