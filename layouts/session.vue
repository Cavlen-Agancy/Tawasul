<script setup lang="ts">
// Dedicated full-screen session layout (Google Meet style)
// Free of any dashboard sidebar, navigation headers, or container padding.
</script>

<template>
  <div class="session-fullscreen-root fixed inset-0 w-screen h-[100dvh] overflow-hidden bg-slate-950 p-0 m-0 z-50 text-foreground">
    <slot />
  </div>
</template>

<style scoped>
.session-fullscreen-root {
  width: 100vw;
  height: 100dvh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: fixed;
  inset: 0;
  background-color: #020617; /* slate-950 */
}
</style>
