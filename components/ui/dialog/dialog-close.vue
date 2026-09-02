<script setup lang="ts">
const close = inject<() => void>('dialog:close', () => {})
</script>

<template>
  <button
    type="button"
    class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
    aria-label="Close"
    data-testid="dialog-close"
    @click="close"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  </button>
</template>
