<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <h2 :class="cn('text-lg font-semibold leading-none tracking-tight', $attrs.class)">
    <slot />
  </h2>
</template>
