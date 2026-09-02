<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'doctor-only' })
</script>

<template>
  <div class="flex-1 p-8">
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">
      Doctor Dashboard
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      Your schedule and sessions arrive in Phase 5.
    </p>
  </div>
</template>