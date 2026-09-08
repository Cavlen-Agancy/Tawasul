<script setup lang="ts">
import {
  LayoutGrid,
  List as ListIcon,
  Mail,
  Phone,
  UserCheck,
  UserX,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  ShieldCheck,
  Shield,
  Key,
  MoreVertical,
  Download,
  FileSpreadsheet,
  Lock,
  Unlock,
  CheckCircle2,
  Ban,
  Sparkles,
  ChevronDown,
} from 'lucide-vue-next'
import type { AdminStaffMember } from '~/modules/admin/composables/types'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'STAFF', action: 'READ' },
})

const { staff, loading, error, fetchStaff, createStaff, updateStaff, deactivateStaff } = useAdminDashboard()
const { hasPermission } = useAuth()
const { toast } = useToast()

const search = ref('')
const statusFilter = ref<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
const viewMode = ref<'grid' | 'list'>('grid')
const currentPage = ref(1)
const activeMenuId = ref<string | null>(null)
const bulkMenuOpen = ref(false)

// Detail Drawer state
const detailOpen = ref(false)
const detailStaff = ref<AdminStaffMember | null>(null)

// Add & Edit modal state
const addOpen = ref(false)
const editOpen = ref(false)
const deactivateOpen = ref(false)
const saving = ref(false)

const addForm = ref({
  name: '',
  email: '',
  password: '',
  phone: '',
  permissions: [] as Array<{ resource: string; action: string }>,
})
const editId = ref('')
const editForm = ref({
  name: '',
  phone: '',
  isActive: true,
  permissions: [] as Array<{ resource: string; action: string }>,
})
const deactivateId = ref('')
const deactivateTargetName = ref('')

const canCreate = computed(() => hasPermission('STAFF', 'CREATE'))
const canUpdate = computed(() => hasPermission('STAFF', 'UPDATE'))
const canDelete = computed(() => hasPermission('STAFF', 'DELETE'))

// Multi-selection for bulk export
const selectedIds = ref<Set<string>>(new Set())

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return staff.value.filter((s) => {
    // Status filter
    if (statusFilter.value === 'ACTIVE' && !s.isActive) return false
    if (statusFilter.value === 'INACTIVE' && s.isActive) return false

    // Search query filter
    if (!q) return true
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      permsSummary(s.permissions ?? []).toLowerCase().includes(q)
    )
  })
})

const pageSize = computed(() => (viewMode.value === 'grid' ? 12 : 20))
const totalPages = computed(() => Math.ceil(filtered.value.length / pageSize.value) || 1)

const paginatedStaff = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const isAllSelected = computed(() => {
  if (paginatedStaff.value.length === 0) return false
  return paginatedStaff.value.every((s) => selectedIds.value.has(s.id))
})

watch([search, statusFilter, viewMode], () => {
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
    for (const s of paginatedStaff.value) {
      next.delete(s.id)
    }
  } else {
    for (const s of paginatedStaff.value) {
      next.add(s.id)
    }
  }
  selectedIds.value = next
}

function clearSelection() {
  selectedIds.value = new Set()
  bulkMenuOpen.value = false
}

function permsSummary(perms: Array<{ resource: string; action: string }>): string {
  if (perms.length === 0) return 'No permissions'
  const byResource = new Map<string, string[]>()
  for (const p of perms) {
    const list = byResource.get(p.resource) ?? []
    list.push(p.action)
    byResource.set(p.resource, list)
  }
  return [...byResource.entries()].map(([r, a]) => `${r}: ${a.join(',')}`).join(' · ')
}

function getPermissionGroups(perms: Array<{ resource: string; action: string }>): Array<{ resource: string; actions: string[] }> {
  const byResource = new Map<string, string[]>()
  for (const p of perms) {
    const list = byResource.get(p.resource) ?? []
    list.push(p.action)
    byResource.set(p.resource, list)
  }
  return [...byResource.entries()].map(([resource, actions]) => ({ resource, actions }))
}

function isFullAdmin(perms: Array<{ resource: string; action: string }>): boolean {
  return perms.length >= 20
}

function openStaffDetails(s: AdminStaffMember) {
  closeAllMenus()
  detailStaff.value = s
  detailOpen.value = true
}

function openAdd() {
  closeAllMenus()
  addForm.value = { name: '', email: '', password: '', phone: '', permissions: [] }
  addOpen.value = true
}

async function submitAdd() {
  if (!addForm.value.name || !addForm.value.email || addForm.value.password.length < 8) return
  saving.value = true
  try {
    const ok = await createStaff({ ...addForm.value })
    if (ok) {
      toast({ title: 'Staff member created. Login credentials emailed.', variant: 'success' })
      addOpen.value = false
      addForm.value = { name: '', email: '', password: '', phone: '', permissions: [] }
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not create staff',
      variant: 'destructive',
    })
  } finally {
    saving.value = false
  }
}

function openEdit(id: string) {
  closeAllMenus()
  const s = staff.value.find((x) => x.id === id)
  if (!s) return
  editId.value = id
  editForm.value = {
    name: s.name,
    phone: s.phone ?? '',
    isActive: s.isActive,
    permissions: [...(s.permissions ?? [])],
  }
  editOpen.value = true
}

async function submitEdit() {
  if (!editForm.value.name) return
  saving.value = true
  try {
    const ok = await updateStaff(editId.value, {
      name: editForm.value.name,
      phone: editForm.value.phone,
      isActive: editForm.value.isActive,
      permissions: editForm.value.permissions,
    })
    if (ok) {
      toast({ title: 'Staff member updated successfully', variant: 'success' })
      if (detailStaff.value?.id === editId.value) {
        detailStaff.value = {
          ...detailStaff.value,
          name: editForm.value.name,
          phone: editForm.value.phone,
          isActive: editForm.value.isActive,
          permissions: editForm.value.permissions,
        }
      }
      editOpen.value = false
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not update staff',
      variant: 'destructive',
    })
  } finally {
    saving.value = false
  }
}

function openDeactivate(id: string) {
  closeAllMenus()
  const s = staff.value.find((x) => x.id === id)
  deactivateId.value = id
  deactivateTargetName.value = s?.name || 'this staff member'
  deactivateOpen.value = true
}

async function confirmDeactivate() {
  saving.value = true
  try {
    const ok = await deactivateStaff(deactivateId.value)
    if (ok) {
      toast({ title: 'Staff member deactivated successfully', variant: 'success' })
      if (detailStaff.value?.id === deactivateId.value) {
        detailStaff.value.isActive = false
      }
      deactivateOpen.value = false
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not deactivate staff',
      variant: 'destructive',
    })
  } finally {
    saving.value = false
  }
}

async function activateStaffMember(id: string) {
  closeAllMenus()
  try {
    const ok = await updateStaff(id, { isActive: true })
    if (ok) {
      toast({ title: 'Staff member activated successfully', variant: 'success' })
      if (detailStaff.value?.id === id) {
        detailStaff.value.isActive = true
      }
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not activate staff',
      variant: 'destructive',
    })
  }
}

// Export CSV functionality
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
  const selectedList = staff.value.filter((s) => selectedIds.value.has(s.id))
  if (selectedList.length === 0) return

  const headers = ['Name', 'Email', 'Phone', 'Status', 'Permissions']
  const rows = selectedList.map((s) => [
    `"${s.name.replace(/"/g, '""')}"`,
    `"${s.email.replace(/"/g, '""')}"`,
    `"${(s.phone || '').replace(/"/g, '""')}"`,
    s.isActive ? 'Active' : 'Inactive',
    `"${permsSummary(s.permissions ?? []).replace(/"/g, '""')}"`,
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  downloadCSV(csv, `tawasul-staff-selected-${new Date().toISOString().slice(0, 10)}.csv`)
  toast({ title: `Exported ${selectedList.length} staff records to CSV`, variant: 'success' })
  bulkMenuOpen.value = false
}

function exportAllCSV() {
  const headers = ['Name', 'Email', 'Phone', 'Status', 'Permissions']
  const rows = staff.value.map((s) => [
    `"${s.name.replace(/"/g, '""')}"`,
    `"${s.email.replace(/"/g, '""')}"`,
    `"${(s.phone || '').replace(/"/g, '""')}"`,
    s.isActive ? 'Active' : 'Inactive',
    `"${permsSummary(s.permissions ?? []).replace(/"/g, '""')}"`,
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  downloadCSV(csv, `tawasul-all-staff-${new Date().toISOString().slice(0, 10)}.csv`)
  toast({ title: `Exported ${staff.value.length} staff records to CSV`, variant: 'success' })
  bulkMenuOpen.value = false
}

onMounted(() => {
  void fetchStaff()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1360px] p-4 md:p-8" @click="closeAllMenus">
    <!-- Page Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground" data-testid="page-title">
          Manage Staff
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Configure staff member profiles, credentials, and RBAC system permissions.
        </p>
      </div>

      <!-- Header Action Buttons -->
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
                Selected Staff ({{ selectedIds.size }})
              </div>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground"
                :disabled="selectedIds.size === 0"
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
                All Records
              </div>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted text-foreground"
                @click="exportAllCSV"
              >
                <FileSpreadsheet class="size-4 text-muted-foreground" />
                <span>Export All Staff (CSV)</span>
              </button>
            </div>
          </Transition>
        </div>

        <Button v-if="canCreate" data-testid="add-staff" class="gap-2 shadow-xs" @click="openAdd">
          <UserPlus class="size-4" />
          Add Staff
        </Button>
      </div>
    </div>

    <!-- Error state -->
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <!-- Staff Metric Cards -->
    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Total Staff -->
      <Card class="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Staff</span>
          <div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield class="size-4.5" />
          </div>
        </div>
        <p class="mt-3 text-2xl font-bold text-foreground">{{ staff.length }}</p>
        <p class="mt-1 text-[11px] text-muted-foreground">Admin panel operators</p>
      </Card>

      <!-- Active Staff -->
      <Card class="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Staff</span>
          <div class="flex size-9 items-center justify-center rounded-xl bg-[#DCFCE7] dark:bg-emerald-950/60 text-[#15803D] dark:text-emerald-400">
            <UserCheck class="size-4.5" />
          </div>
        </div>
        <p class="mt-3 text-2xl font-bold text-foreground">
          {{ staff.filter((s) => s.isActive).length }}
        </p>
        <p class="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Full login access</p>
      </Card>

      <!-- Deactivated Staff -->
      <Card class="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inactive Staff</span>
          <div class="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <UserX class="size-4.5" />
          </div>
        </div>
        <p class="mt-3 text-2xl font-bold text-foreground">
          {{ staff.filter((s) => !s.isActive).length }}
        </p>
        <p class="mt-1 text-[11px] text-muted-foreground">Access suspended</p>
      </Card>

      <!-- Full Admins -->
      <Card class="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Super Admins</span>
          <div class="flex size-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Key class="size-4.5" />
          </div>
        </div>
        <p class="mt-3 text-2xl font-bold text-foreground">
          {{ staff.filter((s) => isFullAdmin(s.permissions ?? [])).length }}
        </p>
        <p class="mt-1 text-[11px] text-muted-foreground">All resource permissions</p>
      </Card>
    </div>

    <!-- Search bar & Filters & View Switcher -->
    <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3 w-full max-w-xl">
        <div class="relative flex-1 min-w-[240px]">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            v-model="search"
            type="search"
            placeholder="Search staff by name, email, or role…"
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

        <!-- Status Filter Tabs -->
        <div class="flex items-center rounded-xl border border-border bg-card p-1 text-xs font-semibold shadow-xs">
          <button
            type="button"
            class="rounded-lg px-2.5 py-1.5 transition-all"
            :class="statusFilter === 'ALL' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="statusFilter = 'ALL'"
          >
            All
          </button>
          <button
            type="button"
            class="rounded-lg px-2.5 py-1.5 transition-all"
            :class="statusFilter === 'ACTIVE' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="statusFilter = 'ACTIVE'"
          >
            Active
          </button>
          <button
            type="button"
            class="rounded-lg px-2.5 py-1.5 transition-all"
            :class="statusFilter === 'INACTIVE' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="statusFilter = 'INACTIVE'"
          >
            Inactive
          </button>
        </div>
      </div>

      <!-- View Switcher Toggle (Grid / List) -->
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

    <!-- Loading Skeleton -->
    <div v-if="loading && staff.length === 0" class="mt-6">
      <div v-if="viewMode === 'grid'" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Skeleton v-for="i in 4" :key="i" class="h-64 w-full rounded-2xl" />
      </div>
      <div v-else class="space-y-3">
        <Skeleton v-for="i in 4" :key="i" class="h-16 w-full rounded-xl" />
      </div>
    </div>

    <!-- Empty State: Search / Filter zero results -->
    <div
      v-else-if="filtered.length === 0 && (search.trim() || statusFilter !== 'ALL')"
      class="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserX class="size-7" />
      </div>
      <h2 class="mt-4 text-lg font-bold text-foreground">No staff members found</h2>
      <p class="mt-1 text-sm text-muted-foreground max-w-sm">
        No staff records match your current search or status filter.
      </p>
      <Button
        variant="outline"
        size="sm"
        class="mt-5 gap-1.5"
        @click="search = ''; statusFilter = 'ALL'"
      >
        <X class="size-3.5" />
        Reset Filters
      </Button>
    </div>

    <!-- Empty State: Zero staff in database -->
    <div
      v-else-if="staff.length === 0"
      class="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center shadow-soft"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UserPlus class="size-7" />
      </div>
      <h2 class="mt-4 text-lg font-bold text-foreground">No staff members yet</h2>
      <p class="mt-1 text-sm text-muted-foreground max-w-sm">
        Add administrators and operators to collaborate on platform management.
      </p>
      <Button v-if="canCreate" size="sm" class="mt-5 gap-2" @click="openAdd">
        <UserPlus class="size-4" />
        Add Staff
      </Button>
    </div>

    <!-- Content: Grid View -->
    <div v-else-if="viewMode === 'grid'" class="mt-6">
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="s in paginatedStaff"
          :key="s.id"
          class="group relative flex flex-col justify-between rounded-2xl border border-[#EBEBEB] dark:border-border bg-[#FAFAFA] dark:bg-card p-6 shadow-soft hover:shadow-medium transition-all duration-150 ease-out"
          :class="{ 'ring-2 ring-primary bg-primary/5 dark:bg-primary/10': selectedIds.has(s.id) }"
          :data-testid="`staff-card-${s.id}`"
        >
          <!-- Card Header Row: Checkbox, Status Badge & 3-Dot Menu -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <input
                type="checkbox"
                :checked="selectedIds.has(s.id)"
                class="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                aria-label="Select staff member"
                @click.stop="toggleSelect(s.id, $event)"
              />
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="s.isActive
                  ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300'
                  : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-muted dark:text-muted-foreground'"
              >
                {{ s.isActive ? 'ACTIVE' : 'INACTIVE' }}
              </span>
            </div>

            <!-- 3-Dot Menu -->
            <div v-if="canUpdate || canDelete" class="relative">
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Staff options"
                @click="toggleMenu(s.id, $event)"
              >
                <MoreVertical class="size-4" />
              </button>

              <div
                v-if="activeMenuId === s.id"
                class="absolute right-0 top-9 z-30 w-36 rounded-xl border border-border bg-card p-1 shadow-lg text-xs"
                @click.stop
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted text-foreground"
                  @click="openStaffDetails(s)"
                >
                  <Shield class="size-3.5 text-primary" />
                  <span>View Details</span>
                </button>
                <button
                  v-if="canUpdate"
                  type="button"
                  class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium transition-colors hover:bg-muted text-foreground"
                  :data-testid="`edit-staff-${s.id}`"
                  @click="openEdit(s.id)"
                >
                  <Key class="size-3.5 text-muted-foreground" />
                  <span>Edit Info</span>
                </button>
                <div class="my-1 border-t border-border/80" />
                <button
                  v-if="canDelete && s.isActive"
                  type="button"
                  class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium transition-colors text-destructive hover:bg-destructive/10"
                  :data-testid="`deactivate-staff-${s.id}`"
                  @click="openDeactivate(s.id)"
                >
                  <Ban class="size-3.5" />
                  <span>Deactivate</span>
                </button>
                <button
                  v-else-if="canUpdate && !s.isActive"
                  type="button"
                  class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium transition-colors text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  @click="activateStaffMember(s.id)"
                >
                  <CheckCircle2 class="size-3.5" />
                  <span>Activate</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Staff Hero Info -->
          <div class="mt-4 flex flex-col items-center text-center">
            <!-- Avatar -->
            <div class="relative">
              <img
                v-if="s.photo"
                :src="s.photo"
                :alt="s.name"
                class="size-16 rounded-full object-cover border-2 border-border/60 shadow-xs"
              />
              <div
                v-else
                class="flex size-16 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-xl font-bold border-2 border-border/40 shadow-xs"
              >
                {{ s.name.slice(0, 1).toUpperCase() }}
              </div>
            </div>

            <!-- Name -->
            <h3 class="mt-3.5 text-base font-bold text-foreground truncate w-full" :title="s.name">
              {{ s.name }}
            </h3>

            <!-- Role pill -->
            <p class="mt-0.5 text-xs text-muted-foreground truncate w-full flex items-center justify-center gap-1">
              <ShieldCheck v-if="isFullAdmin(s.permissions ?? [])" class="size-3 text-amber-500" />
              <span>{{ isFullAdmin(s.permissions ?? []) ? 'Super Administrator' : 'Staff Operator' }}</span>
            </p>
          </div>

          <!-- Divider -->
          <div class="my-4 border-t border-border/80" />

          <!-- Email & Phone -->
          <div class="space-y-2 text-xs text-muted-foreground">
            <div class="flex items-center gap-2 truncate" :title="s.email">
              <Mail class="size-3.5 shrink-0 text-muted-foreground/80" />
              <span class="truncate">{{ s.email }}</span>
            </div>
            <div class="flex items-center gap-2 truncate">
              <Phone class="size-3.5 shrink-0 text-muted-foreground/80" />
              <span>{{ s.phone || 'No phone set' }}</span>
            </div>
            <div class="flex items-center gap-2 truncate">
              <Key class="size-3.5 shrink-0 text-muted-foreground/80" />
              <span class="truncate font-medium text-foreground/80">
                {{ (s.permissions ?? []).length }} permissions assigned
              </span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-5 flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              class="flex-1 text-xs font-semibold"
              @click="openStaffDetails(s)"
            >
              View Details
            </Button>
            <Button
              v-if="canUpdate"
              variant="outline"
              size="sm"
              class="flex-1 text-xs font-semibold text-primary border-primary/40 hover:bg-primary/10 hover:text-primary"
              :data-testid="`edit-staff-${s.id}`"
              @click="openEdit(s.id)"
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
                  aria-label="Select all staff members"
                  @click.stop="toggleSelectAll"
                />
              </TableHead>
              <TableHead class="w-16">Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="(s, index) in paginatedStaff"
              :key="s.id"
              :data-testid="`staff-row-${s.id}`"
              class="transition-colors hover:bg-[#FCE4F3]/40 dark:hover:bg-primary/10"
              :class="[
                selectedIds.has(s.id) ? 'bg-primary/5 dark:bg-primary/10' : index % 2 === 0 ? 'bg-white dark:bg-card' : 'bg-[#FAFAFA] dark:bg-muted/20',
              ]"
            >
              <TableCell>
                <input
                  type="checkbox"
                  :checked="selectedIds.has(s.id)"
                  class="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                  aria-label="Select staff"
                  @click.stop="toggleSelect(s.id, $event)"
                />
              </TableCell>
              <TableCell>
                <div class="relative">
                  <img
                    v-if="s.photo"
                    :src="s.photo"
                    :alt="s.name"
                    class="size-9 rounded-full object-cover border border-border"
                  />
                  <div
                    v-else
                    class="flex size-9 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-sm font-bold"
                  >
                    {{ s.name.slice(0, 1).toUpperCase() }}
                  </div>
                </div>
              </TableCell>
              <TableCell class="font-bold text-foreground">{{ s.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ s.email }}</TableCell>
              <TableCell class="max-w-[320px]">
                <div class="truncate text-xs text-muted-foreground" :title="permsSummary(s.permissions ?? [])">
                  <Badge v-if="isFullAdmin(s.permissions ?? [])" variant="secondary" class="gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <ShieldCheck class="size-3" />
                    Full Admin
                  </Badge>
                  <span v-else class="text-xs">{{ permsSummary(s.permissions ?? []) }}</span>
                </div>
              </TableCell>
              <TableCell>
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  :class="s.isActive
                    ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300'
                    : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-muted dark:text-muted-foreground'"
                >
                  {{ s.isActive ? 'Active' : 'Inactive' }}
                </span>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    class="text-xs font-semibold text-primary hover:underline"
                    @click="openStaffDetails(s)"
                  >
                    View Details
                  </button>
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="text-xs font-semibold text-primary hover:underline"
                    :data-testid="`edit-staff-${s.id}`"
                    @click="openEdit(s.id)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="canDelete && s.isActive"
                    type="button"
                    class="text-xs font-semibold text-destructive hover:underline"
                    :data-testid="`deactivate-staff-${s.id}`"
                    @click="openDeactivate(s.id)"
                  >
                    Deactivate
                  </button>
                  <button
                    v-else-if="canUpdate && !s.isActive"
                    type="button"
                    class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    @click="activateStaffMember(s.id)"
                  >
                    Activate
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
        staff members
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

    <!-- Staff Details Slide-in Drawer -->
    <Teleport to="body">
      <!-- Backdrop -->
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

      <!-- Slide Drawer -->
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-150 ease-in"
        leave-to-class="translate-x-full"
      >
        <aside
          v-if="detailOpen && detailStaff"
          class="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[400px] lg:w-[440px] flex-col border-l border-border bg-card text-card-foreground shadow-2xl"
          data-testid="staff-detail-drawer"
          role="dialog"
          aria-modal="true"
        >
          <!-- Drawer Header -->
          <div class="flex items-center justify-between border-b border-border/80 px-6 py-4">
            <div class="flex items-center gap-2.5">
              <h2 class="text-base font-bold text-foreground">Staff Member Details</h2>
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="detailStaff.isActive
                  ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950/70 dark:text-emerald-300'
                  : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-muted dark:text-muted-foreground'"
              >
                {{ detailStaff.isActive ? 'Active' : 'Inactive' }}
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
            <!-- Hero Profile -->
            <div class="flex flex-col items-center text-center">
              <div class="relative">
                <img
                  v-if="detailStaff.photo"
                  :src="detailStaff.photo"
                  :alt="detailStaff.name"
                  class="size-20 rounded-full object-cover border-2 border-border/60 shadow-xs"
                />
                <div
                  v-else
                  class="flex size-20 items-center justify-center rounded-full bg-[#FCE4F3] text-[#E91E8C] dark:bg-primary/20 dark:text-primary text-2xl font-bold border-2 border-border/40 shadow-xs"
                >
                  {{ detailStaff.name.slice(0, 1).toUpperCase() }}
                </div>
              </div>
              <h3 class="mt-3.5 text-lg font-bold text-foreground">{{ detailStaff.name }}</h3>
              <p class="mt-0.5 text-xs text-muted-foreground flex items-center justify-center gap-1">
                <ShieldCheck class="size-3.5 text-amber-500" />
                <span>{{ isFullAdmin(detailStaff.permissions ?? []) ? 'Super Administrator' : 'Staff Operator' }}</span>
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
                  <span class="font-medium text-foreground truncate max-w-[200px]">{{ detailStaff.email }}</span>
                </div>
                <div class="flex items-center justify-between p-3.5">
                  <span class="flex items-center gap-2 text-muted-foreground">
                    <Phone class="size-3.5 text-primary" />
                    Phone
                  </span>
                  <span class="font-medium text-foreground">{{ detailStaff.phone || 'Not provided' }}</span>
                </div>
              </div>
            </div>

            <!-- Assigned Permissions Breakdown -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Access Permissions ({{ (detailStaff.permissions ?? []).length }})
                </p>
                <span v-if="isFullAdmin(detailStaff.permissions ?? [])" class="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                  Full Access Granted
                </span>
              </div>

              <div class="rounded-2xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
                <div
                  v-for="group in getPermissionGroups(detailStaff.permissions ?? [])"
                  :key="group.resource"
                  class="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0"
                >
                  <span class="font-bold text-foreground text-xs">{{ group.resource }}</span>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="action in group.actions"
                      :key="action"
                      class="rounded-md bg-card border border-border px-1.5 py-0.5 text-[10px] font-mono font-medium text-primary"
                    >
                      {{ action }}
                    </span>
                  </div>
                </div>

                <p v-if="!detailStaff.permissions?.length" class="text-xs text-muted-foreground italic py-2 text-center">
                  No active permissions configured.
                </p>
              </div>
            </div>

            <!-- Quick Management Actions -->
            <div class="border-t border-border/80 pt-5 space-y-2.5">
              <Button
                v-if="canUpdate"
                class="w-full justify-center gap-2 text-xs font-semibold shadow-xs"
                @click="openEdit(detailStaff.id)"
              >
                <Key class="size-3.5" />
                Edit Staff Information & Permissions
              </Button>

              <div class="flex items-center gap-2">
                <Button
                  v-if="canDelete && detailStaff.isActive"
                  variant="outline"
                  size="sm"
                  class="w-full text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1.5"
                  @click="openDeactivate(detailStaff.id)"
                >
                  <Ban class="size-3.5" />
                  Deactivate Staff Member
                </Button>
                <Button
                  v-else-if="canUpdate && !detailStaff.isActive"
                  variant="outline"
                  size="sm"
                  class="w-full text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1.5"
                  @click="activateStaffMember(detailStaff.id)"
                >
                  <CheckCircle2 class="size-3.5" />
                  Activate Staff Member
                </Button>
              </div>
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

    <!-- Add Staff Modal -->
    <Teleport to="body">
      <Dialog v-model:open="addOpen">
        <DialogContent class="max-w-lg" data-testid="add-staff-dialog">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Login credentials and account invitation will be emailed to the staff member.
            </DialogDescription>
          </DialogHeader>

          <form class="grid max-h-[60vh] gap-3.5 overflow-y-auto pr-1 py-1" @submit.prevent="submitAdd">
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-foreground" for="staff-add-name">
                Full Name *
              </label>
              <Input
                id="staff-add-name"
                v-model="addForm.name"
                placeholder="e.g. Sara Mohamed"
                data-testid="add-staff-name"
                required
              />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-foreground" for="staff-add-email">
                Email Address *
              </label>
              <Input
                id="staff-add-email"
                v-model="addForm.email"
                type="email"
                placeholder="sara@tawasul.com"
                data-testid="add-staff-email"
                required
              />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-foreground" for="staff-add-password">
                Password *
              </label>
              <Input
                id="staff-add-password"
                v-model="addForm.password"
                type="password"
                placeholder="Minimum 8 characters"
                data-testid="add-staff-password"
                required
                minlength="8"
              />
              <p class="mt-1 text-[11px] text-muted-foreground">
                Set manually by admin. The staff member will receive this in their welcome email.
              </p>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-foreground" for="staff-add-phone">
                Phone Number
              </label>
              <Input
                id="staff-add-phone"
                v-model="addForm.phone"
                placeholder="+20 100 000 0000"
                data-testid="add-staff-phone"
              />
            </div>
            <div>
              <span class="mb-1.5 block text-xs font-semibold text-foreground">
                Assigned RBAC Permissions
              </span>
              <PermissionBuilder v-model="addForm.permissions" />
            </div>

            <DialogFooter class="mt-4 gap-2">
              <Button type="button" variant="outline" @click="addOpen = false">Cancel</Button>
              <Button
                type="submit"
                data-testid="add-staff-submit"
                :disabled="saving || !addForm.name || !addForm.email || addForm.password.length < 8"
              >
                {{ saving ? 'Creating…' : 'Create Staff Member' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Teleport>

    <!-- Edit Staff Modal -->
    <Teleport to="body">
      <Dialog v-model:open="editOpen">
        <DialogContent class="max-w-lg" data-testid="edit-staff-dialog">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update contact information and system permissions for this staff member.
            </DialogDescription>
          </DialogHeader>

          <form class="grid max-h-[60vh] gap-3.5 overflow-y-auto pr-1 py-1" @submit.prevent="submitEdit">
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-foreground" for="staff-edit-name">
                Full Name *
              </label>
              <Input
                id="staff-edit-name"
                v-model="editForm.name"
                data-testid="edit-staff-name"
                required
              />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-foreground" for="staff-edit-phone">
                Phone Number
              </label>
              <Input
                id="staff-edit-phone"
                v-model="editForm.phone"
                data-testid="edit-staff-phone"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-foreground" for="staff-edit-status">
                Account Status
              </label>
              <select
                id="staff-edit-status"
                v-model="editForm.isActive"
                class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
              >
                <option :value="true">Active (Can log in)</option>
                <option :value="false">Inactive (Access suspended)</option>
              </select>
            </div>
            <div>
              <span class="mb-1.5 block text-xs font-semibold text-foreground">
                Assigned RBAC Permissions
              </span>
              <PermissionBuilder v-model="editForm.permissions" />
            </div>

            <DialogFooter class="mt-4 gap-2">
              <Button type="button" variant="outline" @click="editOpen = false">Cancel</Button>
              <Button
                type="submit"
                data-testid="edit-staff-submit"
                :disabled="saving || !editForm.name"
              >
                {{ saving ? 'Saving…' : 'Save Changes' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Teleport>

    <!-- Deactivate Staff Dialog -->
    <Teleport to="body">
      <Dialog v-model:open="deactivateOpen">
        <DialogContent class="max-w-md" data-testid="deactivate-dialog">
          <DialogHeader>
            <DialogTitle>Deactivate staff member?</DialogTitle>
            <DialogDescription class="text-xs leading-relaxed mt-1">
              Are you sure you want to deactivate <strong class="text-foreground">{{ deactivateTargetName }}</strong>?
              They will immediately lose access to the admin dashboard. You can reactivate them later by editing their status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter class="mt-4 gap-2">
            <Button type="button" variant="outline" @click="deactivateOpen = false">Cancel</Button>
            <Button
              variant="destructive"
              data-testid="deactivate-confirm"
              :disabled="saving"
              @click="confirmDeactivate"
            >
              {{ saving ? 'Deactivating…' : 'Deactivate Staff Member' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>
