<script setup lang="ts">
import { CalendarDays, Settings } from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: 'staff-only' })

const {
  schedules,
  blockedDates,
  pendingBookings,
  loading,
  error,
  fetchAll,
} = useAdminDashboard()

const statCards = computed(() => [
  { label: 'Active weekly slots', value: schedules.value.filter((s) => s.isActive).length, to: '/admin/settings' },
  { label: 'Blocked days', value: blockedDates.value.length, to: '/admin/settings' },
  { label: 'Pending bookings', value: pendingBookings.value.length, to: '/admin/appointments' },
])

onMounted(() => {
  void fetchAll()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
        Admin Overview
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage schedules, bookings, and closed days.</p>
    </div>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div v-if="loading" class="mt-6 grid gap-4 sm:grid-cols-3">
      <Skeleton v-for="i in 3" :key="i" class="h-24 w-full" />
    </div>
    <div v-else class="mt-6 grid gap-4 sm:grid-cols-3">
      <NuxtLink v-for="card in statCards" :key="card.label" :to="card.to" class="block">
        <Card>
          <CardContent class="p-5">
            <p class="text-sm text-muted-foreground">{{ card.label }}</p>
            <p class="mt-1 text-3xl font-semibold text-foreground" data-testid="stat-value">{{ card.value }}</p>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>

    <div class="mt-8 grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <CalendarDays class="size-5 text-primary" />
            Appointments
          </CardTitle>
          <CardDescription>Review pending bookings and assign doctors.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button as="a" href="/admin/appointments" data-testid="go-appointments">
            Open appointments
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Settings class="size-5 text-primary" />
            Settings
          </CardTitle>
          <CardDescription>Edit weekly schedule and block off dates.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button as="a" href="/admin/settings" data-testid="go-settings">
            Open settings
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>