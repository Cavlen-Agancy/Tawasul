<script setup lang="ts">
import { CalendarOff, Plus, Save, Trash2 } from 'lucide-vue-next'
import { DAYS_OF_WEEK } from '~/modules/admin/composables/types'

definePageMeta({ layout: 'admin', middleware: 'staff-only' })

const {
  schedules,
  blockedDates,
  upcomingBlockedDates,
  loading,
  error,
  fetchAll,
  addSchedule,
  updateSchedule,
  deleteSchedule,
  blockDate,
  unblockDate,
} = useAdminDashboard()
const { toast } = useToast()

const activeTab = ref('schedule')

interface ScheduleForm {
  dayOfWeek: string
  startTime: string
  endTime: string
  sessionDuration: string
  isActive: boolean
}

const defaultForm: ScheduleForm = {
  dayOfWeek: '1',
  startTime: '09:00',
  endTime: '17:00',
  sessionDuration: '60',
  isActive: true,
}

const form = ref<ScheduleForm>({ ...defaultForm })
const savingSchedule = ref(false)
const deleteTarget = ref<string | null>(null)
const deleteDialogOpen = ref(false)

interface BlockForm {
  date: string
  reason: string
}
const blockForm = ref<BlockForm>({ date: '', reason: '' })
const blocking = ref(false)

const sortedSchedules = computed(() =>
  [...schedules.value].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
)

function startOfWeek(): Date {
  const d = new Date()
  const day = d.getDay()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function suggestedBlockDates(): string[] {
  const start = startOfWeek()
  return [0, 1, 2, 3, 4, 5, 6].map((n) => toISODate(addDays(start, n)))
}

async function addScheduleFromForm() {
  savingSchedule.value = true
  try {
    const ok = await addSchedule({
      dayOfWeek: Number(form.value.dayOfWeek),
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      sessionDuration: Number(form.value.sessionDuration),
      isActive: form.value.isActive,
    })
    if (ok) {
      toast({ title: 'Schedule slot added', variant: 'success' })
      form.value = { ...defaultForm }
    }
  } finally {
    savingSchedule.value = false
  }
}

function openDelete(id: string) {
  deleteTarget.value = id
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  const ok = await deleteSchedule(deleteTarget.value)
  if (ok) {
    toast({ title: 'Slot removed', variant: 'success' })
    deleteDialogOpen.value = false
    deleteTarget.value = null
  }
}

async function toggleActive(scheduleId: string, isActive: boolean) {
  const ok = await updateSchedule(scheduleId, { isActive })
  if (ok) toast({ title: isActive ? 'Slot enabled' : 'Slot disabled', variant: 'success' })
}

async function submitBlock() {
  if (!blockForm.value.date) return
  blocking.value = true
  try {
    const ok = await blockDate({
      date: blockForm.value.date,
      reason: blockForm.value.reason || null,
    })
    if (ok) {
      toast({ title: 'Date blocked', variant: 'success' })
      blockForm.value = { date: '', reason: '' }
    }
  } finally {
    blocking.value = false
  }
}

async function confirmUnblock(id: string) {
  const ok = await unblockDate(id)
  if (ok) toast({ title: 'Date unblocked', variant: 'success' })
}

function formatDateLabel(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

onMounted(() => {
  void fetchAll()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] p-4 md:p-8">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
        Settings
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage the weekly schedule and blocked dates.</p>
    </div>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <Tabs v-model="activeTab" class="mt-6 w-full" data-testid="settings-tabs">
      <TabsList>
        <TabsTrigger value="schedule" data-testid="tab-schedule">Schedule</TabsTrigger>
        <TabsTrigger value="blocked" data-testid="tab-blocked">Blocked Dates</TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" class="mt-4">
        <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card class="w-full overflow-hidden">
            <CardHeader>
              <CardTitle>Weekly schedule</CardTitle>
              <CardDescription>Recurring slots offered to patients.</CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="loading" class="grid gap-2">
                <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
              </div>
              <p
                v-else-if="sortedSchedules.length === 0"
                class="rounded-xl border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground"
                data-testid="no-schedules"
              >
                No schedule slots yet. Add one below.
              </p>
              <div v-else class="divide-y divide-border">
                <div
                  v-for="slot in sortedSchedules"
                  :key="slot.id"
                  class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p class="text-sm font-semibold text-foreground">
                      {{ DAYS_OF_WEEK[slot.dayOfWeek] }}
                      <span class="font-normal text-muted-foreground">
                        · {{ slot.startTime }}–{{ slot.endTime }}
                      </span>
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ slot.sessionDuration }} min sessions
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      :data-testid="`toggle-${slot.id}`"
                      @click="toggleActive(slot.id, !slot.isActive)"
                    >
                      {{ slot.isActive ? 'Disable' : 'Enable' }}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remove slot"
                      :data-testid="`delete-${slot.id}`"
                      @click="openDelete(slot.id)"
                    >
                      <Trash2 class="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card class="w-full">
            <CardHeader>
              <CardTitle>Add slot</CardTitle>
              <CardDescription>Add a new recurring availability window.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-foreground" for="day-select">Day</label>
                <select
                  id="day-select"
                  v-model="form.dayOfWeek"
                  class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  data-testid="schedule-day"
                >
                  <option v-for="(day, i) in DAYS_OF_WEEK" :key="i" :value="String(i)">{{ day }}</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1.5 block text-sm font-medium text-foreground" for="start-time">Start</label>
                  <input
                    id="start-time"
                    v-model="form.startTime"
                    type="time"
                    class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    data-testid="schedule-start"
                  />
                </div>
                <div>
                  <label class="mb-1.5 block text-sm font-medium text-foreground" for="end-time">End</label>
                  <input
                    id="end-time"
                    v-model="form.endTime"
                    type="time"
                    class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    data-testid="schedule-end"
                  />
                </div>
              </div>

              <div>
                <label class="mb-1.5 block text-sm font-medium text-foreground" for="session-duration">
                  Session length (min)
                </label>
                <input
                  id="session-duration"
                  v-model="form.sessionDuration"
                  type="number"
                  min="15"
                  step="15"
                  class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  data-testid="schedule-duration"
                />
              </div>

              <label class="flex items-center gap-2 text-sm text-foreground">
                <input v-model="form.isActive" type="checkbox" data-testid="schedule-active" />
                Active immediately
              </label>

              <Button
                class="w-full"
                :disabled="savingSchedule"
                data-testid="add-schedule"
                @click="addScheduleFromForm"
              >
                <Plus class="size-4" />
                {{ savingSchedule ? 'Adding…' : 'Add slot' }}
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="blocked" class="mt-4">
        <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card class="w-full overflow-hidden">
            <CardHeader>
              <CardTitle>Blocked dates</CardTitle>
              <CardDescription>Days the academy is closed for bookings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="loading" class="grid gap-2">
                <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
              </div>
              <p
                v-else-if="upcomingBlockedDates.length === 0"
                class="rounded-xl border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground"
                data-testid="no-blocked-dates"
              >
                No blocked dates coming up.
              </p>
              <div v-else class="divide-y divide-border">
                <div
                  v-for="block in upcomingBlockedDates"
                  :key="block.id"
                  class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="flex items-center gap-3">
                    <CalendarOff class="size-5 shrink-0 text-destructive" />
                    <div>
                      <p class="text-sm font-semibold text-foreground" data-testid="blocked-date">
                        {{ formatDateLabel(block.date) }}
                      </p>
                      <p v-if="block.reason" class="text-xs text-muted-foreground">{{ block.reason }}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="w-fit"
                    :data-testid="`unblock-${block.id}`"
                    @click="confirmUnblock(block.id)"
                  >
                    Unblock
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card class="w-full">
            <CardHeader>
              <CardTitle>Block a date</CardTitle>
              <CardDescription>Close a specific day for all bookings.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-foreground" for="block-date">Date</label>
                <input
                  id="block-date"
                  v-model="blockForm.date"
                  type="date"
                  class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  data-testid="block-date-input"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-foreground" for="block-reason">Reason</label>
                <input
                  id="block-reason"
                  v-model="blockForm.reason"
                  type="text"
                  placeholder="e.g. Staff training"
                  class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  data-testid="block-reason-input"
                />
              </div>

              <div>
                <p class="mb-1.5 text-sm font-medium text-foreground">Quick block</p>
                <div class="flex flex-wrap gap-2">
                  <Button
                    v-for="date in suggestedBlockDates()"
                    :key="date"
                    variant="outline"
                    size="sm"
                    :data-testid="`quick-block-${date}`"
                    @click="blockForm.date = date"
                  >
                    {{ formatDateLabel(date) }}
                  </Button>
                </div>
              </div>

              <Button
                class="w-full"
                :disabled="!blockForm.date || blocking"
                data-testid="block-date-submit"
                @click="submitBlock"
              >
                <Save class="size-4" />
                {{ blocking ? 'Blocking…' : 'Block date' }}
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>

    <Teleport to="body">
      <Dialog v-model:open="deleteDialogOpen">
        <DialogContent class="max-w-md" data-testid="delete-dialog">
          <DialogHeader>
            <DialogTitle>Remove schedule slot?</DialogTitle>
            <DialogDescription>This removes the recurring window. Existing bookings are not affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="deleteDialogOpen = false">Cancel</Button>
            <Button variant="destructive" data-testid="delete-confirm" @click="confirmDelete">Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>