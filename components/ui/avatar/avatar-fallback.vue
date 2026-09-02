<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn('flex h-full w-full items-center justify-center bg-muted text-sm font-semibold text-muted-foreground', $attrs.class)">
    <slot />
  </div>
</template>
