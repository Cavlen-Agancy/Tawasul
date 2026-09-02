<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

const props = withDefaults(
  defineProps<{
    value: string
    class?: HTMLAttributes['class']
  }>(),
  { class: undefined },
)

const active = inject<Ref<string>>('tabs:active', ref(''))
const setActive = inject<(v: string) => void>('tabs:setActive', () => {})
const isActive = computed(() => active.value === props.value)
</script>

<template>
  <button
    type="button"
    :class="cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      isActive ? 'bg-white text-foreground shadow-sm' : 'hover:text-foreground',
      props.class,
    )"
    :data-testid="`tab-${props.value}`"
    @click="setActive(props.value)"
  >
    <slot />
  </button>
</template>
