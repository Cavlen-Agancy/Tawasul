<script setup lang="ts">
import type { ButtonHTMLAttributes } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const props = withDefaults(
  defineProps<{
    variant?: VariantProps<typeof buttonVariants>['variant']
    size?: VariantProps<typeof buttonVariants>['size']
    as?: string
    href?: string
    disabled?: boolean
    class?: ButtonHTMLAttributes['class']
  }>(),
  {
    variant: 'default',
    size: 'default',
    as: 'button',
    disabled: false,
  },
)

const emitter = defineEmits<{ click: [payload: MouseEvent] }>()

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-magenta hover:bg-primary/90 active:scale-[0.98]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98]',
        outline: 'border-2 border-primary/60 bg-background text-primary hover:bg-secondary active:scale-[0.98]',
        ghost: 'text-primary underline-offset-4 hover:bg-transparent hover:underline',
        destructive: 'bg-destructive text-destructive-foreground active:scale-[0.98]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 px-6 py-2',
        sm: 'h-10 rounded-2xl px-4',
        lg: 'h-12 rounded-2xl px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const classes = computed(() => cn(buttonVariants({ variant: props.variant, size: props.size }), props.class))
</script>

<template>
  <Component
    :is="props.as"
    :class="classes"
    :href="props.as === 'a' ? props.href : undefined"
    :type="props.as === 'a' ? undefined : 'button'"
    :disabled="props.as === 'a' ? undefined : props.disabled"
    @click="emitter('click', $event)"
  >
    <slot />
  </Component>
</template>