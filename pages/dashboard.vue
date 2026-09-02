<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'patient-only' })

const { user } = useAuth()
</script>

<template>
  <div class="flex-1 p-8">
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">
      Patient Dashboard
    </h1>
    <p class="mt-2 text-sm text-muted-foreground">
      Welcome back, {{ user?.name }}. Session booking arrives in Phase 4.
    </p>
  </div>
</template>