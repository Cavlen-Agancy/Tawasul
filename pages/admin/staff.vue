<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'STAFF', action: 'READ' },
})

const { staff, loading, error, fetchStaff, createStaff, updateStaff, deactivateStaff } = useAdminDashboard()
const { hasPermission } = useAuth()
const { toast } = useToast()

const addOpen = ref(false)
const editOpen = ref(false)
const deactivateOpen = ref(false)
const saving = ref(false)

const addForm = ref({ name: '', email: '', phone: '', permissions: [] as Array<{ resource: string; action: string }> })
const editId = ref('')
const editForm = ref({ name: '', phone: '', permissions: [] as Array<{ resource: string; action: string }> })
const deactivateId = ref('')

const canCreate = computed(() => hasPermission('STAFF', 'CREATE'))
const canUpdate = computed(() => hasPermission('STAFF', 'UPDATE'))
const canDelete = computed(() => hasPermission('STAFF', 'DELETE'))

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

function openAdd() {
  addForm.value = { name: '', email: '', phone: '', permissions: [] }
  addOpen.value = true
}

async function submitAdd() {
  saving.value = true
  try {
    const ok = await createStaff({ ...addForm.value })
    if (ok) {
      toast({ title: 'Staff created. Credentials sent to their email.', variant: 'success' })
      addOpen.value = false
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
  const s = staff.value.find((x) => x.id === id)
  if (!s) return
  editId.value = id
  editForm.value = {
    name: s.name,
    phone: s.phone ?? '',
    permissions: [...(s.permissions ?? [])],
  }
  editOpen.value = true
}

async function submitEdit() {
  saving.value = true
  try {
    const ok = await updateStaff(editId.value, { ...editForm.value })
    if (ok) {
      toast({ title: 'Staff updated', variant: 'success' })
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
  deactivateId.value = id
  deactivateOpen.value = true
}

async function confirmDeactivate() {
  saving.value = true
  try {
    const ok = await deactivateStaff(deactivateId.value)
    if (ok) {
      toast({ title: 'Staff deactivated', variant: 'success' })
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

onMounted(() => {
  void fetchStaff()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
        Manage Staff
      </h1>
      <Button v-if="canCreate" data-testid="add-staff" @click="openAdd">Add Staff</Button>
    </div>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <Card class="mt-6 overflow-hidden">
      <div v-if="loading" class="grid gap-2 p-4">
        <Skeleton v-for="i in 4" :key="i" class="h-14 w-full" />
      </div>
      <p v-else-if="staff.length === 0" class="px-4 py-10 text-center text-sm text-muted-foreground">
        No staff members yet.
      </p>
      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="s in staff" :key="s.id" :data-testid="`staff-row-${s.id}`">
              <TableCell class="font-medium">{{ s.name }}</TableCell>
              <TableCell>{{ s.email }}</TableCell>
              <TableCell class="max-w-[320px] text-xs text-muted-foreground">{{ permsSummary(s.permissions ?? []) }}</TableCell>
              <TableCell>
                <Badge :variant="s.isActive ? 'default' : 'secondary'">{{ s.isActive ? 'Active' : 'Inactive' }}</Badge>
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="text-sm font-medium text-primary hover:underline"
                    :data-testid="`edit-staff-${s.id}`"
                    @click="openEdit(s.id)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="canDelete"
                    type="button"
                    class="text-sm font-medium text-destructive hover:underline"
                    :data-testid="`deactivate-staff-${s.id}`"
                    @click="openDeactivate(s.id)"
                  >
                    Deactivate
                  </button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>

    <Teleport to="body">
      <Dialog v-model:open="addOpen">
        <DialogContent class="max-w-lg" data-testid="add-staff-dialog">
          <DialogHeader>
            <DialogTitle>Add Staff</DialogTitle>
            <DialogDescription>Login credentials will be emailed to the staff member.</DialogDescription>
          </DialogHeader>
          <div class="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="staff-add-name">Name</label>
              <Input id="staff-add-name" v-model="addForm.name" data-testid="add-staff-name" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="staff-add-email">Email</label>
              <Input id="staff-add-email" v-model="addForm.email" type="email" data-testid="add-staff-email" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="staff-add-phone">Phone</label>
              <Input id="staff-add-phone" v-model="addForm.phone" data-testid="add-staff-phone" />
            </div>
            <div>
              <span class="mb-1.5 block text-sm font-medium">Permissions</span>
              <PermissionBuilder v-model="addForm.permissions" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="addOpen = false">Cancel</Button>
            <Button data-testid="add-staff-submit" :disabled="saving" @click="submitAdd">
              {{ saving ? 'Creating…' : 'Create Staff' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>

    <Teleport to="body">
      <Dialog v-model:open="editOpen">
        <DialogContent class="max-w-lg" data-testid="edit-staff-dialog">
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
          </DialogHeader>
          <div class="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="staff-edit-name">Name</label>
              <Input id="staff-edit-name" v-model="editForm.name" data-testid="edit-staff-name" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="staff-edit-phone">Phone</label>
              <Input id="staff-edit-phone" v-model="editForm.phone" data-testid="edit-staff-phone" />
            </div>
            <div>
              <span class="mb-1.5 block text-sm font-medium">Permissions</span>
              <PermissionBuilder v-model="editForm.permissions" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="editOpen = false">Cancel</Button>
            <Button data-testid="edit-staff-submit" :disabled="saving" @click="submitEdit">
              {{ saving ? 'Saving…' : 'Save' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>

    <Teleport to="body">
      <Dialog v-model:open="deactivateOpen">
        <DialogContent class="max-w-md" data-testid="deactivate-dialog">
          <DialogHeader>
            <DialogTitle>Deactivate staff member?</DialogTitle>
            <DialogDescription>They will no longer be able to log in. This action can be reversed by editing them back to active.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="deactivateOpen = false">Cancel</Button>
            <Button variant="destructive" data-testid="deactivate-confirm" :disabled="saving" @click="confirmDeactivate">
              {{ saving ? 'Deactivating…' : 'Deactivate' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>
