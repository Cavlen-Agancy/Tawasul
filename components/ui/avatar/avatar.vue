<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn('flex items-center justify-center overflow-hidden rounded-full bg-muted', $attrs.class)">
    <slot />
  </div>
</template>
