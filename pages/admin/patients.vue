<script setup lang="ts">
import {
  LayoutGrid,
  List as ListIcon,
  Mail,
  Phone,
  CalendarDays,
  Calendar,
  UserX,
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  ExternalLink,
  Sparkles,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Edit,
} from 'lucide-vue-next'
import type { AdminPatient } from '~/modules/admin/composables/types'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'PATIENTS', action: 'READ' },
})

const { patients, loading, error, fetchPatients, updatePatient } = useAdminDashboard()
const { toast } = useToast()

const search = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const currentPage = ref(1)

// Multi-selection state for bulk actions
const selectedIds = ref<Set<string>>(new Set())
const bulkMenuOpen = ref(false)

// Detail Drawer state
const detailOpen = ref(false)
const detailPatient = ref<AdminPatient | null>(null)

// Edit Patient Modal state
const editPatientOpen = ref(false)
const savingPatient = ref(false)
const editPatientId = ref('')
const editPatientForm = ref({ name: '', email: '', phone: '' })

let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    void fetchPatients(search.value.trim())
  }, 300)
}

function clearSearch() {
  search.value = ''
  currentPage.value = 1
  void fetchPatients()
}

function formatDate(value: string | Date): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateLong(value: string | Date): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const pageSize = computed(() => (viewMode.value === 'grid' ? 12 : 20))
const totalPages = computed(() => Math.ceil(patients.value.length / pageSize.value) || 1)

const paginatedPatients = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return patients.value.slice(start, start + pageSize.value)
})

const isAllSelected = computed(() => {
  if (paginatedPatients.value.length === 0) return false
  return paginatedPatients.value.every((p) => selectedIds.value.has(p.id))
})

watch([search, viewMode], () => {
  currentPage.value = 1
  bulkMenuOpen.value = false
})

function closeAllMenus() {
  bulkMenuOpen.value = false
}

function toggleSelect(id: string, event?: Event) {
  if (event) event.stopPropagation()
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function toggleSelectAll() {
  const next = new Set(selectedIds.value)
  if (isAllSelected.value) {
    for (const p of paginatedPatients.value) {
      next.delete(p.id)
    }
  } else {
    for (const p of paginatedPatients.value) {
      next.add(p.id)
    }
  }
  selectedIds.value = next
}

function clearSelection() {
  selectedIds.value = new Set()
  bulkMenuOpen.value = false
}

function downloadCSV(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportSelectedCSV() {
  const selectedList = patients.value.filter((p) => selectedIds.value.has(p.id))
  if (selectedList.length === 0) return

  const headers = ['Name', 'Email', 'Phone', 'Total Sessions', 'Last Session Date', 'Registration Date']
  const rows = selectedList.map((p) => [
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.email.replace(/"/g, '""')}"`,
    `"${(p.phone || '').replace(/"/g, '""')}"`,
    p.totalSessions ?? 0,
    p.lastSessionDate ? formatDate(p.lastSessionDate) : 'None',
    formatDate(p.createdAt),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  downloadCSV(csv, `tawasul-patients-selected-${new Date().toISOString().slice(0, 10)}.csv`)
  toast({ title: `Exported ${selectedList.length} patients to CSV`, variant: 'success' })
  bulkMenuOpen.value = false
}

function exportAllCSV() {
  const headers = ['Name', 'Email', 'Phone', 'Total Sessions', 'Last Session Date', 'Registration Date']
  const rows = patients.value.map((p) => [
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.email.replace(/"/g, '""')}"`,
    `"${(p.phone || '').replace(/"/g, '""')}"`,
    p.totalSessions ?? 0,
    p.lastSessionDate ? formatDate(p.lastSessionDate) : 'None',
    formatDate(p.createdAt),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  downloadCSV(csv, `tawasul-all-patients-${new Date().toISOString().slice(0, 10)}.csv`)
  toast({ title: `Exported ${patients.value.length} patients to CSV`, variant: 'success' })
  bulkMenuOpen.value = false
}

function openPatientDetails(p: AdminPatient) {
  closeAllMenus()
  detailPatient.value = p
  detailOpen.value = true
}

function openEditPatient(p: AdminPatient) {
  closeAllMenus()
  editPatientId.value = p.id
  editPatientForm.value = {
    name: p.name,
    email: p.email,
    phone: p.phone || '',
  }
  editPatientOpen.value = true
}

async function submitEditPatient() {
  if (!editPatientForm.value.name.trim()) return
  savingPatient.value = true
  try {
    const ok = await updatePatient(editPatientId.value, {
      name: editPatientForm.value.name.trim(),
      phone: editPatientForm.value.phone.trim() || null,
    })
    if (ok) {
      toast({ title: 'Patient profile updated successfully', variant: 'success' })
      if (detailPatient.value && detailPatient.value.id === editPatientId.value) {
        detailPatient.value.name = editPatientForm.value.name.trim()
        detailPatient.value.phone = editPatientForm.value.phone.trim() || null
      }
      editPatientOpen.value = false
    } else {
      toast({ title: 'Could not update patient profile', variant: 'destructive' })
    }
  } catch (e: unknown) {
    toast({
      title: (e as { data?: { message?: string } })?.data?.message || 'Failed to update patient profile',
      variant: 'destructive',
    })
  } finally {
    savingPatient.value = false
  }
}

onMounted(() => {
  void fetchPatients()
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1360px] p-4 md:p-8" @click="closeAllMenus">
    <!-- Page Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground" data-testid="page-title">
          Manage Patients
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          View, search, and manage patient accounts and session histories.
        </p>
      </div>

      <!-- Action Buttons in Header: Bulk Actions & Total Patients -->
      <div class="flex items-center gap-2.5">
        <!-- Bulk Actions Button Dropdown -->
        <div class="relative">
          <Button
            variant="outline"
            class="gap-2 text-xs font-semibold shadow-xs"
            :class="selectedIds.size > 0
              ? 'border-primary text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary font-bold'
              : ''"
            data-testid="bulk-actions-btn"
            @click.stop="bulkMenuOpen = !bulkMenuOpen"
          >
            <Sparkles class="size-3.5 text-primary" />
            <span>Bulk Actions</span>
            <span
              v-if="selectedIds.size > 0"
              class="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
            >
              {{ selectedIds.size }}
            </span>
            <ChevronDown class="size-3.5 opacity-60 transition-transform" :class="{ 'rotate-180': bulkMenuOpen }" />
          </Button>

          <!-- Bulk Actions Dropdown Menu -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="scale-95 opacity-0"
            enter-to-class="scale-100 opacity-100"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="scale-95 opacity-0"
          >
            <div
              v-if="bulkMenuOpen"
              class="absolute right-0 top-11 z-30 w-56 rounded-2xl border border-border bg-card p-1.5 shadow-xl text-xs"
              @click.stop
            >
              <div class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Selected Patients ({{ selectedIds.size }})
              </div>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
                :disabled="selectedIds.size === 0"
                data-testid="bulk-export-opt"
                @click="exportSelectedCSV"
              >
                <Download class="size-4 text-primary" />
                <span>Export Selected (CSV)</span>
              </button>
              <button
                v-if="selectedIds.size > 0"
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted text-muted-foreground"
                @click="clearSelection"
              >
                <X class="size-4" />
                <span>Deselect All</span>
              </button>

              <div class="my-1 border-t border-border/80" />

              <div class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                All Patients
              </div>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted text-foreground"
                data-testid="export-all-patients-opt"
                @click="exportAllCSV"
              >
                <FileSpreadsheet class="size-4 text-muted-foreground" />
                <span>Export All Patients (CSV)</span>
              </button>
            </div>
          </Transition>
        </div>

        <!-- Quick Counter -->
        <div class="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold shadow-xs">
          <Users class="size-4 text-primary" />
          <span class="text-foreground font-bold">{{ patients.length }}</span>
          <span class="text-muted-foreground">Patients</span>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <!-- Search bar & View Toggle -->
    <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
      <div class="relative w-full max-w-md">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          v-model="search"
          type="search"
          placeholder="Search by name or email…"
          data-testid="patient-search"
          class="h-11 pl-10 pr-9 rounded-xl bg-card border-border"
          @input="onSearch"
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

      <!-- View Switcher Toggle -->
      <div class="flex items-center rounded-xl border border-border bg-card p-1 shadow-xs">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
          :class="viewMode === 'grid'
            ? 'bg-primary text-primary-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'"
          data-testid="view-mode-grid"
          @click="viewMode = 'grid'"
        >
          <LayoutGrid class="size-3.5" />
          <span>Grid</span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
          :class="viewMode === 'list'
            ? 'bg-primary text-primary-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'"
          data-testid="view-mode-list"
          @click="viewMode = 'list'"
        >
          <ListIcon class="size-3.5" />
          <span>List</span>
        </button>
      </div>
    </div>

    <!-- Loading Skeletons -->
    <div v-if="loading && patients.length === 0" class="mt-6">
      <div v-if="viewMode === 'grid'" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Skeleton v-for="i in 8" :key="i" class="h-64 w-full rounded-2xl" />
      </div>
      <div v-else class="space-y-3">
        <Skeleton v-for="i in 6" :key="i" class="h-16 w-full rounded-xl" />
      </div>
    </div>

    <!-- Empty State: Search yielded no patients -->
    <div
      v-else-if="patients.length === 0 && search.trim()"
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

    <!-- Empty State: No patients at all in database -->
    <div
      v-else-if="patients.length === 0"
      class="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
      data-testid="empty-patients-state"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Users class="size-7" />
      </div>
      <h2 class="mt-4 text-lg font-bold text-foreground">No patients yet</h2>
      <p class="mt-1 text-sm text-muted-foreground max-w-sm">
        Registered patient accounts will appear here once they create accounts or schedule sessions.
      </p>
    </div>

    <!-- Content: Grid View -->
    <div v-else-if="viewMode === 'grid'" class="mt-6">
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="p in paginatedPatients"
          :key="p.id"
          class="group relative flex flex-col justify-between rounded-2xl border border-[#EBEBEB] dark:border-border bg-[#FAFAFA] dark:bg-card p-6 shadow-soft hover:shadow-medium transition-all duration-150 ease-out"
          :class="{ 'ring-2 ring-primary bg-primary/5 dark:bg-primary/10': selectedIds.has(p.id) }"
          :data-testid="`patient-card-${p.id}`"
        >
          <!-- Top Row: Checkbox, Badge & Joined Date -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <input
                type="checkbox"
                :checked="selectedIds.has(p.id)"
                class="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                aria-label="Select patient"
                :data-testid="`select-patient-${p.id}`"
                @click.stop="toggleSelect(p.id, $event)"
              />
              <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300">
                PATIENT
              </span>
            </div>
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
              <span>{{ p.totalSessions }} sessions {{ p.lastSessionDate ? '· Last: ' + formatDate(p.lastSessionDate) : '' }}</span>
            </div>
          </div>

          <!-- Action Buttons: View Details & Update Profile -->
          <div class="mt-5 flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              class="flex-1 text-xs font-semibold"
              :data-testid="`view-patient-drawer-${p.id}`"
              @click="openPatientDetails(p)"
            >
              View Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="flex-1 text-xs font-semibold text-primary border-primary/40 hover:bg-primary/10 hover:text-primary"
              :data-testid="`edit-patient-${p.id}`"
              @click="openEditPatient(p)"
            >
              Update Profile
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Content: List View (Compact Table) -->
    <Card v-else-if="viewMode === 'list'" class="mt-6 overflow-hidden rounded-2xl border border-border shadow-soft">
      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-12">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  class="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                  aria-label="Select all patients on this page"
                  data-testid="select-all-patients"
                  @click.stop="toggleSelectAll"
                />
              </TableHead>
              <TableHead class="w-16">Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Total Sessions</TableHead>
              <TableHead>Last Session</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="(p, index) in paginatedPatients"
              :key="p.id"
              :data-testid="`patient-row-${p.id}`"
              class="transition-colors hover:bg-[#FCE4F3]/40 dark:hover:bg-primary/10"
              :class="[
                selectedIds.has(p.id) ? 'bg-primary/5 dark:bg-primary/10' : index % 2 === 0 ? 'bg-white dark:bg-card' : 'bg-[#FAFAFA] dark:bg-muted/20',
              ]"
            >
              <TableCell>
                <input
                  type="checkbox"
                  :checked="selectedIds.has(p.id)"
                  class="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                  aria-label="Select patient"
                  :data-testid="`select-patient-row-${p.id}`"
                  @click.stop="toggleSelect(p.id, $event)"
                />
              </TableCell>
              <TableCell>
                <div class="relative">
                  <img
                    v-if="p.photo"
                    :src="p.photo"
                    :alt="p.name"
                    class="size-9 rounded-full object-cover border border-border"
                  />
                  <div
                    v-else
                    class="flex size-9 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-sm font-bold"
                  >
                    {{ p.name.slice(0, 1).toUpperCase() }}
                  </div>
                </div>
              </TableCell>
              <TableCell class="font-bold text-foreground">{{ p.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ p.email }}</TableCell>
              <TableCell class="text-muted-foreground">{{ p.phone ?? '—' }}</TableCell>
              <TableCell class="font-medium text-foreground">{{ p.totalSessions }}</TableCell>
              <TableCell class="text-muted-foreground">{{ p.lastSessionDate ? formatDate(p.lastSessionDate) : '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ formatDate(p.createdAt) }}</TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    class="text-xs font-semibold text-primary hover:underline"
                    :data-testid="`view-patient-details-${p.id}`"
                    @click="openPatientDetails(p)"
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    class="text-xs font-semibold text-primary hover:underline"
                    :data-testid="`edit-patient-${p.id}`"
                    @click="openEditPatient(p)"
                  >
                    Update Profile
                  </button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>

    <!-- Pagination Controls -->
    <div
      v-if="patients.length > 0"
      class="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4"
    >
      <div class="text-xs font-medium text-muted-foreground">
        Showing
        <span class="font-semibold text-foreground">
          {{ Math.min((currentPage - 1) * pageSize + 1, patients.length) }}–{{ Math.min(currentPage * pageSize, patients.length) }}
        </span>
        of
        <span class="font-semibold text-foreground">{{ patients.length }}</span>
        patients
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
          v-for="p in totalPages"
          :key="p"
          type="button"
          class="flex size-8 items-center justify-center rounded-lg text-xs font-semibold transition-all"
          :class="currentPage === p
            ? 'bg-primary text-primary-foreground shadow-xs'
            : 'border border-border text-muted-foreground hover:bg-muted hover:text-foreground'"
          @click="currentPage = p"
        >
          {{ p }}
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

    <!-- Sticky / Floating Bulk Action Bar -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-12 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-12 opacity-0"
    >
      <div
        v-if="selectedIds.size > 0"
        class="fixed bottom-6 inset-x-0 z-40 mx-auto flex w-fit max-w-[90vw] flex-wrap items-center gap-2.5 sm:gap-3.5 rounded-2xl border border-border bg-card/95 px-4 sm:px-6 py-3 shadow-2xl backdrop-blur-md text-xs font-semibold text-foreground"
        data-testid="floating-bulk-bar"
      >
        <span class="rounded-full bg-primary/15 text-primary px-2.5 py-0.5 font-bold">
          {{ selectedIds.size }} selected
        </span>

        <div class="hidden sm:block h-4 w-px bg-border" />

        <Button
          size="sm"
          variant="outline"
          class="h-8 gap-1.5 text-xs"
          data-testid="floating-bulk-export"
          @click="exportSelectedCSV"
        >
          <Download class="size-3.5 text-primary" />
          Export CSV
        </Button>

        <button
          type="button"
          class="ml-1 p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Clear selection"
          @click="clearSelection"
        >
          <X class="size-4" />
        </button>
      </div>
    </Transition>

    <!-- Patient Details Slide-in Drawer (Matching Doctor & Booking Details) -->
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

      <!-- Slide-in Drawer -->
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-150 ease-in"
        leave-to-class="translate-x-full"
      >
        <aside
          v-if="detailOpen && detailPatient"
          class="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[380px] lg:w-[420px] flex-col border-l border-border bg-card text-card-foreground shadow-2xl"
          data-testid="patient-detail-drawer"
          role="dialog"
          aria-modal="true"
        >
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-border/80 px-6 py-4">
            <div class="flex items-center gap-2.5">
              <h2 class="text-base font-bold text-foreground">Patient Details</h2>
              <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300">
                Patient
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
            <!-- Profile Hero -->
            <div class="flex flex-col items-center text-center">
              <div class="relative">
                <img
                  v-if="detailPatient.photo"
                  :src="detailPatient.photo"
                  :alt="detailPatient.name"
                  class="size-20 rounded-full object-cover border-2 border-border/60 shadow-xs"
                />
                <div
                  v-else
                  class="flex size-20 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-2xl font-bold border-2 border-border/40 shadow-xs"
                >
                  {{ detailPatient.name.slice(0, 1).toUpperCase() }}
                </div>
              </div>
              <h3 class="mt-3.5 text-lg font-bold text-foreground">{{ detailPatient.name }}</h3>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Registered on {{ formatDateLong(detailPatient.createdAt) }}
              </p>
            </div>

            <!-- Contact Information -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Contact Information
              </p>
              <div class="rounded-2xl border border-border/70 bg-muted/20 divide-y divide-border/60 text-xs">
                <div class="flex items-center justify-between p-3.5">
                  <span class="flex items-center gap-2 text-muted-foreground">
                    <Mail class="size-3.5 text-primary" />
                    Email
                  </span>
                  <span class="font-medium text-foreground truncate max-w-[200px]">{{ detailPatient.email }}</span>
                </div>
                <div class="flex items-center justify-between p-3.5">
                  <span class="flex items-center gap-2 text-muted-foreground">
                    <Phone class="size-3.5 text-primary" />
                    Phone
                  </span>
                  <span class="font-medium text-foreground">{{ detailPatient.phone || 'Not provided' }}</span>
                </div>
              </div>
            </div>

            <!-- Session Metrics -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Session History
              </p>
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-2xl border border-border/70 bg-muted/20 p-3.5 text-center">
                  <p class="text-2xl font-bold text-foreground">{{ detailPatient.totalSessions }}</p>
                  <p class="mt-0.5 text-[11px] text-muted-foreground">Total Sessions</p>
                </div>
                <div class="rounded-2xl border border-border/70 bg-muted/20 p-3.5 text-center">
                  <p class="text-sm font-bold text-foreground truncate mt-1.5">
                    {{ detailPatient.lastSessionDate ? formatDate(detailPatient.lastSessionDate) : 'None' }}
                  </p>
                  <p class="mt-1 text-[11px] text-muted-foreground">Last Session</p>
                </div>
              </div>
            </div>

            <!-- Action Buttons in Drawer -->
            <div class="border-t border-border/80 pt-5 space-y-2.5">
              <Button
                variant="outline"
                class="w-full justify-center gap-2 text-xs font-semibold"
                data-testid="drawer-update-patient"
                @click="openEditPatient(detailPatient)"
              >
                <Edit class="size-3.5 text-primary" />
                Update Patient Profile
              </Button>

              <Button
                variant="default"
                class="w-full justify-center gap-2 text-xs font-semibold shadow-xs"
                as="a"
                :href="`/admin/patients/${detailPatient.id}`"
              >
                <Calendar class="size-4" />
                View Full Booking & Payment History
                <ExternalLink class="size-3.5 ml-auto opacity-70" />
              </Button>
            </div>
          </div>

          <!-- Drawer Footer -->
          <div class="border-t border-border/80 px-6 py-3.5 bg-muted/10 flex justify-end">
            <Button variant="outline" size="sm" class="text-xs" @click="detailOpen = false">
              Close
            </Button>
          </div>
        </aside>
      </Transition>
    </Teleport>

    <!-- Update Patient Profile Modal -->
    <Teleport to="body">
      <Dialog v-model:open="editPatientOpen">
        <DialogContent class="max-w-md" data-testid="edit-patient-dialog">
          <DialogHeader>
            <DialogTitle>Update Patient Profile</DialogTitle>
            <DialogDescription class="text-xs leading-relaxed mt-1">
              Update name or contact phone for this patient record.
            </DialogDescription>
          </DialogHeader>

          <form class="grid gap-4 py-2" @submit.prevent="submitEditPatient">
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-foreground" for="edit-patient-name">
                Name *
              </label>
              <Input
                id="edit-patient-name"
                v-model="editPatientForm.name"
                data-testid="edit-patient-name"
                required
              />
            </div>

            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-foreground" for="edit-patient-email">
                Email
              </label>
              <Input
                id="edit-patient-email"
                v-model="editPatientForm.email"
                type="email"
                disabled
                class="opacity-75 cursor-not-allowed bg-muted/50"
              />
              <p class="text-[11px] text-muted-foreground">
                Email is tied to patient credentials and cannot be edited.
              </p>
            </div>

            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-foreground" for="edit-patient-phone">
                Phone Number
              </label>
              <Input
                id="edit-patient-phone"
                v-model="editPatientForm.phone"
                type="tel"
                placeholder="+20 100 000 0000"
                data-testid="edit-patient-phone"
              />
            </div>

            <DialogFooter class="mt-4 gap-2">
              <Button type="button" variant="outline" @click="editPatientOpen = false">
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="save-patient-profile-btn"
                :disabled="savingPatient || !editPatientForm.name.trim()"
              >
                {{ savingPatient ? 'Saving…' : 'Save Changes' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>
