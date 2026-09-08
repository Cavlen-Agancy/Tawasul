<script setup lang="ts">
import {
  CalendarDays,
  CreditCard,
  Stethoscope,
  Users,
  ArrowRight,
  RefreshCw,
} from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: 'staff-only' })

const { overview, loading, error, fetchOverview } = useAdminDashboard()

function formatEGP(amount: number): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'CONFIRMED':
      return 'default'
    case 'CANCELLED':
      return 'destructive'
    case 'PENDING':
      return 'secondary'
    default:
      return 'outline'
  }
}

onMounted(() => {
  void fetchOverview()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
          Admin Overview
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">Platform performance metrics and recent activity.</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="flex items-center gap-2"
        :disabled="loading"
        data-testid="refresh-overview"
        @click="fetchOverview()"
      >
        <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
        Refresh
      </Button>
    </div>

    <!-- Error state -->
    <div v-if="error" class="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" data-testid="overview-error">
      <p class="font-medium">Failed to load platform overview</p>
      <p class="mt-1 text-xs opacity-90">{{ error }}</p>
      <Button size="sm" variant="destructive" class="mt-3" @click="fetchOverview()">
        Try again
      </Button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading && !overview" class="mt-6">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-xl" />
      </div>
      <div class="mt-8">
        <Skeleton class="h-64 w-full rounded-xl" />
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="overview" class="mt-6 space-y-8">
      <!-- 4 KPI Cards (2x2 grid on sm, 4-col on lg) -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Total Bookings -->
        <Card class="transition-shadow hover:shadow-sm">
          <CardContent class="p-5">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-muted-foreground">Total Bookings</p>
              <div class="rounded-lg bg-primary/10 p-2 text-primary">
                <CalendarDays class="size-5" />
              </div>
            </div>
            <p class="mt-3 text-3xl font-bold tracking-tight text-foreground" data-testid="stat-value">
              {{ overview.totalBookingsThisMonth }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              Confirmed this month · {{ overview.totalBookingsAllTime }} all time
            </p>
          </CardContent>
        </Card>

        <!-- Total Revenue -->
        <Card class="transition-shadow hover:shadow-sm">
          <CardContent class="p-5">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-muted-foreground">Total Revenue</p>
              <div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                <CreditCard class="size-5" />
              </div>
            </div>
            <p class="mt-3 text-3xl font-bold tracking-tight text-foreground" data-testid="stat-value">
              {{ formatEGP(overview.totalRevenueThisMonth) }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              This month · {{ formatEGP(overview.totalRevenueAllTime) }} all time
            </p>
          </CardContent>
        </Card>

        <!-- Active Patients -->
        <Card class="transition-shadow hover:shadow-sm">
          <CardContent class="p-5">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-muted-foreground">Active Patients</p>
              <div class="rounded-lg bg-blue-500/10 p-2 text-blue-600">
                <Users class="size-5" />
              </div>
            </div>
            <p class="mt-3 text-3xl font-bold tracking-tight text-foreground" data-testid="stat-value">
              {{ overview.totalActivePatients }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              Patients with confirmed sessions
            </p>
          </CardContent>
        </Card>

        <!-- Active Doctors -->
        <Card class="transition-shadow hover:shadow-sm">
          <CardContent class="p-5">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-muted-foreground">Active Doctors</p>
              <div class="rounded-lg bg-purple-500/10 p-2 text-purple-600">
                <Stethoscope class="size-5" />
              </div>
            </div>
            <p class="mt-3 text-3xl font-bold tracking-tight text-foreground" data-testid="stat-value">
              {{ overview.totalActiveDoctors }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              Doctors ready for counseling
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Recent Bookings Table -->
      <Card class="overflow-hidden">
        <CardHeader class="flex flex-row items-center justify-between border-b border-border px-6 py-4">
          <div>
            <CardTitle class="text-base font-semibold">Recent Bookings</CardTitle>
            <CardDescription class="text-xs">Latest appointments requested or confirmed on the platform.</CardDescription>
          </div>
          <NuxtLink
            to="/admin/appointments"
            class="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline"
          >
            View all appointments
            <ArrowRight class="size-3.5" />
          </NuxtLink>
        </CardHeader>
        <CardContent class="p-0">
          <div v-if="overview.recentBookings.length === 0" class="p-8 text-center text-sm text-muted-foreground">
            No recent bookings found.
          </div>
          <div v-else class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="b in overview.recentBookings" :key="b.id" :data-testid="`recent-booking-${b.id}`">
                  <TableCell class="font-medium text-foreground">{{ b.patientName }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ b.doctorName || 'Unassigned' }}</TableCell>
                  <TableCell>{{ formatDate(b.date) }}</TableCell>
                  <TableCell class="max-w-[200px] truncate text-muted-foreground">{{ b.service }}</TableCell>
                  <TableCell>
                    <Badge :variant="statusVariant(b.status)">
                      {{ b.status }}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <!-- Quick Links Section -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NuxtLink to="/admin/appointments" class="block">
          <Card class="transition-colors hover:bg-muted/50">
            <CardContent class="flex items-center gap-3 p-4">
              <CalendarDays class="size-5 text-primary" />
              <div>
                <p class="text-sm font-medium text-foreground">Appointments</p>
                <p class="text-xs text-muted-foreground">Calendar & assignment</p>
              </div>
            </CardContent>
          </Card>
        </NuxtLink>

        <NuxtLink to="/admin/doctors" class="block">
          <Card class="transition-colors hover:bg-muted/50">
            <CardContent class="flex items-center gap-3 p-4">
              <Stethoscope class="size-5 text-primary" />
              <div>
                <p class="text-sm font-medium text-foreground">Doctors</p>
                <p class="text-xs text-muted-foreground">Manage therapists</p>
              </div>
            </CardContent>
          </Card>
        </NuxtLink>

        <NuxtLink to="/admin/patients" class="block">
          <Card class="transition-colors hover:bg-muted/50">
            <CardContent class="flex items-center gap-3 p-4">
              <Users class="size-5 text-primary" />
              <div>
                <p class="text-sm font-medium text-foreground">Patients</p>
                <p class="text-xs text-muted-foreground">Patient records</p>
              </div>
            </CardContent>
          </Card>
        </NuxtLink>

        <NuxtLink to="/admin/payments" class="block">
          <Card class="transition-colors hover:bg-muted/50">
            <CardContent class="flex items-center gap-3 p-4">
              <CreditCard class="size-5 text-primary" />
              <div>
                <p class="text-sm font-medium text-foreground">Payments</p>
                <p class="text-xs text-muted-foreground">Transactions & revenue</p>
              </div>
            </CardContent>
          </Card>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>