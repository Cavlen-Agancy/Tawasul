<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { DAYS_OF_WEEK } from '~/modules/admin/composables/types'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'DOCTORS', action: 'READ' },
})

const route = useRoute()
const doctorId = String(route.params.id ?? '')

const {
  currentDoctor,
  doctorAvailability,
  doctorBlockedSlots,
  bookings,
  loading,
  error,
  fetchDoctor,
  updateDoctor,
  fetchAvailability,
  updateAvailability,
  blockSlot,
  unblockSlot,
  fetchBookings,
} = useAdminDashboard()
const { hasPermission } = useAuth()
const { toast } = useToast()

const activeTab = ref('profile')
const canUpdate = computed(() => hasPermission('DOCTORS', 'UPDATE'))

const profileForm = ref({ name: '', phone: '', bio: '', specializations: [] as string[] })
const savingProfile = ref(false)

interface AvailRow {
  dayOfWeek: number
  startTime: string
  endTime: string
  sessionDuration: number
}
const availRows = ref<AvailRow[]>([{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', sessionDuration: 60 }])
const savingAvail = ref(false)

const blockForm = ref({ date: '', startTime: '09:00', endTime: '10:00' })
const blocking = ref(false)

const doctorBookings = computed(() => bookings.value.filter((b) => b.doctorId === doctorId))

const calendarEvents = computed(() =>
  doctorBookings.value.map((b) => ({
    id: b.id,
    title: `${b.patientName} ${b.startTime}`,
    start: `${b.date}T${b.startTime}`,
    end: `${b.date}T${b.endTime}`,
    classNames: [b.status === 'CANCELLED' ? 'fc-tawasul-event-cancelled' : 'fc-tawasul-event-confirmed'],
  })),
)

function formatTime(time: string): string {
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10))
  const period = (hh || 0) >= 12 ? 'PM' : 'AM'
  const hour = (hh || 0) % 12 === 0 ? 12 : (hh || 0) % 12
  return `${hour}:${String(mm).padStart(2, '0')} ${period}`
}

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

async function loadAll() {
  await fetchDoctor(doctorId)
  if (currentDoctor.value) {
    profileForm.value = {
      name: currentDoctor.value.name,
      phone: currentDoctor.value.phone ?? '',
      bio: currentDoctor.value.bio ?? '',
      specializations: [...(currentDoctor.value.specializations ?? [])],
    }
  }
  await fetchBookings()
}

async function saveProfile() {
  savingProfile.value = true
  try {
    const ok = await updateDoctor(doctorId, { ...profileForm.value })
    if (ok) {
      toast({ title: 'Doctor updated', variant: 'success' })
      await fetchDoctor(doctorId)
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not update',
      variant: 'destructive',
    })
  } finally {
    savingProfile.value = false
  }
}

function addAvailRow() {
  availRows.value.push({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', sessionDuration: 60 })
}

function removeAvailRow(i: number) {
  availRows.value.splice(i, 1)
}

async function saveAvailability() {
  savingAvail.value = true
  try {
    const ok = await updateAvailability(doctorId, availRows.value)
    if (ok) toast({ title: 'Availability updated successfully', variant: 'success' })
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not update availability',
      variant: 'destructive',
    })
  } finally {
    savingAvail.value = false
  }
}

async function submitBlock() {
  blocking.value = true
  try {
    const ok = await blockSlot(doctorId, { ...blockForm.value })
    if (ok) {
      toast({ title: 'Slot blocked', variant: 'success' })
      blockForm.value = { date: '', startTime: '09:00', endTime: '10:00' }
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not block slot',
      variant: 'destructive',
    })
  } finally {
    blocking.value = false
  }
}

async function removeBlock(blockId: string) {
  try {
    const ok = await unblockSlot(doctorId, blockId)
    if (ok) toast({ title: 'Block removed', variant: 'success' })
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not remove block',
      variant: 'destructive',
    })
  }
}

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <NuxtLink to="/admin/doctors" class="text-sm font-medium text-primary hover:underline">← All doctors</NuxtLink>
    <h1 class="mt-2 text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
      {{ currentDoctor?.name ?? 'Doctor' }}
    </h1>
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div v-if="loading && !currentDoctor" class="mt-6 grid gap-2">
      <Skeleton v-for="i in 4" :key="i" class="h-14 w-full" />
    </div>

    <Tabs v-else v-model="activeTab" class="mt-6 w-full" data-testid="doctor-tabs">
      <TabsList>
        <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
        <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
        <TabsTrigger value="availability" data-testid="tab-availability">Availability</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" class="mt-4">
        <Card>
          <CardContent class="grid gap-4 p-6">
            <div class="flex items-center gap-4">
              <Avatar class="size-16">
                <AvatarImage :src="currentDoctor?.photo || undefined" :alt="currentDoctor?.name" />
                <AvatarFallback class="text-xl">{{ currentDoctor?.name?.slice(0, 1).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <div>
                <p class="text-sm text-muted-foreground">{{ currentDoctor?.email }}</p>
                <Badge :variant="currentDoctor?.isActive ? 'default' : 'secondary'">
                  {{ currentDoctor?.isActive ? 'Active' : 'Inactive' }}
                </Badge>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="d-name">Name</label>
              <Input id="d-name" v-model="profileForm.name" :disabled="!canUpdate" data-testid="doctor-name" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="d-phone">Phone</label>
              <Input id="d-phone" v-model="profileForm.phone" :disabled="!canUpdate" data-testid="doctor-phone" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="d-bio">Bio</label>
              <textarea id="d-bio" v-model="profileForm.bio" rows="4" :disabled="!canUpdate" class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" data-testid="doctor-bio" />
            </div>
            <div>
              <span class="mb-1.5 block text-sm font-medium">Specializations</span>
              <SpecializationsTagInput v-model="profileForm.specializations" />
            </div>
            <div v-if="canUpdate">
              <Button data-testid="save-doctor" :disabled="savingProfile" @click="saveProfile">
                {{ savingProfile ? 'Saving…' : 'Save Changes' }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="calendar" class="mt-4">
        <Card>
          <CardContent class="p-3 sm:p-5">
            <ClientOnly>
              <FullCalendar
                :options="{
                  plugins: [dayGridPlugin, interactionPlugin],
                  initialView: 'dayGridMonth',
                  headerToolbar: false,
                  height: 'auto',
                  events: calendarEvents,
                }"
              />
              <template #fallback>
                <div class="py-10 text-center text-sm text-muted-foreground">Loading calendar…</div>
              </template>
            </ClientOnly>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="availability" class="mt-4">
        <div class="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly availability</CardTitle>
              <CardDescription>Saving replaces all existing slots for this doctor.</CardDescription>
            </CardHeader>
            <CardContent class="grid gap-3">
              <div
                v-for="(row, i) in availRows"
                :key="i"
                class="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 sm:grid-cols-5"
              >
                <select v-model.number="row.dayOfWeek" class="rounded-lg border border-border bg-background px-2 py-2 text-sm" :data-testid="`avail-day-${i}`">
                  <option v-for="(day, di) in DAYS_OF_WEEK" :key="di" :value="di">{{ day }}</option>
                </select>
                <input v-model="row.startTime" type="time" class="rounded-lg border border-border bg-background px-2 py-2 text-sm" :data-testid="`avail-start-${i}`" />
                <input v-model="row.endTime" type="time" class="rounded-lg border border-border bg-background px-2 py-2 text-sm" :data-testid="`avail-end-${i}`" />
                <select v-model.number="row.sessionDuration" class="rounded-lg border border-border bg-background px-2 py-2 text-sm" :data-testid="`avail-duration-${i}`">
                  <option :value="30">30 min</option>
                  <option :value="45">45 min</option>
                  <option :value="60">60 min</option>
                </select>
                <Button variant="ghost" size="sm" :data-testid="`avail-remove-${i}`" @click="removeAvailRow(i)">Remove</Button>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" data-testid="avail-add-row" @click="addAvailRow">Add row</Button>
                <Button v-if="canUpdate" data-testid="avail-save" :disabled="savingAvail" @click="saveAvailability">
                  {{ savingAvail ? 'Saving…' : 'Save Availability' }}
                </Button>
              </div>
              <div v-if="doctorAvailability.length > 0" class="mt-2">
                <p class="text-sm font-medium">Current slots</p>
                <ul class="mt-1 grid gap-1 text-sm text-muted-foreground">
                  <li v-for="s in doctorAvailability" :key="s.id">
                    {{ DAYS_OF_WEEK[s.dayOfWeek] }} · {{ s.startTime }}–{{ s.endTime }} · {{ s.sessionDuration }} min
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Blocked slots</CardTitle>
            </CardHeader>
            <CardContent class="grid gap-3">
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input v-model="blockForm.date" type="date" class="rounded-lg border border-border bg-background px-2 py-2 text-sm" data-testid="block-date" />
                <input v-model="blockForm.startTime" type="time" class="rounded-lg border border-border bg-background px-2 py-2 text-sm" data-testid="block-start" />
                <input v-model="blockForm.endTime" type="time" class="rounded-lg border border-border bg-background px-2 py-2 text-sm" data-testid="block-end" />
                <Button v-if="canUpdate" data-testid="block-submit" :disabled="blocking" @click="submitBlock">
                  {{ blocking ? 'Blocking…' : 'Block' }}
                </Button>
              </div>
              <ul class="grid gap-2">
                <li
                  v-for="b in doctorBlockedSlots"
                  :key="b.id"
                  class="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>{{ formatDateLabel(typeof b.date === 'string' ? b.date.slice(0, 10) : '') }} · {{ formatTime(b.startTime) }} – {{ formatTime(b.endTime) }}</span>
                  <Button v-if="canUpdate" variant="ghost" size="sm" :data-testid="`unblock-${b.id}`" @click="removeBlock(b.id)">Remove</Button>
                </li>
              </ul>
              <p v-if="doctorBlockedSlots.length === 0" class="text-sm text-muted-foreground">No blocked slots.</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>

<style>
.fc-tawasul-event-confirmed {
  background-color: #16a34a;
  border-color: #16a34a;
}
.fc-tawasul-event-cancelled {
  background-color: #94a3b8;
  border-color: #94a3b8;
}
</style>
