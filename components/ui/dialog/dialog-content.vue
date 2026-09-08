<script setup lang="ts">
import { cn } from '~/lib/utils'
import { Teleport, Transition } from 'vue'

const isOpen = inject<Readonly<Ref<boolean>>>('dialog:open', ref(false))
const close = inject<() => void>('dialog:close', () => {})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="fixed inset-0 bg-black/40" data-dialog-overlay @click="close" />
        <div
          :class="cn('relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl', $attrs.class)"
          v-bind="$attrs"
          data-dialog-content
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.15s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
