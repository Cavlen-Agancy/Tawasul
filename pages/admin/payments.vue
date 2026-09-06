<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'staff-only'] })

const { payments, paymentsSummary, activeDoctors, loading, error, fetchPayments, fetchActiveDoctors } = useAdminDashboard()

const filters = ref({ start: '', end: '', doctorId: '', status: '' })

function applyFilters() {
  const q: Record<string, string> = {}
  if (filters.value.start) q.start = filters.value.start
  if (filters.value.end) q.end = filters.value.end
  if (filters.value.doctorId) q.doctorId = filters.value.doctorId
  if (filters.value.status) q.status = filters.value.status
  void fetchPayments(q)
}

function clearFilters() {
  filters.value = { start: '', end: '', doctorId: '', status: '' }
  void fetchPayments()
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => {
  void fetchPayments()
  void fetchActiveDoctors()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
      Payments
    </h1>
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle class="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold" data-testid="stat-total-revenue">{{ paymentsSummary.totalRevenue }} EGP</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle class="text-sm font-medium text-muted-foreground">Revenue This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold" data-testid="stat-month-revenue">{{ paymentsSummary.totalRevenueThisMonth }} EGP</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle class="text-sm font-medium text-muted-foreground">Total Refunded</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold" data-testid="stat-refunded">{{ paymentsSummary.totalRefunded }} EGP</p>
        </CardContent>
      </Card>
    </div>

    <Card class="mt-6">
      <CardContent class="grid gap-3 p-4 sm:grid-cols-5">
        <input v-model="filters.start" type="date" aria-label="Start date" class="rounded-lg border border-border bg-background px-3 py-2 text-sm" data-testid="filter-start" />
        <input v-model="filters.end" type="date" aria-label="End date" class="rounded-lg border border-border bg-background px-3 py-2 text-sm" data-testid="filter-end" />
        <select v-model="filters.doctorId" aria-label="Doctor" class="rounded-lg border border-border bg-background px-3 py-2 text-sm" data-testid="filter-doctor">
          <option value="">All doctors</option>
          <option v-for="d in activeDoctors" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
        <select v-model="filters.status" aria-label="Status" class="rounded-lg border border-border bg-background px-3 py-2 text-sm" data-testid="filter-status">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <div class="flex gap-2">
          <Button size="sm" data-testid="filter-apply" @click="applyFilters">Filter</Button>
          <Button size="sm" variant="outline" data-testid="filter-clear" @click="clearFilters">Clear</Button>
        </div>
      </CardContent>
    </Card>

    <div v-if="loading" class="mt-4 grid gap-2">
      <Skeleton v-for="i in 5" :key="i" class="h-14 w-full" />
    </div>

    <p v-else-if="payments.length === 0" class="mt-4 rounded-2xl border border-border bg-white px-4 py-10 text-center text-sm text-muted-foreground" data-testid="no-payments">
      No payments found.
    </p>

    <div v-else class="mt-4">
      <Card class="hidden overflow-hidden md:block">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gateway Ref</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="p in payments" :key="p.id" :data-testid="`payment-row-${p.id}`">
                <TableCell>{{ formatDate(p.createdAt) }}</TableCell>
                <TableCell>{{ p.patientName }}</TableCell>
                <TableCell>{{ p.doctorName ?? '—' }}</TableCell>
                <TableCell>{{ p.service }}</TableCell>
                <TableCell>{{ p.amount }} {{ p.currency }}</TableCell>
                <TableCell><Badge>{{ p.status }}</Badge></TableCell>
                <TableCell class="max-w-[160px] truncate">{{ p.gatewayReference ?? '—' }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <div class="grid gap-3 md:hidden">
        <Card v-for="p in payments" :key="p.id" :data-testid="`payment-card-${p.id}`">
          <CardContent class="grid gap-1 p-4 text-sm">
            <div class="flex items-center justify-between">
              <span class="font-semibold">{{ p.amount }} {{ p.currency }}</span>
              <Badge>{{ p.status }}</Badge>
            </div>
            <p class="text-muted-foreground">{{ p.patientName }} · {{ p.doctorName ?? 'Unassigned' }}</p>
            <p class="text-muted-foreground">{{ p.service }} · {{ formatDate(p.createdAt) }}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
