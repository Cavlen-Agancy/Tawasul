<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="cn('inline-flex h-10 items-center gap-1 rounded-2xl bg-muted p-1 text-muted-foreground', $attrs.class)">
    <slot />
  </div>
</template>
