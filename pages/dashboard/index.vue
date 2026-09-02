<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: ['auth', 'patient-only'],
  redirect: '/dashboard/appointments',
})
</script>

<template>
  <div />
</template>
