<script setup lang="ts">
import {
  Mail,
  Phone,
  CalendarDays,
  UserX,
  Users,
  Search,
  X,
} from 'lucide-vue-next'

definePageMeta({
  layout: 'doctor-layout',
  middleware: ['auth', 'doctor-only'],
})

interface DoctorPatient {
  userId: string
  name: string
  email: string
  phone: string | null
  photo: string | null
  createdAt: string
  totalSessions: number
  lastSession: string
}

const patients = ref<DoctorPatient[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')

async function fetchPatients() {
  loading.value = true
  error.value = null
  try {
    const res = await $fetch<{ patients: DoctorPatient[] }>('/api/doctor/patients')
    patients.value = res.patients ?? []
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || 'Could not load patients'
    patients.value = []
  } finally {
    loading.value = false
  }
}

const filteredPatients = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return patients.value
  return patients.value.filter(
    (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
  )
})

function clearSearch() {
  search.value = ''
}

function formatDate(value: string | Date): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function viewProfile(userId: string) {
  navigateTo(`/doctor/patients/${userId}`)
}

onMounted(() => {
  void fetchPatients()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1360px] p-4 md:p-8">
    <!-- Page Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground" data-testid="page-title">
          My Patients
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Patients with confirmed sessions.
        </p>
      </div>

      <!-- Quick Counter -->
      <div class="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold shadow-xs">
        <Users class="size-4 text-primary" />
        <span class="text-foreground font-bold">{{ patients.length }}</span>
        <span class="text-muted-foreground">Patients</span>
      </div>
    </div>

    <!-- Error state -->
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <!-- Search bar -->
    <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
      <div class="relative w-full max-w-md">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          v-model="search"
          type="search"
          placeholder="Search by name or email…"
          data-testid="patient-search"
          class="h-11 pl-10 pr-9 rounded-xl bg-card border-border"
        />
        <button
          v-if="search"
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
          @click="clearSearch"
        >
          <X class="size-4" />
        </button>
      </div>
    </div>

    <!-- Loading Skeletons -->
    <div v-if="loading && patients.length === 0" class="mt-6">
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <Skeleton v-for="i in 8" :key="i" class="h-64 w-full rounded-2xl" />
      </div>
    </div>

    <!-- Empty State: Search yielded no patients -->
    <div
      v-else-if="filteredPatients.length === 0 && search.trim()"
      class="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
      data-testid="empty-search-state"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserX class="size-7" />
      </div>
      <h2 class="mt-4 text-lg font-bold text-foreground">No patients found</h2>
      <p class="mt-1 text-sm text-muted-foreground max-w-sm">
        No patient records match "<span class="font-medium text-foreground">{{ search }}</span>". Try a different name or email.
      </p>
      <Button variant="outline" size="sm" class="mt-5 gap-1.5" @click="clearSearch">
        <X class="size-3.5" />
        Clear Search
      </Button>
    </div>

    <!-- Empty State: No confirmed patients -->
    <div
      v-else-if="filteredPatients.length === 0"
      class="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
      data-testid="empty-patients-state"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Users class="size-7" />
      </div>
      <h2 class="mt-4 text-lg font-bold text-foreground">No confirmed patients yet</h2>
      <p class="mt-1 text-sm text-muted-foreground max-w-sm">
        Patients will appear here once they have a confirmed session with you.
      </p>
    </div>

    <!-- Content: Grid View -->
    <div v-else class="mt-6">
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="p in filteredPatients"
          :key="p.userId"
          class="group relative flex flex-col justify-between rounded-2xl border border-[#EBEBEB] dark:border-border bg-[#FAFAFA] dark:bg-card p-6 shadow-soft hover:shadow-medium transition-all duration-150 ease-out"
          :data-testid="`patient-card-${p.userId}`"
        >
          <!-- Top Row: Badge & Joined Date -->
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300">
              PATIENT
            </span>
            <span class="text-[11px] font-medium text-muted-foreground">
              Joined {{ formatDate(p.createdAt) }}
            </span>
          </div>

          <!-- Patient Profile Center -->
          <div class="mt-4 flex flex-col items-center text-center">
            <!-- 64px Avatar -->
            <div class="relative">
              <img
                v-if="p.photo"
                :src="p.photo"
                :alt="p.name"
                class="size-16 rounded-full object-cover border-2 border-border/60 shadow-xs"
              />
              <div
                v-else
                class="flex size-16 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-xl font-bold border-2 border-border/40 shadow-xs"
              >
                {{ p.name.slice(0, 1).toUpperCase() }}
              </div>
            </div>

            <!-- Patient Name -->
            <h3 class="mt-3.5 text-base font-bold text-foreground truncate w-full" :title="p.name">
              {{ p.name }}
            </h3>

            <!-- Registration Label -->
            <p class="mt-0.5 text-xs text-muted-foreground truncate w-full">
              Registered Patient
            </p>
          </div>

          <!-- Divider -->
          <div class="my-4 border-t border-border/80" />

          <!-- Email, Phone, and Session Count -->
          <div class="space-y-2 text-xs text-muted-foreground">
            <div class="flex items-center gap-2 truncate" :title="p.email">
              <Mail class="size-3.5 shrink-0 text-muted-foreground/80" />
              <span class="truncate">{{ p.email }}</span>
            </div>
            <div class="flex items-center gap-2 truncate">
              <Phone class="size-3.5 shrink-0 text-muted-foreground/80" />
              <span class="truncate">{{ p.phone || 'No phone' }}</span>
            </div>
            <div class="flex items-center gap-2 truncate">
              <CalendarDays class="size-3.5 shrink-0 text-muted-foreground/80" />
              <span>{{ p.totalSessions }} sessions {{ p.lastSession ? '· Last: ' + formatDate(p.lastSession) : '' }}</span>
            </div>
          </div>

          <!-- Action Button: View Profile -->
          <div class="mt-5 flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              class="flex-1 text-xs font-semibold text-primary border-primary/40 hover:bg-primary/10 hover:text-primary"
              :data-testid="`view-patient-${p.userId}`"
              @click="viewProfile(p.userId)"
            >
              View Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>
