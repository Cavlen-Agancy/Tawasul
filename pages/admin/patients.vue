<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'staff-only'] })

const { patients, loading, error, fetchPatients } = useAdminDashboard()

const search = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void fetchPatients(search.value.trim())
  }, 300)
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => {
  void fetchPatients()
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
      Manage Patients
    </h1>
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div class="mt-6">
      <Input v-model="search" type="search" placeholder="Search by name or email" data-testid="patient-search" class="max-w-md" @input="onSearch" />
    </div>

    <Card class="mt-4 overflow-hidden">
      <div v-if="loading" class="grid gap-2 p-4">
        <Skeleton v-for="i in 5" :key="i" class="h-14 w-full" />
      </div>
      <p v-else-if="patients.length === 0" class="px-4 py-10 text-center text-sm text-muted-foreground">
        No patients found.
      </p>
      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Total Sessions</TableHead>
              <TableHead>Last Session</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="p in patients" :key="p.id" :data-testid="`patient-row-${p.id}`">
              <TableCell>
                <Avatar class="size-9">
                  <AvatarImage :src="p.photo || undefined" :alt="p.name" />
                  <AvatarFallback>{{ p.name.slice(0, 1).toUpperCase() }}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell class="font-medium">{{ p.name }}</TableCell>
              <TableCell>{{ p.email }}</TableCell>
              <TableCell>{{ p.phone ?? '—' }}</TableCell>
              <TableCell>{{ p.totalSessions }}</TableCell>
              <TableCell>{{ p.lastSessionDate ? formatDate(p.lastSessionDate) : '—' }}</TableCell>
              <TableCell>{{ formatDate(p.createdAt) }}</TableCell>
              <TableCell>
                <NuxtLink :to="`/admin/patients/${p.id}`" class="text-sm font-medium text-primary hover:underline" :data-testid="`view-patient-${p.id}`">
                  View
                </NuxtLink>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  </div>
</template>
