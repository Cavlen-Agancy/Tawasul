<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'staff-only' })
</script>

<template>
  <div class="flex-1 p-8">
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">
      Admin Dashboard
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      Administration tools arrive in Phase 6.
    </p>
  </div>
</template>