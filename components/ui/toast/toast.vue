<script setup lang="ts">
import type { ToastData } from '~/composables/use-toast'
import { cn } from '~/lib/utils'

const props = withDefaults(
  defineProps<{
    toast: ToastData
    class?: string
  }>(),
  { class: '' },
)

const { dismiss } = useToast()
</script>

<template>
  <div
    :class="cn(
      'group pointer-events-auto relative flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg',
      toast.variant === 'destructive' && 'border-destructive/40 text-destructive',
      toast.variant === 'success' && 'border-success/40',
      toast.variant === 'info' && 'border-primary/40',
      props.class,
    )"
    :data-testid="`toast-${toast.variant || 'default'}`"
    role="status"
    aria-live="polite"
  >
    <component :is="toast.component" v-if="toast.component" v-bind="toast.props" />
    <template v-else>
      <div class="flex-1 min-w-0">
        <p v-if="toast.title" class="text-sm font-semibold">
          <slot name="title">{{ toast.title }}</slot>
        </p>
        <p v-if="toast.description" class="mt-1 text-sm text-muted-foreground">
          <slot name="description">{{ toast.description }}</slot>
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
        data-testid="toast-dismiss"
        @click="dismiss(toast.id)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </template>
  </div>
</template>
