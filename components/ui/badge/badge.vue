<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const props = defineProps<{
  variant?: VariantProps<typeof badgeVariants>['variant']
  class?: HTMLAttributes['class']
}>()

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary',
        success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
        pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/60 dark:text-yellow-300',
        failed: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
        cancelled: 'bg-gray-200 text-gray-600 dark:bg-muted dark:text-muted-foreground',
        outline: 'border border-border text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)
</script>

<template>
  <span :class="cn(badgeVariants({ variant: props.variant }), props.class)">
    <slot />
  </span>
</template>
