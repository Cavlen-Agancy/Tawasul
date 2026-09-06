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
  settings,
  fetchSettings,
  updateSettings,
} = useAdminDashboard()
const { toast } = useToast()

const activeTab = ref('schedule')

const platformForm = ref({ platformName: '', contactEmail: '', contactPhone: '', whatsappNumber: '' })
const pricingForm = ref({ sessionPricePerHour: 0, defaultSessionDuration: 60 })
const hoursForm = ref({ defaultWorkingStart: '09:00', defaultWorkingEnd: '17:00' })
const gatewayForm = ref({ paymentGateway: 'paymob', paymentGatewayKey: '', paymentGatewaySecret: '' })
const updateKeys = ref(false)
const savingSection = ref<string | null>(null)

function fillSettingsForms() {
  if (!settings.value) return
  platformForm.value = {
    platformName: settings.value.platformName ?? '',
    contactEmail: settings.value.contactEmail ?? '',
    contactPhone: settings.value.contactPhone ?? '',
    whatsappNumber: settings.value.whatsappNumber ?? '',
  }
  pricingForm.value = {
    sessionPricePerHour: Number(settings.value.sessionPricePerHour ?? 0),
    defaultSessionDuration: settings.value.defaultSessionDuration ?? 60,
  }
  hoursForm.value = {
    defaultWorkingStart: settings.value.defaultWorkingStart ?? '09:00',
    defaultWorkingEnd: settings.value.defaultWorkingEnd ?? '17:00',
  }
  gatewayForm.value = {
    paymentGateway: settings.value.paymentGateway ?? 'paymob',
    paymentGatewayKey: settings.value.paymentGatewayKey ?? '',
    paymentGatewaySecret: settings.value.paymentGatewaySecret ?? '',
  }
}

async function saveSection(name: string, payload: Record<string, unknown>) {
  savingSection.value = name
  try {
    const updated = await updateSettings(payload)
    if (updated) {
      fillSettingsForms()
      updateKeys.value = false
      toast({ title: 'Settings saved', variant: 'success' })
    }
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not save settings',
      variant: 'destructive',
    })
  } finally {
    savingSection.value = null
  }
}

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
  void fetchSettings().then(() => fillSettingsForms())
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
        <TabsTrigger value="platform" data-testid="tab-platform">Platform Info</TabsTrigger>
        <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing</TabsTrigger>
        <TabsTrigger value="hours" data-testid="tab-hours">Working Hours</TabsTrigger>
        <TabsTrigger value="gateway" data-testid="tab-gateway">Gateway</TabsTrigger>
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

      <TabsContent value="platform" class="mt-4">
        <Card class="max-w-xl">
          <CardHeader>
            <CardTitle>Platform Info</CardTitle>
            <CardDescription>Shown across the site and in emails.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-3">
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="platform-name">Platform name</label>
              <Input id="platform-name" v-model="platformForm.platformName" data-testid="platform-name" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="contact-email">Contact email</label>
              <Input id="contact-email" v-model="platformForm.contactEmail" type="email" data-testid="contact-email" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="contact-phone">Contact phone</label>
              <Input id="contact-phone" v-model="platformForm.contactPhone" data-testid="contact-phone" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="whatsapp">WhatsApp number</label>
              <Input id="whatsapp" v-model="platformForm.whatsappNumber" data-testid="whatsapp-number" />
            </div>
            <div>
              <Button data-testid="save-platform" :disabled="savingSection === 'platform'" @click="saveSection('platform', { ...platformForm })">
                {{ savingSection === 'platform' ? 'Saving…' : 'Save' }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pricing" class="mt-4">
        <Card class="max-w-xl">
          <CardHeader>
            <CardTitle>Session Pricing</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-3">
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="price-per-hour">Price per hour (EGP)</label>
              <Input id="price-per-hour" v-model.number="pricingForm.sessionPricePerHour" type="number" min="0" data-testid="price-per-hour" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="session-duration">Default session duration</label>
              <select id="session-duration" v-model.number="pricingForm.defaultSessionDuration" class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" data-testid="session-duration">
                <option :value="30">30 minutes</option>
                <option :value="45">45 minutes</option>
                <option :value="60">60 minutes</option>
              </select>
            </div>
            <div>
              <Button data-testid="save-pricing" :disabled="savingSection === 'pricing'" @click="saveSection('pricing', { ...pricingForm })">
                {{ savingSection === 'pricing' ? 'Saving…' : 'Save' }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="hours" class="mt-4">
        <Card class="max-w-xl">
          <CardHeader>
            <CardTitle>Default Working Hours</CardTitle>
            <CardDescription>Defaults only — the weekly schedule above drives patient booking.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1.5 block text-sm font-medium" for="working-start">Start</label>
                <input id="working-start" v-model="hoursForm.defaultWorkingStart" type="time" class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" data-testid="working-start" />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium" for="working-end">End</label>
                <input id="working-end" v-model="hoursForm.defaultWorkingEnd" type="time" class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" data-testid="working-end" />
              </div>
            </div>
            <div>
              <Button data-testid="save-hours" :disabled="savingSection === 'hours'" @click="saveSection('hours', { ...hoursForm })">
                {{ savingSection === 'hours' ? 'Saving…' : 'Save' }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="gateway" class="mt-4">
        <Card class="max-w-xl">
          <CardHeader>
            <CardTitle>Payment Gateway</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-3">
            <div>
              <label class="mb-1.5 block text-sm font-medium" for="gateway-select">Gateway</label>
              <select id="gateway-select" v-model="gatewayForm.paymentGateway" class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" data-testid="gateway-select">
                <option value="paymob">Paymob</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" data-testid="update-keys-toggle" @click="updateKeys = !updateKeys">
                {{ updateKeys ? 'Cancel key update' : 'Update Keys' }}
              </Button>
              <span v-if="!updateKeys" class="text-xs text-muted-foreground">Keys are masked. Toggle to change them.</span>
            </div>
            <div v-if="updateKeys" class="grid gap-3">
              <div>
                <label class="mb-1.5 block text-sm font-medium" for="gateway-key">Gateway key</label>
                <Input id="gateway-key" v-model="gatewayForm.paymentGatewayKey" data-testid="gateway-key" />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium" for="gateway-secret">Gateway secret</label>
                <Input id="gateway-secret" v-model="gatewayForm.paymentGatewaySecret" data-testid="gateway-secret" />
              </div>
            </div>
            <div>
              <Button
                data-testid="save-gateway"
                :disabled="savingSection === 'gateway'"
                @click="saveSection('gateway', updateKeys ? { ...gatewayForm } : { paymentGateway: gatewayForm.paymentGateway })"
              >
                {{ savingSection === 'gateway' ? 'Saving…' : 'Save' }}
              </Button>
            </div>
          </CardContent>
        </Card>
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