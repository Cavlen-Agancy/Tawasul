<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn('relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted', props.class)">
    <slot />
  </div>
</template>
