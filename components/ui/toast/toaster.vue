<script setup lang="ts">
import { Teleport, TransitionGroup } from 'vue'

const { toasts } = useToast()
</script>

<template>
  <Teleport to="body">
    <TransitionGroup
      name="toast"
      tag="div"
      class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm"
      data-testid="toaster"
    >
      <Toast
        v-for="t in toasts"
        :key="t.id"
        :toast="t"
      />
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
