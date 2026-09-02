<script setup lang="ts">
import { CreditCard } from 'lucide-vue-next'
import type { PaymentRecord } from '~/modules/patient/composables/types'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const { payments, isLoading, error, fetchPayments } = usePatientDashboard()

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatAmount(p: PaymentRecord): string {
  return `${p.currency} ${Number(p.amount).toFixed(2)}`
}

const badgeVariant: Record<string, 'default' | 'success' | 'pending' | 'failed' | 'cancelled'> = {
  SUCCESS: 'success',
  PENDING: 'pending',
  FAILED: 'failed',
  REFUNDED: 'cancelled',
}

onMounted(fetchPayments)
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
      My Payments
    </h1>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div v-if="isLoading" class="mt-6 space-y-3">
      <Skeleton v-for="i in 4" :key="i" class="h-14 w-full" />
    </div>

    <div v-else-if="payments.length === 0" class="mt-6">
      <Card class="flex flex-col items-center justify-center gap-3 p-10 text-center" data-testid="payments-empty">
        <CreditCard class="size-10 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">No payment history.</p>
      </Card>
    </div>

    <template v-else>
      <div class="mt-6 overflow-hidden rounded-2xl border border-border bg-white">
        <div class="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="p in payments" :key="p.id" data-testid="payment-row">
                <TableCell>{{ formatDate(p.createdAt) }} {{ formatTime(p.createdAt) }}</TableCell>
                <TableCell>{{ p.booking.doctorName }}</TableCell>
                <TableCell>{{ p.booking.service }}</TableCell>
                <TableCell>{{ formatAmount(p) }}</TableCell>
                <TableCell>
                  <Badge :variant="badgeVariant[p.status] ?? 'default'">
                    {{ p.status }}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div class="divide-y divide-border md:hidden">
          <div v-for="p in payments" :key="p.id" class="p-4" data-testid="payment-card">
            <div class="flex items-center justify-between">
              <p class="font-semibold text-foreground">{{ p.booking.service }}</p>
              <Badge :variant="badgeVariant[p.status] ?? 'default'">{{ p.status }}</Badge>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">{{ p.booking.doctorName }}</p>
            <p class="text-sm text-muted-foreground">{{ formatDate(p.createdAt) }} · {{ p.booking.date }}</p>
            <p class="mt-2 text-base font-semibold text-foreground">{{ formatAmount(p) }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
