<script setup lang="ts">
import {
  CalendarDays,
  CreditCard,
  Stethoscope,
  Users,
  ArrowRight,
  RefreshCw,
  Shield,
} from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: 'staff-only' })

const { overview, loading, error, fetchOverview } = useAdminDashboard()
const { user, hasPermission } = useAuth()

const canSeeOverview = computed(() => {
  if (!user.value || user.value.accountType !== 'STAFF') return false
  return (
    hasPermission('STAFF', 'READ') ||
    hasPermission('SETTINGS', 'READ') ||
    (user.value.permissions ?? []).length >= 10
  )
})

const permittedModules = computed(() => {
  const list = []
  if (hasPermission('APPOINTMENTS', 'READ')) {
    list.push({
      title: 'Appointments',
      desc: 'View master schedule, calendar slots, and assign counselors to sessions.',
      to: '/admin/appointments',
      icon: CalendarDays,
    })
  }
  if (hasPermission('DOCTORS', 'READ')) {
    list.push({
      title: 'Manage Doctors',
      desc: 'View doctor profiles, credentials, and schedule availability.',
      to: '/admin/doctors',
      icon: Stethoscope,
    })
  }
  if (hasPermission('PATIENTS', 'READ')) {
    list.push({
      title: 'Manage Patients',
      desc: 'Access patient records, session history, and account information.',
      to: '/admin/patients',
      icon: Users,
    })
  }
  if (hasPermission('PAYMENTS', 'READ')) {
    list.push({
      title: 'Manage Payments',
      desc: 'Track transaction history, customer receipts, and refunds.',
      to: '/admin/payments',
      icon: CreditCard,
    })
  }
  return list
})

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
  if (canSeeOverview.value) {
    void fetchOverview()
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <!-- ADMIN OVERVIEW VIEW (Only shown to Administrators) -->
    <div v-if="canSeeOverview">
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

    <!-- STAFF WORKSPACE VIEW (Shown to operational staff who are not platform admins) -->
    <div v-else class="space-y-6" data-testid="staff-workspace">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          Staff Workspace
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Welcome back, <span class="font-semibold text-foreground">{{ user?.name }}</span>. Select an authorized module below to get started.
        </p>
      </div>

      <div v-if="permittedModules.length > 0" class="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Card
          v-for="mod in permittedModules"
          :key="mod.to"
          class="group rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-medium hover:border-primary/40 transition-all flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between">
              <div class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <component :is="mod.icon" class="size-5" />
              </div>
              <span class="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                Authorized
              </span>
            </div>
            <h3 class="mt-4 text-base font-bold text-foreground">{{ mod.title }}</h3>
            <p class="mt-1 text-xs text-muted-foreground leading-relaxed">{{ mod.desc }}</p>
          </div>

          <div class="mt-6 pt-3 border-t border-border/60">
            <Button
              as="a"
              :href="mod.to"
              size="sm"
              class="w-full gap-2 text-xs font-semibold justify-center"
            >
              Open {{ mod.title }}
              <ArrowRight class="size-3.5 ml-1" />
            </Button>
          </div>
        </Card>
      </div>

      <div
        v-else
        class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-soft"
      >
        <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Shield class="size-7" />
        </div>
        <h2 class="mt-4 text-base font-bold text-foreground">No active modules assigned</h2>
        <p class="mt-1 text-xs text-muted-foreground max-w-sm">
          Your staff account does not currently have permissions assigned. Please contact an administrator to grant access.
        </p>
      </div>
    </div>
  </div>
</template>
