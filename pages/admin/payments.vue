<script setup lang="ts">
import {
  CreditCard,
  TrendingUp,
  RotateCcw,
  Receipt,
  Search,
  X,
  Calendar,
  Filter,
  Download,
  Copy,
  Check,
  LayoutGrid,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Ban,
  ArrowDownLeft,
} from 'lucide-vue-next'
import type { AdminPayment } from '~/modules/admin/composables/types'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'PAYMENTS', action: 'READ' },
})

const {
  payments,
  paymentsSummary,
  activeDoctors,
  loading,
  error,
  fetchPayments,
  fetchActiveDoctors,
} = useAdminDashboard()

const { toast } = useToast()

const filters = ref({ start: '', end: '', doctorId: '', status: '' })
const localSearch = ref('')
const viewMode = ref<'table' | 'cards'>('table')
const currentPage = ref(1)
const pageSize = computed(() => (viewMode.value === 'table' ? 15 : 12))

// Detail Drawer state
const detailOpen = ref(false)
const detailPayment = ref<AdminPayment | null>(null)
const copiedId = ref(false)

const hasActiveFilters = computed(
  () =>
    !!filters.value.start ||
    !!filters.value.end ||
    !!filters.value.doctorId ||
    !!filters.value.status ||
    !!localSearch.value,
)

function applyFilters() {
  currentPage.value = 1
  const q: Record<string, string> = {}
  if (filters.value.start) q.start = filters.value.start
  if (filters.value.end) q.end = filters.value.end
  if (filters.value.doctorId) q.doctorId = filters.value.doctorId
  if (filters.value.status) q.status = filters.value.status
  void fetchPayments(q)
}

function clearFilters() {
  filters.value = { start: '', end: '', doctorId: '', status: '' }
  localSearch.value = ''
  currentPage.value = 1
  void fetchPayments()
}

// Quick Date Range Presets
function setDatePreset(preset: 'this-month' | 'last-30' | 'all') {
  const now = new Date()
  if (preset === 'this-month') {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
    filters.value.start = `${y}-${m}-01`
    filters.value.end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
  } else if (preset === 'last-30') {
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    filters.value.start = past.toISOString().slice(0, 10)
    filters.value.end = now.toISOString().slice(0, 10)
  } else {
    filters.value.start = ''
    filters.value.end = ''
  }
  applyFilters()
}

// Client-side text search over fetched payments
const searchedPayments = computed(() => {
  const q = localSearch.value.trim().toLowerCase()
  if (!q) return payments.value
  return payments.value.filter(
    (p) =>
      p.patientName.toLowerCase().includes(q) ||
      (p.doctorName && p.doctorName.toLowerCase().includes(q)) ||
      p.service.toLowerCase().includes(q) ||
      (p.gatewayReference && p.gatewayReference.toLowerCase().includes(q)) ||
      p.id.toLowerCase().includes(q),
  )
})

const totalPages = computed(() => Math.ceil(searchedPayments.value.length / pageSize.value) || 1)

const paginatedPayments = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return searchedPayments.value.slice(start, start + pageSize.value)
})

watch([localSearch, viewMode], () => {
  currentPage.value = 1
})

function formatDate(value: string | Date): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string | Date): string {
  if (!value) return '—'
  const d = new Date(value)
  return `${d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function openPaymentDetails(p: AdminPayment) {
  detailPayment.value = p
  copiedId.value = false
  detailOpen.value = true
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = true
    toast({ title: 'Copied to clipboard', variant: 'success' })
    setTimeout(() => {
      copiedId.value = false
    }, 2000)
  } catch {
    toast({ title: 'Could not copy to clipboard', variant: 'destructive' })
  }
}

// Export filtered payments to CSV
function exportPaymentsCSV() {
  if (payments.value.length === 0) return

  const headers = [
    'Payment ID',
    'Date & Time',
    'Patient Name',
    'Doctor Name',
    'Consultation Service',
    'Amount',
    'Currency',
    'Status',
    'Gateway Reference',
  ]

  const rows = searchedPayments.value.map((p) => [
    `"${p.id}"`,
    `"${formatDateTime(p.createdAt)}"`,
    `"${p.patientName.replace(/"/g, '""')}"`,
    `"${(p.doctorName || 'Unassigned').replace(/"/g, '""')}"`,
    `"${p.service.replace(/"/g, '""')}"`,
    p.amount,
    p.currency,
    p.status,
    `"${p.gatewayReference || ''}"`,
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `tawasul-payments-${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast({ title: `Exported ${searchedPayments.value.length} transactions to CSV`, variant: 'success' })
}

onMounted(() => {
  void fetchPayments()
  void fetchActiveDoctors()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1360px] p-4 md:p-8">
    <!-- Page Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground" data-testid="page-title">
          Payments
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Track platform revenue, transaction receipts, and customer refunds.
        </p>
      </div>

      <!-- Header Action Buttons -->
      <div class="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          class="gap-2 text-xs font-semibold shadow-xs"
          data-testid="export-payments-btn"
          :disabled="payments.length === 0"
          @click="exportPaymentsCSV"
        >
          <Download class="size-3.5 text-primary" />
          Export CSV
        </Button>
      </div>
    </div>

    <!-- Error state -->
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <!-- Financial KPI Metric Cards (3 Main Metrics matching test IDs + 1 Success Rate Card) -->
    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Total Revenue -->
      <Card class="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-medium">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Revenue
          </span>
          <div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp class="size-4.5" />
          </div>
        </div>
        <div class="mt-3">
          <p class="text-2xl font-bold tracking-tight text-foreground" data-testid="stat-total-revenue">
            {{ paymentsSummary.totalRevenue }} EGP
          </p>
          <p class="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
            <ShieldCheck class="size-3 text-emerald-600" />
            Lifetime gross volume
          </p>
        </div>
      </Card>

      <!-- Revenue This Month -->
      <Card class="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-medium">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Revenue This Month
          </span>
          <div class="flex size-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Calendar class="size-4.5" />
          </div>
        </div>
        <div class="mt-3">
          <p class="text-2xl font-bold tracking-tight text-foreground" data-testid="stat-month-revenue">
            {{ paymentsSummary.totalRevenueThisMonth }} EGP
          </p>
          <p class="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Active calendar month
          </p>
        </div>
      </Card>

      <!-- Total Refunded -->
      <Card class="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-medium">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Refunded
          </span>
          <div class="flex size-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <RotateCcw class="size-4.5" />
          </div>
        </div>
        <div class="mt-3">
          <p class="text-2xl font-bold tracking-tight text-foreground" data-testid="stat-refunded">
            {{ paymentsSummary.totalRefunded }} EGP
          </p>
          <p class="mt-1 text-[11px] text-muted-foreground">
            Processed cancellations
          </p>
        </div>
      </Card>

      <!-- Transactions Count & Volume -->
      <Card class="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-medium">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Transactions
          </span>
          <div class="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Receipt class="size-4.5" />
          </div>
        </div>
        <div class="mt-3">
          <p class="text-2xl font-bold tracking-tight text-foreground">
            {{ payments.length }}
          </p>
          <p class="mt-1 text-[11px] text-muted-foreground">
            Payment records logged
          </p>
        </div>
      </Card>
    </div>

    <!-- Filter & Search Toolbar -->
    <Card class="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div class="flex flex-col gap-3.5">
        <!-- Top row: Search input + View Switcher -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="relative w-full max-w-md">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              v-model="localSearch"
              type="search"
              placeholder="Search by patient, doctor, service, reference…"
              class="h-10 pl-10 pr-9 rounded-xl text-xs bg-background border-border"
            />
            <button
              v-if="localSearch"
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear text search"
              @click="localSearch = ''"
            >
              <X class="size-3.5" />
            </button>
          </div>

          <!-- Quick Date Range Presets & View Toggle -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="hidden sm:flex items-center rounded-xl border border-border bg-muted/40 p-0.5 text-xs font-semibold">
              <button
                type="button"
                class="rounded-lg px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                @click="setDatePreset('this-month')"
              >
                This Month
              </button>
              <button
                type="button"
                class="rounded-lg px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                @click="setDatePreset('last-30')"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                class="rounded-lg px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                @click="setDatePreset('all')"
              >
                All Time
              </button>
            </div>

            <!-- View Switcher Toggle (Table / Cards) -->
            <div class="flex items-center rounded-xl border border-border bg-background p-1 shadow-xs">
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-95"
                :class="viewMode === 'table'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'"
                @click="viewMode = 'table'"
              >
                <ListIcon class="size-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-95"
                :class="viewMode === 'cards'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'"
                @click="viewMode = 'cards'"
              >
                <LayoutGrid class="size-3.5" />
                <span>Cards</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Bottom row: Advanced Server Filters (Start, End, Doctor, Status, Apply, Clear) -->
        <div class="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/50 text-xs">
          <span class="flex items-center gap-1 font-semibold text-muted-foreground">
            <Filter class="size-3.5 text-primary" />
            Filters:
          </span>

          <!-- Start date -->
          <div class="flex items-center gap-1">
            <input
              v-model="filters.start"
              type="date"
              aria-label="Start date"
              class="h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              data-testid="filter-start"
            />
          </div>

          <!-- End date -->
          <div class="flex items-center gap-1">
            <span class="text-muted-foreground text-[11px]">to</span>
            <input
              v-model="filters.end"
              type="date"
              aria-label="End date"
              class="h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              data-testid="filter-end"
            />
          </div>

          <!-- Doctor select -->
          <select
            v-model="filters.doctorId"
            aria-label="Doctor"
            class="h-9 rounded-xl border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            data-testid="filter-doctor"
          >
            <option value="">All Doctors</option>
            <option v-for="d in activeDoctors" :key="d.id" :value="d.id">
              {{ d.name }}
            </option>
          </select>

          <!-- Status select -->
          <select
            v-model="filters.status"
            aria-label="Status"
            class="h-9 rounded-xl border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            data-testid="filter-status"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          <!-- Filter Action Buttons -->
          <div class="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              class="h-9 px-3 text-xs font-semibold"
              data-testid="filter-apply"
              @click="applyFilters"
            >
              Apply Filters
            </Button>
            <Button
              v-if="hasActiveFilters"
              size="sm"
              variant="outline"
              class="h-9 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1"
              data-testid="filter-clear"
              @click="clearFilters"
            >
              <RotateCcw class="size-3" />
              Reset
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Loading Skeleton -->
    <div v-if="loading && payments.length === 0" class="mt-6 space-y-3">
      <Skeleton v-for="i in 6" :key="i" class="h-16 w-full rounded-2xl" />
    </div>

    <!-- Empty State: No payments found matching search/filter -->
    <div
      v-else-if="searchedPayments.length === 0"
      class="mt-6 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
      data-testid="no-payments"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Receipt class="size-7" />
      </div>
      <h2 class="mt-4 text-base font-bold text-foreground">No payments found</h2>
      <p class="mt-1 text-xs text-muted-foreground max-w-sm">
        {{ hasActiveFilters ? 'No transactions matched your selected filters. Try broadening your criteria.' : 'Transactions will appear here once bookings are paid or initiated.' }}
      </p>
      <Button
        v-if="hasActiveFilters"
        variant="outline"
        size="sm"
        class="mt-4 gap-1.5 text-xs"
        @click="clearFilters"
      >
        <RotateCcw class="size-3.5" />
        Clear Filters
      </Button>
    </div>

    <!-- Content: Table View -->
    <div v-else-if="viewMode === 'table'" class="mt-6">
      <Card class="overflow-hidden rounded-2xl border border-border shadow-soft">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gateway Reference</TableHead>
                <TableHead class="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="(p, idx) in paginatedPayments"
                :key="p.id"
                class="transition-colors hover:bg-muted/40 cursor-pointer"
                :class="idx % 2 === 0 ? 'bg-card' : 'bg-muted/15'"
                :data-testid="`payment-row-${p.id}`"
                @click="openPaymentDetails(p)"
              >
                <!-- Date -->
                <TableCell class="text-xs text-muted-foreground whitespace-nowrap">
                  {{ formatDateTime(p.createdAt) }}
                </TableCell>

                <!-- Patient -->
                <TableCell class="font-bold text-foreground">
                  {{ p.patientName }}
                </TableCell>

                <!-- Doctor -->
                <TableCell class="text-xs">
                  <span v-if="p.doctorName" class="font-medium text-foreground">
                    Dr. {{ p.doctorName }}
                  </span>
                  <span v-else class="text-amber-600 dark:text-amber-400 font-semibold italic">
                    Unassigned
                  </span>
                </TableCell>

                <!-- Service -->
                <TableCell class="text-xs text-muted-foreground">
                  {{ p.service }}
                </TableCell>

                <!-- Amount -->
                <TableCell class="font-bold text-foreground text-xs whitespace-nowrap">
                  <span :class="p.status === 'SUCCESS' ? 'text-foreground' : p.status === 'REFUNDED' ? 'text-muted-foreground line-through' : 'text-foreground'">
                    {{ formatCurrency(p.amount) }} {{ p.currency }}
                  </span>
                </TableCell>

                <!-- Status Badge -->
                <TableCell>
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
                    :class="[
                      p.status === 'SUCCESS' && 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300',
                      p.status === 'PENDING' && 'bg-[#FEF9C3] text-[#854D0E] dark:bg-amber-950/70 dark:text-amber-300',
                      p.status === 'FAILED' && 'bg-[#FEE2E2] text-[#991B1B] dark:bg-rose-950/70 dark:text-rose-300',
                      p.status === 'REFUNDED' && 'bg-[#F1F5F9] text-[#475569] dark:bg-muted dark:text-muted-foreground',
                    ]"
                  >
                    <CheckCircle2 v-if="p.status === 'SUCCESS'" class="size-3 shrink-0" />
                    <Clock v-else-if="p.status === 'PENDING'" class="size-3 shrink-0" />
                    <Ban v-else-if="p.status === 'FAILED'" class="size-3 shrink-0" />
                    <ArrowDownLeft v-else-if="p.status === 'REFUNDED'" class="size-3 shrink-0" />
                    {{ p.status }}
                  </span>
                </TableCell>

                <!-- Gateway Reference -->
                <TableCell class="text-xs font-mono text-muted-foreground max-w-[160px] truncate">
                  {{ p.gatewayReference || '—' }}
                </TableCell>

                <!-- View Receipt Action -->
                <TableCell class="text-right">
                  <button
                    type="button"
                    class="text-xs font-semibold text-primary hover:underline"
                    @click.stop="openPaymentDetails(p)"
                  >
                    Receipt
                  </button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>

    <!-- Content: Card Grid View (Mobile / Alternative Layout) -->
    <div v-else-if="viewMode === 'cards'" class="mt-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card
          v-for="p in paginatedPayments"
          :key="p.id"
          class="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-medium transition-all cursor-pointer"
          :data-testid="`payment-card-${p.id}`"
          @click="openPaymentDetails(p)"
        >
          <!-- Card Header -->
          <div class="flex items-center justify-between gap-2">
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="[
                p.status === 'SUCCESS' && 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300',
                p.status === 'PENDING' && 'bg-[#FEF9C3] text-[#854D0E] dark:bg-amber-950/70 dark:text-amber-300',
                p.status === 'FAILED' && 'bg-[#FEE2E2] text-[#991B1B] dark:bg-rose-950/70 dark:text-rose-300',
                p.status === 'REFUNDED' && 'bg-[#F1F5F9] text-[#475569] dark:bg-muted dark:text-muted-foreground',
              ]"
            >
              {{ p.status }}
            </span>
            <span class="text-base font-bold text-foreground">
              {{ formatCurrency(p.amount) }} {{ p.currency }}
            </span>
          </div>

          <!-- Card Body -->
          <div class="mt-4 space-y-1.5 text-xs">
            <div class="font-bold text-foreground truncate">{{ p.patientName }}</div>
            <div class="text-muted-foreground truncate flex items-center gap-1">
              <span>Doctor:</span>
              <span class="font-medium text-foreground">{{ p.doctorName ? 'Dr. ' + p.doctorName : 'Unassigned' }}</span>
            </div>
            <div class="text-muted-foreground truncate">{{ p.service }}</div>
          </div>

          <!-- Card Footer -->
          <div class="mt-4 border-t border-border/60 pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{{ formatDate(p.createdAt) }}</span>
            <span class="font-semibold text-primary group-hover:underline">View Details →</span>
          </div>
        </Card>
      </div>
    </div>

    <!-- Pagination Controls -->
    <div
      v-if="searchedPayments.length > 0"
      class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4"
    >
      <div class="text-xs font-medium text-muted-foreground">
        Showing
        <span class="font-semibold text-foreground">
          {{ Math.min((currentPage - 1) * pageSize + 1, searchedPayments.length) }}–{{ Math.min(currentPage * pageSize, searchedPayments.length) }}
        </span>
        of
        <span class="font-semibold text-foreground">{{ searchedPayments.length }}</span>
        transactions
      </div>

      <div v-if="totalPages > 1" class="flex items-center gap-1.5">
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
          :disabled="currentPage === 1"
          aria-label="Previous page"
          @click="currentPage--"
        >
          <ChevronLeft class="size-4" />
        </button>

        <button
          v-for="pg in totalPages"
          :key="pg"
          type="button"
          class="flex size-8 items-center justify-center rounded-lg text-xs font-semibold transition-all"
          :class="currentPage === pg
            ? 'bg-primary text-primary-foreground shadow-xs'
            : 'border border-border text-muted-foreground hover:bg-muted hover:text-foreground'"
          @click="currentPage = pg"
        >
          {{ pg }}
        </button>

        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
          :disabled="currentPage >= totalPages"
          aria-label="Next page"
          @click="currentPage++"
        >
          <ChevronRight class="size-4" />
        </button>
      </div>
    </div>

    <!-- Slide-in Payment Receipt Drawer -->
    <Teleport to="body">
      <!-- Dimmed Backdrop -->
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="detailOpen"
          class="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
          @click="detailOpen = false"
        />
      </Transition>

      <!-- Slide-in Drawer Panel -->
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-150 ease-in"
        leave-to-class="translate-x-full"
      >
        <aside
          v-if="detailOpen && detailPayment"
          class="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[400px] lg:w-[440px] flex-col border-l border-border bg-card text-card-foreground shadow-2xl"
          data-testid="payment-detail-drawer"
          role="dialog"
          aria-modal="true"
        >
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-border/80 px-6 py-4">
            <div class="flex items-center gap-2.5">
              <h2 class="text-base font-bold text-foreground">Transaction Details</h2>
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="[
                  detailPayment.status === 'SUCCESS' && 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300',
                  detailPayment.status === 'PENDING' && 'bg-[#FEF9C3] text-[#854D0E] dark:bg-amber-950/70 dark:text-amber-300',
                  detailPayment.status === 'FAILED' && 'bg-[#FEE2E2] text-[#991B1B] dark:bg-rose-950/70 dark:text-rose-300',
                  detailPayment.status === 'REFUNDED' && 'bg-[#F1F5F9] text-[#475569] dark:bg-muted dark:text-muted-foreground',
                ]"
              >
                {{ detailPayment.status }}
              </span>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close panel"
              @click="detailOpen = false"
            >
              <X class="size-5" />
            </button>
          </div>

          <!-- Drawer Body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Amount Receipt Hero -->
            <div class="rounded-2xl border border-border/80 bg-muted/20 p-5 text-center">
              <div class="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-3">
                <CreditCard class="size-6" />
              </div>
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payment Amount
              </p>
              <p class="text-3xl font-extrabold text-foreground mt-1">
                {{ formatCurrency(detailPayment.amount) }} <span class="text-lg font-bold text-primary">{{ detailPayment.currency }}</span>
              </p>
              <p class="text-xs text-muted-foreground mt-1">
                {{ formatDateTime(detailPayment.createdAt) }}
              </p>
            </div>

            <!-- Transaction Reference Information -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Transaction Reference
              </p>
              <div class="rounded-2xl border border-border/70 bg-muted/20 divide-y divide-border/60 text-xs">
                <div class="flex items-center justify-between p-3.5">
                  <span class="text-muted-foreground">Transaction ID</span>
                  <div class="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
                    <span>{{ detailPayment.id }}</span>
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-primary transition-colors"
                      title="Copy ID"
                      @click="copyToClipboard(detailPayment.id)"
                    >
                      <Check v-if="copiedId" class="size-3 text-emerald-600" />
                      <Copy v-else class="size-3" />
                    </button>
                  </div>
                </div>
                <div class="flex items-center justify-between p-3.5">
                  <span class="text-muted-foreground">Gateway Reference</span>
                  <span class="font-mono text-[11px] font-medium text-foreground">
                    {{ detailPayment.gatewayReference || 'None' }}
                  </span>
                </div>
                <div class="flex items-center justify-between p-3.5">
                  <span class="text-muted-foreground">Payment Status</span>
                  <span class="font-bold text-foreground">{{ detailPayment.status }}</span>
                </div>
              </div>
            </div>

            <!-- Patient & Session Information -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Appointment Information
              </p>
              <div class="rounded-2xl border border-border/70 bg-muted/20 divide-y divide-border/60 text-xs">
                <div class="flex items-center justify-between p-3.5">
                  <span class="text-muted-foreground">Patient</span>
                  <span class="font-bold text-foreground">{{ detailPayment.patientName }}</span>
                </div>
                <div class="flex items-center justify-between p-3.5">
                  <span class="text-muted-foreground">Doctor</span>
                  <span class="font-semibold text-foreground">
                    {{ detailPayment.doctorName ? 'Dr. ' + detailPayment.doctorName : 'Unassigned' }}
                  </span>
                </div>
                <div class="flex items-center justify-between p-3.5">
                  <span class="text-muted-foreground">Consultation Service</span>
                  <span class="font-medium text-foreground">{{ detailPayment.service }}</span>
                </div>
                <div class="flex items-center justify-between p-3.5">
                  <span class="text-muted-foreground">Session Date</span>
                  <span class="font-medium text-foreground">
                    {{ detailPayment.bookingDate ? formatDate(detailPayment.bookingDate) : '—' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Drawer Footer -->
          <div class="border-t border-border/80 px-6 py-3.5 bg-muted/10 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              class="gap-1.5 text-xs font-semibold"
              @click="copyToClipboard(`Payment: ${detailPayment.id} | Amount: ${detailPayment.amount} ${detailPayment.currency} | Status: ${detailPayment.status}`)"
            >
              <Copy class="size-3.5" />
              Copy Summary
            </Button>
            <Button variant="outline" size="sm" class="text-xs" @click="detailOpen = false">
              Close
            </Button>
          </div>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>
