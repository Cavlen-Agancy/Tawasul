<script setup lang="ts">
import { Plus, Minus } from 'lucide-vue-next'
import { homeFaqs } from '~/lib/home-content'

// First item open by default as shown in Image 1
const openIndex = ref<number | null>(0)

function toggle(i: number) {
  openIndex.value = openIndex.value === i ? null : i
}
</script>

<template>
  <section id="faq" aria-labelledby="faq-title" class="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
    <div class="text-center">
      <p class="text-xs font-bold uppercase tracking-wider text-primary">وضوح وشفافية</p>
      <h2 id="faq-title" class="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
        الأسئلة الأكثر شيوعاً
      </h2>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        إجابات موجزة عن تساؤلاتك حول الجلسات، السرية، وآليات المتابعة.
      </p>
    </div>

    <!-- Accordion List matching Image 1 -->
    <div class="mt-10 flex flex-col gap-3">
      <div
        v-for="(item, i) in homeFaqs"
        :key="item.q"
        class="overflow-hidden rounded-2xl border bg-card/70 backdrop-blur-md transition-all duration-200"
        :class="openIndex === i ? 'border-primary/40 shadow-soft' : 'border-border/60 hover:border-border'"
      >
        <h3>
          <button
            type="button"
            :aria-expanded="openIndex === i"
            :aria-controls="`faq-panel-${i}`"
            :id="`faq-button-${i}`"
            class="flex min-h-[3.75rem] w-full items-center justify-between gap-4 px-6 py-4 text-start text-xs sm:text-sm font-bold text-foreground transition-colors hover:text-primary"
            @click="toggle(i)"
          >
            <span>{{ item.q }}</span>
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors"
              :class="openIndex === i ? 'text-primary' : 'text-primary'"
              aria-hidden="true"
            >
              <Minus v-if="openIndex === i" class="size-4 stroke-[3]" />
              <Plus v-else class="size-4 stroke-[2.5]" />
            </span>
          </button>
        </h3>
        <div
          v-show="openIndex === i"
          :id="`faq-panel-${i}`"
          role="region"
          :aria-labelledby="`faq-button-${i}`"
          class="border-t border-border/40 px-6 pb-6 pt-4 text-xs sm:text-sm leading-7 text-muted-foreground"
        >
          {{ item.a }}
        </div>
      </div>
    </div>
  </section>
</template>
