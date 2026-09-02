<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <th :class="cn('h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground', $attrs.class)">
    <slot />
  </th>
</template>
