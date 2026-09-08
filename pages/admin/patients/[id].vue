<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'PATIENTS', action: 'READ' },
})

const route = useRoute()
const patientId = String(route.params.id ?? '')

const { currentPatient, loading, error, fetchPatient } = useAdminDashboard()

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => {
  void fetchPatient(patientId)
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <NuxtLink to="/admin/patients" class="text-sm font-medium text-primary hover:underline">← All patients</NuxtLink>
    <h1 class="mt-2 text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
      {{ currentPatient?.name ?? 'Patient' }}
    </h1>
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div v-if="loading && !currentPatient" class="mt-6 grid gap-2">
      <Skeleton v-for="i in 4" :key="i" class="h-14 w-full" />
    </div>

    <div v-else-if="currentPatient" class="mt-6 grid gap-6">
      <Card>
        <CardContent class="flex items-center gap-4 p-6">
          <Avatar class="size-16">
            <AvatarImage :src="currentPatient.photo || undefined" :alt="currentPatient.name" />
            <AvatarFallback class="text-xl">{{ currentPatient.name.slice(0, 1).toUpperCase() }}</AvatarFallback>
          </Avatar>
          <div>
            <p class="text-sm text-muted-foreground">{{ currentPatient.email }}</p>
            <p class="text-sm text-muted-foreground">{{ currentPatient.phone ?? 'No phone' }}</p>
            <p class="text-xs text-muted-foreground">Registered {{ formatDate(currentPatient.createdAt) }}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking history</CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <p v-if="currentPatient.bookings.length === 0" class="px-6 py-8 text-center text-sm text-muted-foreground">
            No bookings yet.
          </p>
          <div v-else class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="b in currentPatient.bookings" :key="b.id">
                  <TableCell>{{ formatDate(b.date) }} · {{ b.startTime }}</TableCell>
                  <TableCell>{{ b.doctorName ?? 'Unassigned' }}</TableCell>
                  <TableCell>{{ b.service }}</TableCell>
                  <TableCell><Badge>{{ b.status }}</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <p v-if="currentPatient.payments.length === 0" class="px-6 py-8 text-center text-sm text-muted-foreground">
            No payments yet.
          </p>
          <div v-else class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="p in currentPatient.payments" :key="p.id">
                  <TableCell>{{ formatDate(p.createdAt) }}</TableCell>
                  <TableCell>{{ p.amount }} {{ p.currency }}</TableCell>
                  <TableCell><Badge>{{ p.status }}</Badge></TableCell>
                  <TableCell class="max-w-[160px] truncate">{{ p.gatewayReference ?? '—' }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
