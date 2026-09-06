<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: ['auth', 'doctor-only'],
  redirect: '/doctor/calendar',
})
</script>

<template>
  <div />
</template>
