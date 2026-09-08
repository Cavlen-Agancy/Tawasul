<script setup lang="ts">
import {
  LayoutGrid,
  List as ListIcon,
  Mail,
  CalendarDays,
  MoreVertical,
  UserX,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Phone,
  ExternalLink,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Ban,
  Download,
  Users,
  FileSpreadsheet,
  Plus,
  Trash2,
} from 'lucide-vue-next'
import type { AdminDoctor } from '~/modules/admin/composables/types'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'DOCTORS', action: 'READ' },
})

const { doctors, loading, error, fetchDoctors, createDoctor, updateDoctor, fetchDoctor, deleteDoctor } = useAdminDashboard()
const { hasPermission } = useAuth()
const { toast } = useToast()

const search = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const currentPage = ref(1)
const activeMenuId = ref<string | null>(null)
const bulkMenuOpen = ref(false)
const bulkOperating = ref(false)

// Delete Doctor Confirmation state
const deleteTarget = ref<AdminDoctor | null>(null)
const deleteDialogOpen = ref(false)
const deleting = ref(false)

// Multi-selection state for bulk actions
const selectedIds = ref<Set<string>>(new Set())

// Detail Drawer state
const detailOpen = ref(false)
const detailDoctor = ref<(AdminDoctor & { bio?: string | null }) | null>(null)
const loadingDetail = ref(false)

// Add Doctor Modal state
const addOpen = ref(false)
const editOpen = ref(false)
const saving = ref(false)

const addForm = ref({ name: '', email: '', password: '' })
const editId = ref('')
const editForm = ref({ name: '', email: '', isActive: true })

// Bulk Add Doctors Modal state
const bulkAddOpen = ref(false)
const bulkAddSaving = ref(false)
const bulkRows = ref<Array<{ name: string; email: string; password: string }>>([
  { name: '', email: '', password: '' },
  { name: '', email: '', password: '' },
])

const canCreate = computed(() => hasPermission('DOCTORS', 'CREATE'))
const canUpdate = computed(() => hasPermission('DOCTORS', 'UPDATE'))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return doctors.value
  return doctors.value.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      (d.email ?? '').toLowerCase().includes(q),
  )
})

const pageSize = computed(() => (viewMode.value === 'grid' ? 12 : 20))
const totalPages = computed(() => Math.ceil(filtered.value.length / pageSize.value) || 1)

const paginatedDoctors = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const isAllSelected = computed(() => {
  if (paginatedDoctors.value.length === 0) return false
  return paginatedDoctors.value.every((d) => selectedIds.value.has(d.id))
})

watch([search, viewMode], () => {
  currentPage.value = 1
  activeMenuId.value = null
  bulkMenuOpen.value = false
})

function closeAllMenus() {
  activeMenuId.value = null
  bulkMenuOpen.value = false
}

function toggleMenu(id: string, event?: Event) {
  if (event) event.stopPropagation()
  bulkMenuOpen.value = false
  activeMenuId.value = activeMenuId.value === id ? null : id
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
    for (const d of paginatedDoctors.value) {
      next.delete(d.id)
    }
  } else {
    for (const d of paginatedDoctors.value) {
      next.add(d.id)
    }
  }
  selectedIds.value = next
}

function clearSelection() {
  selectedIds.value = new Set()
  bulkMenuOpen.value = false
}

// Bulk Actions: Activate / Deactivate / Export
async function bulkActivate() {
  if (selectedIds.value.size === 0) return
  bulkOperating.value = true
  bulkMenuOpen.value = false

  const targets = doctors.value.filter((d) => selectedIds.value.has(d.id) && !d.isActive)
  if (targets.length === 0) {
    toast({ title: 'Selected doctors are already active', variant: 'default' })
    bulkOperating.value = false
    return
  }

  try {
    let successCount = 0
    for (const d of targets) {
      const ok = await updateDoctor(d.id, { isActive: true })
      if (ok) successCount++
    }
    toast({
      title: `Activated ${successCount} doctor${successCount > 1 ? 's' : ''}`,
      variant: 'success',
    })
    clearSelection()
  } catch {
    toast({ title: 'Could not complete all activations', variant: 'destructive' })
  } finally {
    bulkOperating.value = false
  }
}

async function bulkDeactivate() {
  if (selectedIds.value.size === 0) return
  bulkOperating.value = true
  bulkMenuOpen.value = false

  const targets = doctors.value.filter((d) => selectedIds.value.has(d.id) && d.isActive)
  if (targets.length === 0) {
    toast({ title: 'Selected doctors are already inactive', variant: 'default' })
    bulkOperating.value = false
    return
  }

  try {
    let successCount = 0
    for (const d of targets) {
      const ok = await updateDoctor(d.id, { isActive: false })
      if (ok) successCount++
    }
    toast({
      title: `Deactivated ${successCount} doctor${successCount > 1 ? 's' : ''}`,
      variant: 'success',
    })
    clearSelection()
  } catch {
    toast({ title: 'Could not complete all deactivations', variant: 'destructive' })
  } finally {
    bulkOperating.value = false
  }
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
  const selectedDocs = doctors.value.filter((d) => selectedIds.value.has(d.id))
  if (selectedDocs.length === 0) return

  const headers = ['Name', 'Email', 'Status', 'Specializations', 'Sessions This Month', 'All-Time Sessions']
  const rows = selectedDocs.map((d) => [
    `"${d.name.replace(/"/g, '""')}"`,
    `"${(d.email || '').replace(/"/g, '""')}"`,
    d.isActive ? 'Active' : 'Inactive',
    `"${(d.specializations || []).join(', ').replace(/"/g, '""')}"`,
    d.sessionCountThisMonth ?? 0,
    d.sessionCountAllTime ?? 0,
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  downloadCSV(csv, `tawasul-doctors-selected-${new Date().toISOString().slice(0, 10)}.csv`)
  toast({ title: `Exported ${selectedDocs.length} doctors to CSV`, variant: 'success' })
  bulkMenuOpen.value = false
}

function exportAllCSV() {
  const headers = ['Name', 'Email', 'Status', 'Specializations', 'Sessions This Month', 'All-Time Sessions']
  const rows = doctors.value.map((d) => [
    `"${d.name.replace(/"/g, '""')}"`,
    `"${(d.email || '').replace(/"/g, '""')}"`,
    d.isActive ? 'Active' : 'Inactive',
    `"${(d.specializations || []).join(', ').replace(/"/g, '""')}"`,
    d.sessionCountThisMonth ?? 0,
    d.sessionCountAllTime ?? 0,
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  downloadCSV(csv, `tawasul-all-doctors-${new Date().toISOString().slice(0, 10)}.csv`)
  toast({ title: `Exported ${doctors.value.length} doctors to CSV`, variant: 'success' })
  bulkMenuOpen.value = false
}

// Bulk Add Doctors
function openBulkAddModal() {
  bulkMenuOpen.value = false
  bulkRows.value = [
    { name: '', email: '', password: '' },
    { name: '', email: '', password: '' },
  ]
  bulkAddOpen.value = true
}

function addBulkRow() {
  bulkRows.value.push({ name: '', email: '', password: '' })
}

function removeBulkRow(index: number) {
  if (bulkRows.value.length > 1) {
    bulkRows.value.splice(index, 1)
  }
}

async function submitBulkAdd() {
  const valid = bulkRows.value.filter(
    (r) => r.name.trim().length >= 2 && r.email.trim().length > 0 && r.password.length >= 8,
  )
  if (valid.length === 0) {
    toast({
      title: 'Please fill in at least one valid row (Name min 2, valid Email, Password min 8 chars)',
      variant: 'destructive',
    })
    return
  }

  bulkAddSaving.value = true
  let successCount = 0
  for (const r of valid) {
    try {
      const ok = await createDoctor({
        name: r.name.trim(),
        email: r.email.trim(),
        password: r.password,
      } as any)
      if (ok) successCount++
    } catch {
      // Continue next row
    }
  }
  bulkAddSaving.value = false

  if (successCount > 0) {
    toast({
      title: `Successfully created ${successCount} doctor${successCount > 1 ? 's' : ''}`,
      variant: 'success',
    })
    bulkAddOpen.value = false
    await fetchDoctors()
  } else {
    toast({
      title: 'Failed to create doctors. Please verify emails and try again.',
      variant: 'destructive',
    })
  }
}

// Single Doctor Drawer & Modals
async function openDoctorDetails(d: AdminDoctor) {
  closeAllMenus()
  detailDoctor.value = { ...d }
  detailOpen.value = true
  loadingDetail.value = true
  try {
    const full = await fetchDoctor(d.id)
    if (full && detailDoctor.value?.id === d.id) {
      detailDoctor.value = {
        ...detailDoctor.value,
        bio: full.bio,
        phone: full.phone || detailDoctor.value.phone,
        specializations: full.specializations || detailDoctor.value.specializations,
      }
    }
  } catch {
    // Keep baseline doctor data
  } finally {
    loadingDetail.value = false
  }
}

function openAdd() {
  closeAllMenus()
  addForm.value = { name: '', email: '', password: '' }
  addOpen.value = true
}

async function submitAdd() {
  if (!addForm.value.name || !addForm.value.email || addForm.value.password.length < 8) return
  saving.value = true
  try {
    const ok = await createDoctor({
      name: addForm.value.name,
      email: addForm.value.email,
      password: addForm.value.password,
    } as any)
    if (ok) {
      toast({ title: 'Doctor created. Credentials sent to their email.', variant: 'success' })
      addOpen.value = false
      addForm.value = { name: '', email: '', password: '' }
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not create doctor',
      variant: 'destructive',
    })
  } finally {
    saving.value = false
  }
}

function openEdit(id: string) {
  closeAllMenus()
  const d = doctors.value.find((x) => x.id === id)
  if (!d) return
  editId.value = id
  editForm.value = {
    name: d.name,
    email: d.email ?? '',
    isActive: d.isActive,
  }
  editOpen.value = true
}

async function submitEdit() {
  if (!editForm.value.name) return
  saving.value = true
  try {
    const ok = await updateDoctor(editId.value, {
      name: editForm.value.name,
      isActive: editForm.value.isActive,
    })
    if (ok) {
      toast({ title: 'Doctor updated', variant: 'success' })
      if (detailDoctor.value && detailDoctor.value.id === editId.value) {
        detailDoctor.value.name = editForm.value.name
        detailDoctor.value.isActive = editForm.value.isActive
      }
      editOpen.value = false
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not update doctor',
      variant: 'destructive',
    })
  } finally {
    saving.value = false
  }
}

async function toggleActive(id: string, isActive: boolean) {
  closeAllMenus()
  try {
    const ok = await updateDoctor(id, { isActive: !isActive })
    if (ok) {
      toast({
        title: !isActive ? 'Doctor activated' : 'Doctor deactivated',
        variant: 'success',
      })
      if (detailDoctor.value && detailDoctor.value.id === id) {
        detailDoctor.value.isActive = !isActive
      }
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not update doctor',
      variant: 'destructive',
    })
  }
}

function openDeleteDoctor(d: AdminDoctor) {
  closeAllMenus()
  deleteTarget.value = d
  deleteDialogOpen.value = true
}

async function confirmDeleteDoctor() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const ok = await deleteDoctor(deleteTarget.value.id)
    if (ok) {
      toast({ title: 'Doctor profile removed successfully', variant: 'success' })
      if (detailDoctor.value?.id === deleteTarget.value.id) {
        detailOpen.value = false
        detailDoctor.value = null
      }
      if (selectedIds.value.has(deleteTarget.value.id)) {
        selectedIds.value.delete(deleteTarget.value.id)
      }
      deleteDialogOpen.value = false
      deleteTarget.value = null
    } else {
      toast({ title: 'Could not remove doctor profile', variant: 'destructive' })
    }
  } catch (e: unknown) {
    toast({
      title: (e as { data?: { message?: string } })?.data?.message || 'Could not remove doctor profile',
      variant: 'destructive',
    })
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void fetchDoctors()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1360px] p-4 md:p-8" @click="closeAllMenus">
    <!-- Page Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground" data-testid="page-title">
          Manage Doctors
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          View, assign, and manage doctors across the academy.
        </p>
      </div>

      <!-- Action Buttons in Header: Bulk Actions & Add Doctor -->
      <div class="flex items-center gap-2.5">
        <!-- Bulk Actions Button Dropdown -->
        <div v-if="canUpdate" class="relative">
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
                Selected Doctors ({{ selectedIds.size }})
              </div>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
                :disabled="selectedIds.size === 0 || bulkOperating"
                data-testid="bulk-activate-opt"
                @click="bulkActivate"
              >
                <CheckCircle2 class="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Activate Selected</span>
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
                :disabled="selectedIds.size === 0 || bulkOperating"
                data-testid="bulk-deactivate-opt"
                @click="bulkDeactivate"
              >
                <Ban class="size-4 text-destructive" />
                <span>Deactivate Selected</span>
              </button>
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
                Bulk Management
              </div>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted text-foreground"
                data-testid="bulk-add-doctors-opt"
                @click="openBulkAddModal"
              >
                <Users class="size-4 text-primary" />
                <span>Bulk Add Doctors</span>
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted text-foreground"
                data-testid="export-all-opt"
                @click="exportAllCSV"
              >
                <FileSpreadsheet class="size-4 text-muted-foreground" />
                <span>Export All Doctors (CSV)</span>
              </button>
            </div>
          </Transition>
        </div>

        <!-- Add Doctor Button -->
        <Button v-if="canCreate" data-testid="add-doctor" class="gap-2 shadow-xs" @click="openAdd">
          <UserPlus class="size-4" />
          Add Doctor
        </Button>
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
          data-testid="doctor-search"
          class="h-11 pl-10 pr-9 rounded-xl bg-card border-border"
        />
        <button
          v-if="search"
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
          @click="search = ''"
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
    <div v-if="loading && doctors.length === 0" class="mt-6">
      <div v-if="viewMode === 'grid'" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Skeleton v-for="i in 8" :key="i" class="h-64 w-full rounded-2xl" />
      </div>
      <div v-else class="space-y-3">
        <Skeleton v-for="i in 6" :key="i" class="h-16 w-full rounded-xl" />
      </div>
    </div>

    <!-- Empty State: No results for search -->
    <div
      v-else-if="filtered.length === 0 && search.trim()"
      class="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
      data-testid="empty-search-state"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserX class="size-7" />
      </div>
      <h2 class="mt-4 text-lg font-bold text-foreground">No doctors found</h2>
      <p class="mt-1 text-sm text-muted-foreground max-w-sm">
        No doctor records match "<span class="font-medium text-foreground">{{ search }}</span>". Try a different name or email.
      </p>
      <Button variant="outline" size="sm" class="mt-5 gap-1.5" @click="search = ''">
        <X class="size-3.5" />
        Clear Search
      </Button>
    </div>

    <!-- Empty State: No doctors at all -->
    <div
      v-else-if="doctors.length === 0"
      class="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
      data-testid="empty-doctors-state"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UserPlus class="size-7" />
      </div>
      <h2 class="mt-4 text-lg font-bold text-foreground">No doctors yet</h2>
      <p class="mt-1 text-sm text-muted-foreground max-w-sm">
        Add your first doctor to get started with appointment assignments and scheduling.
      </p>
      <Button v-if="canCreate" size="sm" class="mt-5 gap-2" @click="openAdd">
        <UserPlus class="size-4" />
        Add Doctor
      </Button>
    </div>

    <!-- Content: Grid View -->
    <div v-else-if="viewMode === 'grid'" class="mt-6">
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="d in paginatedDoctors"
          :key="d.id"
          class="group relative flex flex-col justify-between rounded-2xl border border-[#EBEBEB] dark:border-border bg-[#FAFAFA] dark:bg-card p-6 shadow-soft hover:shadow-medium transition-all duration-150 ease-out"
          :class="{ 'ring-2 ring-primary bg-primary/5 dark:bg-primary/10': selectedIds.has(d.id) }"
          :data-testid="`doctor-card-${d.id}`"
        >
          <!-- Top Row: Checkbox, Status Badge & 3-Dot Menu -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <input
                type="checkbox"
                :checked="selectedIds.has(d.id)"
                class="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                aria-label="Select doctor"
                :data-testid="`select-doctor-${d.id}`"
                @click.stop="toggleSelect(d.id, $event)"
              />
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="d.isActive
                  ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300'
                  : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-muted dark:text-muted-foreground'"
              >
                {{ d.isActive ? 'ACTIVE' : 'INACTIVE' }}
              </span>
            </div>

            <!-- 3-Dot Menu -->
            <div v-if="canUpdate" class="relative">
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Doctor options"
                :data-testid="`doctor-menu-btn-${d.id}`"
                @click="toggleMenu(d.id, $event)"
              >
                <MoreVertical class="size-4" />
              </button>

              <!-- Dropdown Menu -->
              <div
                v-if="activeMenuId === d.id"
                class="absolute right-0 top-9 z-30 w-36 rounded-xl border border-border bg-card p-1 shadow-lg text-xs"
                @click.stop
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium transition-colors"
                  :class="d.isActive
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'"
                  :data-testid="`toggle-doctor-${d.id}`"
                  @click="toggleActive(d.id, d.isActive)"
                >
                  {{ d.isActive ? 'Deactivate' : 'Activate' }}
                </button>
                <div class="my-1 border-t border-border/80" />
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium transition-colors text-destructive hover:bg-destructive/10"
                  :data-testid="`delete-doctor-${d.id}`"
                  @click="openDeleteDoctor(d)"
                >
                  <Trash2 class="size-3.5" />
                  <span>Remove Doctor</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Doctor Profile Center -->
          <div class="mt-4 flex flex-col items-center text-center">
            <!-- 64px Avatar -->
            <div class="relative">
              <img
                v-if="d.photo"
                :src="d.photo"
                :alt="d.name"
                class="size-16 rounded-full object-cover border-2 border-border/60 shadow-xs"
              />
              <div
                v-else
                class="flex size-16 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-xl font-bold border-2 border-border/40 shadow-xs"
              >
                {{ d.name.slice(0, 1).toUpperCase() }}
              </div>
            </div>

            <!-- Doctor Name -->
            <h3 class="mt-3.5 text-base font-bold text-foreground truncate w-full" :title="d.name">
              {{ d.name }}
            </h3>

            <!-- Specialization -->
            <p class="mt-0.5 text-xs text-muted-foreground truncate w-full">
              {{ d.specializations?.[0] || 'Mental Health Specialist' }}
            </p>
          </div>

          <!-- Divider -->
          <div class="my-4 border-t border-border/80" />

          <!-- Email and Session Count -->
          <div class="space-y-2 text-xs text-muted-foreground">
            <div class="flex items-center gap-2 truncate" :title="d.email">
              <Mail class="size-3.5 shrink-0 text-muted-foreground/80" />
              <span class="truncate">{{ d.email }}</span>
            </div>
            <div class="flex items-center gap-2 truncate">
              <CalendarDays class="size-3.5 shrink-0 text-muted-foreground/80" />
              <span>{{ d.sessionCountThisMonth ?? 0 }} sessions this month</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-5 flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              class="flex-1 text-xs font-semibold"
              :data-testid="`view-doctor-${d.id}`"
              @click="openDoctorDetails(d)"
            >
              View Details
            </Button>
            <Button
              v-if="canUpdate"
              variant="outline"
              size="sm"
              class="flex-1 text-xs font-semibold"
              :data-testid="`edit-doctor-${d.id}`"
              @click="openEdit(d.id)"
            >
              Edit
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
                  aria-label="Select all doctors on this page"
                  data-testid="select-all-doctors"
                  @click.stop="toggleSelectAll"
                />
              </TableHead>
              <TableHead class="w-16">Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Specializations</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sessions This Month</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="(d, index) in paginatedDoctors"
              :key="d.id"
              :data-testid="`doctor-row-${d.id}`"
              class="transition-colors hover:bg-[#FCE4F3]/40 dark:hover:bg-primary/10"
              :class="[
                selectedIds.has(d.id) ? 'bg-primary/5 dark:bg-primary/10' : index % 2 === 0 ? 'bg-white dark:bg-card' : 'bg-[#FAFAFA] dark:bg-muted/20',
              ]"
            >
              <TableCell>
                <input
                  type="checkbox"
                  :checked="selectedIds.has(d.id)"
                  class="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                  aria-label="Select doctor"
                  :data-testid="`select-doctor-row-${d.id}`"
                  @click.stop="toggleSelect(d.id, $event)"
                />
              </TableCell>
              <TableCell>
                <div class="relative">
                  <img
                    v-if="d.photo"
                    :src="d.photo"
                    :alt="d.name"
                    class="size-9 rounded-full object-cover border border-border"
                  />
                  <div
                    v-else
                    class="flex size-9 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-sm font-bold"
                  >
                    {{ d.name.slice(0, 1).toUpperCase() }}
                  </div>
                </div>
              </TableCell>
              <TableCell class="font-bold text-foreground">{{ d.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ d.email }}</TableCell>
              <TableCell>
                <div class="flex max-w-[240px] flex-wrap gap-1">
                  <Badge
                    v-for="s in (d.specializations ?? []).slice(0, 2)"
                    :key="s"
                    variant="secondary"
                    class="text-[11px]"
                  >
                    {{ s }}
                  </Badge>
                  <span v-if="!d.specializations?.length" class="text-xs text-muted-foreground italic">
                    General
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  :class="d.isActive
                    ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300'
                    : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-muted dark:text-muted-foreground'"
                >
                  {{ d.isActive ? 'Active' : 'Inactive' }}
                </span>
              </TableCell>
              <TableCell class="font-medium text-foreground">{{ d.sessionCountThisMonth ?? 0 }}</TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    class="text-xs font-semibold text-primary hover:underline"
                    :data-testid="`view-doctor-${d.id}`"
                    @click="openDoctorDetails(d)"
                  >
                    View Details
                  </button>
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="text-xs font-semibold text-primary hover:underline"
                    :data-testid="`edit-doctor-${d.id}`"
                    @click="openEdit(d.id)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="text-xs font-semibold hover:underline"
                    :class="d.isActive ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'"
                    :data-testid="`toggle-doctor-${d.id}`"
                    @click="toggleActive(d.id, d.isActive)"
                  >
                    {{ d.isActive ? 'Deactivate' : 'Activate' }}
                  </button>
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="text-xs font-semibold text-destructive hover:underline"
                    :data-testid="`delete-doctor-${d.id}`"
                    @click="openDeleteDoctor(d)"
                  >
                    Remove
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
      v-if="filtered.length > 0"
      class="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4"
    >
      <div class="text-xs font-medium text-muted-foreground">
        Showing
        <span class="font-semibold text-foreground">
          {{ Math.min((currentPage - 1) * pageSize + 1, filtered.length) }}–{{ Math.min(currentPage * pageSize, filtered.length) }}
        </span>
        of
        <span class="font-semibold text-foreground">{{ filtered.length }}</span>
        doctors
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
          class="h-8 gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          :disabled="bulkOperating"
          data-testid="floating-bulk-activate"
          @click="bulkActivate"
        >
          <CheckCircle2 class="size-3.5" />
          Activate
        </Button>

        <Button
          size="sm"
          variant="outline"
          class="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
          :disabled="bulkOperating"
          data-testid="floating-bulk-deactivate"
          @click="bulkDeactivate"
        >
          <Ban class="size-3.5" />
          Deactivate
        </Button>

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

    <!-- Doctor Details Slide-in Drawer (Like Booking Details) -->
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
          v-if="detailOpen && detailDoctor"
          class="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[380px] lg:w-[420px] flex-col border-l border-border bg-card text-card-foreground shadow-2xl"
          data-testid="doctor-detail-drawer"
          role="dialog"
          aria-modal="true"
        >
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-border/80 px-6 py-4">
            <div class="flex items-center gap-2.5">
              <h2 class="text-base font-bold text-foreground">Doctor Details</h2>
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="detailDoctor.isActive
                  ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300'
                  : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-muted dark:text-muted-foreground'"
              >
                {{ detailDoctor.isActive ? 'Active' : 'Inactive' }}
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
                  v-if="detailDoctor.photo"
                  :src="detailDoctor.photo"
                  :alt="detailDoctor.name"
                  class="size-20 rounded-full object-cover border-2 border-border/60 shadow-xs"
                />
                <div
                  v-else
                  class="flex size-20 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-2xl font-bold border-2 border-border/40 shadow-xs"
                >
                  {{ detailDoctor.name.slice(0, 1).toUpperCase() }}
                </div>
              </div>
              <h3 class="mt-3.5 text-lg font-bold text-foreground">{{ detailDoctor.name }}</h3>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ detailDoctor.specializations?.[0] || 'Mental Health Specialist' }}
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
                  <span class="font-medium text-foreground truncate max-w-[200px]">{{ detailDoctor.email }}</span>
                </div>
                <div class="flex items-center justify-between p-3.5">
                  <span class="flex items-center gap-2 text-muted-foreground">
                    <Phone class="size-3.5 text-primary" />
                    Phone
                  </span>
                  <span class="font-medium text-foreground">{{ detailDoctor.phone || 'Not provided' }}</span>
                </div>
              </div>
            </div>

            <!-- Session Metrics -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Session Metrics
              </p>
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-2xl border border-border/70 bg-muted/20 p-3.5 text-center">
                  <p class="text-2xl font-bold text-foreground">{{ detailDoctor.sessionCountThisMonth ?? 0 }}</p>
                  <p class="mt-0.5 text-[11px] text-muted-foreground">This Month</p>
                </div>
                <div class="rounded-2xl border border-border/70 bg-muted/20 p-3.5 text-center">
                  <p class="text-2xl font-bold text-foreground">{{ detailDoctor.sessionCountAllTime ?? 0 }}</p>
                  <p class="mt-0.5 text-[11px] text-muted-foreground">All-Time</p>
                </div>
              </div>
            </div>

            <!-- Biography -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Biography
              </p>
              <div class="rounded-2xl border border-border/70 bg-muted/20 p-3.5 text-xs leading-relaxed text-foreground">
                <p v-if="detailDoctor.bio">{{ detailDoctor.bio }}</p>
                <p v-else class="text-muted-foreground italic">
                  No biography provided yet. The doctor can update their bio upon login.
                </p>
              </div>
            </div>

            <!-- Specializations -->
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Specializations
              </p>
              <div class="flex flex-wrap gap-1.5">
                <Badge
                  v-for="s in (detailDoctor.specializations ?? [])"
                  :key="s"
                  variant="secondary"
                  class="text-xs"
                >
                  {{ s }}
                </Badge>
                <span v-if="!detailDoctor.specializations?.length" class="text-xs text-muted-foreground italic">
                  No specific specializations added.
                </span>
              </div>
            </div>

            <!-- Quick Management Actions -->
            <div class="border-t border-border/80 pt-5 space-y-2.5">
              <Button
                variant="default"
                class="w-full justify-center gap-2 text-xs font-semibold shadow-xs"
                as="a"
                :href="`/admin/doctors/${detailDoctor.id}`"
              >
                <CalendarDays class="size-4" />
                View Full Calendar & Schedule
                <ExternalLink class="size-3.5 ml-auto opacity-70" />
              </Button>

              <div class="flex items-center gap-2">
                <Button
                  v-if="canUpdate"
                  variant="outline"
                  size="sm"
                  class="flex-1 text-xs"
                  @click="openEdit(detailDoctor.id)"
                >
                  Edit Doctor
                </Button>
                <Button
                  v-if="canUpdate"
                  variant="outline"
                  size="sm"
                  class="flex-1 text-xs"
                  :class="detailDoctor.isActive ? 'text-destructive hover:bg-destructive/10' : 'text-emerald-600 dark:text-emerald-400'"
                  @click="toggleActive(detailDoctor.id, detailDoctor.isActive)"
                >
                  {{ detailDoctor.isActive ? 'Deactivate' : 'Activate' }}
                </Button>
              </div>

              <Button
                v-if="canUpdate"
                variant="outline"
                size="sm"
                class="w-full text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1.5"
                data-testid="detail-remove-doctor"
                @click="openDeleteDoctor(detailDoctor)"
              >
                <Trash2 class="size-3.5" />
                Remove Doctor Profile
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

    <!-- Bulk Add Doctors Modal -->
    <Teleport to="body">
      <Dialog v-model:open="bulkAddOpen">
        <DialogContent class="max-w-2xl" data-testid="bulk-add-doctors-dialog">
          <DialogHeader>
            <DialogTitle>Bulk Add Doctors</DialogTitle>
            <DialogDescription class="text-xs leading-relaxed mt-1">
              Add multiple doctors at once. Login credentials will be emailed to each doctor automatically.
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-3 py-2 max-h-[50vh] overflow-y-auto pr-1">
            <div
              v-for="(row, idx) in bulkRows"
              :key="idx"
              class="flex flex-col sm:flex-row items-start sm:items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-3"
            >
              <div class="w-full sm:flex-1 space-y-1">
                <label class="block text-[11px] font-medium text-muted-foreground sm:hidden">Name *</label>
                <Input
                  v-model="row.name"
                  placeholder="Doctor Name (e.g. Dr. Jane Doe)"
                  class="h-9 text-xs"
                  required
                />
              </div>
              <div class="w-full sm:flex-1 space-y-1">
                <label class="block text-[11px] font-medium text-muted-foreground sm:hidden">Email *</label>
                <Input
                  v-model="row.email"
                  type="email"
                  placeholder="Email (e.g. jane@tawasul.com)"
                  class="h-9 text-xs"
                  required
                />
              </div>
              <div class="w-full sm:flex-1 space-y-1">
                <label class="block text-[11px] font-medium text-muted-foreground sm:hidden">Password * (min 8)</label>
                <Input
                  v-model="row.password"
                  type="password"
                  placeholder="Password (min 8 chars)"
                  class="h-9 text-xs"
                  required
                />
              </div>
              <button
                v-if="bulkRows.length > 1"
                type="button"
                class="size-8 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Remove row"
                @click="removeBulkRow(idx)"
              >
                <Trash2 class="size-4" />
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-border/70 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="gap-1.5 text-xs"
              @click="addBulkRow"
            >
              <Plus class="size-3.5" />
              Add Row
            </Button>

            <div class="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" @click="bulkAddOpen = false">
                Cancel
              </Button>
              <Button
                size="sm"
                class="gap-1.5 text-xs"
                :disabled="bulkAddSaving"
                @click="submitBulkAdd"
              >
                <span v-if="bulkAddSaving" class="size-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                {{ bulkAddSaving ? 'Adding Doctors…' : `Add ${bulkRows.length} Doctors` }}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Teleport>

    <!-- Add Doctor Modal (Name, Email, Password only) -->
    <Teleport to="body">
      <Dialog v-model:open="addOpen">
        <DialogContent class="max-w-md" data-testid="add-doctor-dialog">
          <DialogHeader>
            <DialogTitle>Add Doctor</DialogTitle>
            <DialogDescription class="text-xs leading-relaxed mt-1">
              These credentials will be emailed to the doctor.<br />
              They can complete their profile after logging in.
            </DialogDescription>
          </DialogHeader>

          <form class="grid gap-4 py-2" @submit.prevent="submitAdd">
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-foreground" for="add-name">
                Name *
              </label>
              <Input
                id="add-name"
                v-model="addForm.name"
                placeholder="Dr. Ahmed Hassan"
                data-testid="add-doctor-name"
                required
              />
            </div>

            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-foreground" for="add-email">
                Email *
              </label>
              <Input
                id="add-email"
                v-model="addForm.email"
                type="email"
                placeholder="ahmed@tawasul.com"
                data-testid="add-doctor-email"
                required
              />
            </div>

            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-foreground" for="add-password">
                Password *
              </label>
              <Input
                id="add-password"
                v-model="addForm.password"
                type="password"
                placeholder="Minimum 8 characters"
                data-testid="add-doctor-password"
                required
                minlength="8"
              />
              <p class="text-[11px] text-muted-foreground">
                Admin sets this manually. The doctor receives it in their welcome email.
              </p>
            </div>

            <DialogFooter class="mt-4 gap-2">
              <Button type="button" variant="outline" @click="addOpen = false">Cancel</Button>
              <Button
                type="submit"
                data-testid="add-doctor-submit"
                :disabled="saving || !addForm.name || !addForm.email || addForm.password.length < 8"
              >
                {{ saving ? 'Creating…' : 'Create Doctor' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Teleport>

    <!-- Edit Doctor Modal (Name, Email, Status only) -->
    <Teleport to="body">
      <Dialog v-model:open="editOpen">
        <DialogContent class="max-w-md" data-testid="edit-doctor-dialog">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
          </DialogHeader>

          <form class="grid gap-4 py-2" @submit.prevent="submitEdit">
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-foreground" for="edit-name">
                Name *
              </label>
              <Input
                id="edit-name"
                v-model="editForm.name"
                data-testid="edit-doctor-name"
                required
              />
            </div>

            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-foreground" for="edit-email">
                Email *
              </label>
              <Input
                id="edit-email"
                v-model="editForm.email"
                type="email"
                data-testid="edit-doctor-email"
                disabled
                class="opacity-75 cursor-not-allowed bg-muted/50"
              />
              <p class="text-[11px] text-muted-foreground">
                Email is tied to account credentials and managed via security settings.
              </p>
            </div>

            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-foreground" for="edit-status">
                Status
              </label>
              <select
                id="edit-status"
                v-model="editForm.isActive"
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                data-testid="edit-doctor-status"
              >
                <option :value="true">Active</option>
                <option :value="false">Inactive</option>
              </select>
            </div>

            <DialogFooter class="mt-4 gap-2">
              <Button type="button" variant="outline" @click="editOpen = false">Cancel</Button>
              <Button
                type="submit"
                data-testid="edit-doctor-submit"
                :disabled="saving || !editForm.name"
              >
                {{ saving ? 'Saving…' : 'Save Changes' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Teleport>

    <!-- Delete Doctor Confirmation Dialog -->
    <Teleport to="body">
      <Dialog v-model:open="deleteDialogOpen">
        <DialogContent class="max-w-md" data-testid="delete-doctor-dialog">
          <DialogHeader>
            <DialogTitle>Remove Doctor Profile</DialogTitle>
            <DialogDescription class="text-xs leading-relaxed mt-1">
              Are you sure you want to remove <strong class="text-foreground">{{ deleteTarget?.name }}</strong>'s doctor profile?
              This will permanently delete their profile, specializations, and login access. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter class="mt-4 gap-2">
            <Button type="button" variant="outline" @click="deleteDialogOpen = false">
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="confirm-delete-doctor-btn"
              :disabled="deleting"
              @click="confirmDeleteDoctor"
            >
              <span v-if="deleting" class="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
              {{ deleting ? 'Removing…' : 'Remove Doctor Profile' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>
