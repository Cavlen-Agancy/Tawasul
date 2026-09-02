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
const isActive = computed(() => active.value === props.value)
</script>

<template>
  <div v-show="isActive" :class="cn('mt-4', props.class)">
    <slot />
  </div>
</template>
