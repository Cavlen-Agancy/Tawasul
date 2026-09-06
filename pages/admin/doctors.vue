<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'staff-only'] })

const { doctors, loading, error, fetchDoctors, createDoctor, updateDoctor } = useAdminDashboard()
const { hasPermission } = useAuth()
const { toast } = useToast()

const search = ref('')
const addOpen = ref(false)
const editOpen = ref(false)
const saving = ref(false)

const addForm = ref({ name: '', email: '', phone: '', bio: '', specializations: [] as string[] })
const editId = ref('')
const editForm = ref({ name: '', phone: '', bio: '', specializations: [] as string[] })

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

function openAdd() {
  addForm.value = { name: '', email: '', phone: '', bio: '', specializations: [] }
  addOpen.value = true
}

async function submitAdd() {
  saving.value = true
  try {
    const ok = await createDoctor({ ...addForm.value })
    if (ok) {
      toast({ title: 'Doctor created. Credentials sent to their email.', variant: 'success' })
      addOpen.value = false
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
  const d = doctors.value.find((x) => x.id === id)
  if (!d) return
  editId.value = id
  editForm.value = {
    name: d.name,
    phone: d.phone ?? '',
    bio: (d as { bio?: string }).bio ?? '',
    specializations: [...(d.specializations ?? [])],
  }
  editOpen.value = true
}

async function submitEdit() {
  saving.value = true
  try {
    const ok = await updateDoctor(editId.value, { ...editForm.value })
    if (ok) {
      toast({ title: 'Doctor updated', variant: 'success' })
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
  try {
    const ok = await updateDoctor(id, { isActive: !isActive })
    if (ok) toast({ title: !isActive ? 'Doctor activated' : 'Doctor deactivated', variant: 'success' })
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not update doctor',
      variant: 'destructive',
    })
  }
}

onMounted(() => {
  void fetchDoctors()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
        Manage Doctors
      </h1>
      <Button v-if="canCreate" data-testid="add-doctor" @click="openAdd">Add Doctor</Button>
    </div>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div class="mt-6">
      <Input v-model="search" type="search" placeholder="Search by name or email" data-testid="doctor-search" class="max-w-md" />
    </div>

    <Card class="mt-4 overflow-hidden">
      <div v-if="loading" class="grid gap-2 p-4">
        <Skeleton v-for="i in 5" :key="i" class="h-14 w-full" />
      </div>
      <p v-else-if="filtered.length === 0" class="px-4 py-10 text-center text-sm text-muted-foreground">
        No doctors found.
      </p>
      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Specializations</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sessions This Month</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="d in filtered" :key="d.id" :data-testid="`doctor-row-${d.id}`">
              <TableCell>
                <Avatar class="size-9">
                  <AvatarImage :src="d.photo || undefined" :alt="d.name" />
                  <AvatarFallback>{{ d.name.slice(0, 1).toUpperCase() }}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell class="font-medium">{{ d.name }}</TableCell>
              <TableCell>{{ d.email }}</TableCell>
              <TableCell>
                <div class="flex max-w-[220px] flex-wrap gap-1">
                  <Badge v-for="s in (d.specializations ?? []).slice(0, 3)" :key="s" variant="secondary">{{ s }}</Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge :variant="d.isActive ? 'default' : 'secondary'">{{ d.isActive ? 'Active' : 'Inactive' }}</Badge>
              </TableCell>
              <TableCell>{{ d.sessionCountThisMonth ?? 0 }}</TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-2">
                  <NuxtLink :to="`/admin/doctors/${d.id}`" class="text-sm font-medium text-primary hover:underline" :data-testid="`view-doctor-${d.id}`">
                    View Calendar
                  </NuxtLink>
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="text-sm font-medium text-primary hover:underline"
                    :data-testid="`edit-doctor-${d.id}`"
                    @click="openEdit(d.id)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="text-sm font-medium text-destructive hover:underline"
                    :data-testid="`toggle-doctor-${d.id}`"
                    @click="toggleActive(d.id, d.isActive)"
                  >
                    {{ d.isActive ? 'Deactivate' : 'Activate' }}
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
        <DialogContent class="max-w-md" data-testid="add-doctor-dialog">
          <DialogHeader>
            <DialogTitle>Add Doctor</DialogTitle>
            <DialogDescription>Login credentials will be emailed to the doctor.</DialogDescription>
          </DialogHeader>
          <div class="grid gap-3">
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="add-name">Name</label>
              <Input id="add-name" v-model="addForm.name" data-testid="add-doctor-name" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="add-email">Email</label>
              <Input id="add-email" v-model="addForm.email" type="email" data-testid="add-doctor-email" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="add-phone">Phone</label>
              <Input id="add-phone" v-model="addForm.phone" data-testid="add-doctor-phone" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="add-bio">Bio</label>
              <textarea id="add-bio" v-model="addForm.bio" rows="3" class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" data-testid="add-doctor-bio" />
            </div>
            <div>
              <span class="mb-1.5 block text-sm font-medium">Specializations</span>
              <SpecializationsTagInput v-model="addForm.specializations" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="addOpen = false">Cancel</Button>
            <Button data-testid="add-doctor-submit" :disabled="saving" @click="submitAdd">
              {{ saving ? 'Creating…' : 'Create Doctor' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>

    <Teleport to="body">
      <Dialog v-model:open="editOpen">
        <DialogContent class="max-w-md" data-testid="edit-doctor-dialog">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
          </DialogHeader>
          <div class="grid gap-3">
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="edit-name">Name</label>
              <Input id="edit-name" v-model="editForm.name" data-testid="edit-doctor-name" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="edit-phone">Phone</label>
              <Input id="edit-phone" v-model="editForm.phone" data-testid="edit-doctor-phone" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="edit-bio">Bio</label>
              <textarea id="edit-bio" v-model="editForm.bio" rows="3" class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" data-testid="edit-doctor-bio" />
            </div>
            <div>
              <span class="mb-1.5 block text-sm font-medium">Specializations</span>
              <SpecializationsTagInput v-model="editForm.specializations" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="editOpen = false">Cancel</Button>
            <Button data-testid="edit-doctor-submit" :disabled="saving" @click="submitEdit">
              {{ saving ? 'Saving…' : 'Save' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>
