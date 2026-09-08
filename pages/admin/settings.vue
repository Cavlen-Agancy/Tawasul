<script setup lang="ts">
import {
  CalendarDays,
  CalendarOff,
  Building2,
  Coins,
  Clock,
  CreditCard,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Phone,
  Mail,
  MessageSquare,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  Zap,
} from 'lucide-vue-next'
import { DAYS_OF_WEEK } from '~/modules/admin/composables/types'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'staff-only'],
  permission: { resource: 'SETTINGS', action: 'READ' },
})

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
const showSecret = ref(false)
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
      toast({ title: 'Settings saved successfully', variant: 'success' })
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
  if (!dateISO) return ''
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
  <div class="mx-auto w-full max-w-[1360px] p-4 md:p-8">
    <!-- Page Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground" data-testid="page-title">
          Settings
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Configure recurring booking schedules, closure dates, platform identity, and payments.
        </p>
      </div>

      <!-- Live Gateway Pill -->
      <div class="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold shadow-xs">
        <span class="size-2 rounded-full bg-emerald-500 animate-pulse" />
        <span class="text-muted-foreground">Gateway:</span>
        <span class="font-bold text-foreground capitalize">{{ settings?.paymentGateway || 'Paymob' }}</span>
      </div>
    </div>

    <!-- Error message -->
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <!-- Settings Navigation Tabs -->
    <Tabs v-model="activeTab" class="mt-6 w-full" data-testid="settings-tabs">
      <div class="overflow-x-auto pb-1">
        <TabsList class="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-muted/60 p-1.5 text-muted-foreground">
          <TabsTrigger
            value="schedule"
            data-testid="tab-schedule"
            class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
          >
            <CalendarDays class="size-3.5" />
            <span>Schedule</span>
            <span class="rounded-full bg-primary/15 text-primary px-1.5 py-0.2 text-[10px] font-bold">
              {{ sortedSchedules.length }}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="blocked"
            data-testid="tab-blocked"
            class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
          >
            <CalendarOff class="size-3.5" />
            <span>Blocked Dates</span>
            <span v-if="upcomingBlockedDates.length" class="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-bold">
              {{ upcomingBlockedDates.length }}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="platform"
            data-testid="tab-platform"
            class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
          >
            <Building2 class="size-3.5" />
            <span>Platform Info</span>
          </TabsTrigger>
          <TabsTrigger
            value="pricing"
            data-testid="tab-pricing"
            class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
          >
            <Coins class="size-3.5" />
            <span>Pricing</span>
          </TabsTrigger>
          <TabsTrigger
            value="hours"
            data-testid="tab-hours"
            class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
          >
            <Clock class="size-3.5" />
            <span>Working Hours</span>
          </TabsTrigger>
          <TabsTrigger
            value="gateway"
            data-testid="tab-gateway"
            class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
          >
            <CreditCard class="size-3.5" />
            <span>Gateway</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <!-- 1. Weekly Schedule Tab -->
      <TabsContent value="schedule" class="mt-6">
        <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
          <!-- Active Schedule Slots List -->
          <Card class="w-full overflow-hidden rounded-2xl border border-border shadow-soft">
            <CardHeader class="border-b border-border/70 pb-4">
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle class="text-base font-bold text-foreground">Weekly Booking Schedule</CardTitle>
                  <CardDescription class="text-xs">
                    Recurring windows when patients can select and book counseling sessions.
                  </CardDescription>
                </div>
                <span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {{ sortedSchedules.filter((s) => s.isActive).length }} active
                </span>
              </div>
            </CardHeader>

            <CardContent class="p-4 sm:p-6">
              <div v-if="loading && sortedSchedules.length === 0" class="space-y-3">
                <Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-xl" />
              </div>

              <div
                v-else-if="sortedSchedules.length === 0"
                class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center"
                data-testid="no-schedules"
              >
                <div class="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarDays class="size-6" />
                </div>
                <p class="mt-3 text-sm font-bold text-foreground">No schedule slots configured</p>
                <p class="mt-1 text-xs text-muted-foreground">Add your first recurring availability window on the right.</p>
              </div>

              <div v-else class="space-y-2.5">
                <div
                  v-for="slot in sortedSchedules"
                  :key="slot.id"
                  class="group flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 transition-all hover:border-primary/40 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="flex items-center gap-3.5">
                    <!-- Day Initial Avatar -->
                    <div
                      class="flex size-10 items-center justify-center rounded-xl font-bold text-xs shrink-0"
                      :class="slot.isActive
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-muted text-muted-foreground border border-border'"
                    >
                      {{ DAYS_OF_WEEK[slot.dayOfWeek].slice(0, 3).toUpperCase() }}
                    </div>

                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-foreground">
                          {{ DAYS_OF_WEEK[slot.dayOfWeek] }}
                        </span>
                        <span
                          class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          :class="slot.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground'"
                        >
                          {{ slot.isActive ? 'Active' : 'Disabled' }}
                        </span>
                      </div>
                      <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span class="font-mono font-medium text-foreground/80">
                          {{ slot.startTime }} – {{ slot.endTime }}
                        </span>
                        <span>·</span>
                        <span>{{ slot.sessionDuration }} min duration</span>
                      </div>
                    </div>
                  </div>

                  <!-- Slot Action Controls -->
                  <div class="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-8 text-xs font-semibold"
                      :data-testid="`toggle-${slot.id}`"
                      @click="toggleActive(slot.id, !slot.isActive)"
                    >
                      {{ slot.isActive ? 'Disable' : 'Enable' }}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      aria-label="Remove slot"
                      :data-testid="`delete-${slot.id}`"
                      @click="openDelete(slot.id)"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Add Schedule Slot Card -->
          <Card class="h-fit rounded-2xl border border-border shadow-soft">
            <CardHeader class="border-b border-border/70 pb-4">
              <CardTitle class="text-base font-bold text-foreground">Add Weekly Slot</CardTitle>
              <CardDescription class="text-xs">
                Create a new recurring availability window.
              </CardDescription>
            </CardHeader>

            <CardContent class="p-5 space-y-4">
              <!-- Day selector -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground" for="day-select">
                  Day of the Week
                </label>
                <select
                  id="day-select"
                  v-model="form.dayOfWeek"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                  data-testid="schedule-day"
                >
                  <option v-for="(day, i) in DAYS_OF_WEEK" :key="i" :value="String(i)">{{ day }}</option>
                </select>
              </div>

              <!-- Start & End Times -->
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-foreground" for="start-time">
                    Start Time
                  </label>
                  <input
                    id="start-time"
                    v-model="form.startTime"
                    type="time"
                    class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary font-mono"
                    data-testid="schedule-start"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-foreground" for="end-time">
                    End Time
                  </label>
                  <input
                    id="end-time"
                    v-model="form.endTime"
                    type="time"
                    class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary font-mono"
                    data-testid="schedule-end"
                  />
                </div>
              </div>

              <!-- Session duration -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="block text-xs font-semibold text-foreground" for="session-duration">
                    Session Duration (minutes)
                  </label>
                  <div class="flex items-center gap-1">
                    <button
                      v-for="d in [30, 45, 60]"
                      :key="d"
                      type="button"
                      class="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-mono transition-colors"
                      :class="form.sessionDuration === String(d) ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-muted'"
                      @click="form.sessionDuration = String(d)"
                    >
                      {{ d }}m
                    </button>
                  </div>
                </div>
                <input
                  id="session-duration"
                  v-model="form.sessionDuration"
                  type="number"
                  min="15"
                  step="15"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary font-mono"
                  data-testid="schedule-duration"
                />
              </div>

              <!-- Active switch -->
              <label class="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs text-foreground cursor-pointer select-none">
                <input
                  v-model="form.isActive"
                  type="checkbox"
                  class="size-4 rounded border-border text-primary accent-primary cursor-pointer"
                  data-testid="schedule-active"
                />
                <span class="font-medium">Activate slot immediately</span>
              </label>

              <!-- Submit button -->
              <Button
                class="w-full gap-2 text-xs font-semibold shadow-xs"
                :disabled="savingSchedule"
                data-testid="add-schedule"
                @click="addScheduleFromForm"
              >
                <Plus class="size-4" />
                {{ savingSchedule ? 'Adding slot…' : 'Add Weekly Slot' }}
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- 2. Blocked Dates Tab -->
      <TabsContent value="blocked" class="mt-6">
        <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
          <!-- Upcoming Blocked Dates List -->
          <Card class="w-full overflow-hidden rounded-2xl border border-border shadow-soft">
            <CardHeader class="border-b border-border/70 pb-4">
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle class="text-base font-bold text-foreground">Academy Closures</CardTitle>
                  <CardDescription class="text-xs">
                    Specific future dates when the academy is closed for all patient appointments.
                  </CardDescription>
                </div>
                <span class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {{ upcomingBlockedDates.length }} blocked
                </span>
              </div>
            </CardHeader>

            <CardContent class="p-4 sm:p-6">
              <div v-if="loading && upcomingBlockedDates.length === 0" class="space-y-3">
                <Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-xl" />
              </div>

              <div
                v-else-if="upcomingBlockedDates.length === 0"
                class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center"
                data-testid="no-blocked-dates"
              >
                <div class="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarOff class="size-6" />
                </div>
                <p class="mt-3 text-sm font-bold text-foreground">No upcoming closure dates</p>
                <p class="mt-1 text-xs text-muted-foreground">The platform schedule is open for all regular hours.</p>
              </div>

              <div v-else class="space-y-2.5">
                <div
                  v-for="block in upcomingBlockedDates"
                  :key="block.id"
                  class="flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 transition-all hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="flex items-center gap-3.5">
                    <div class="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0">
                      <CalendarOff class="size-5" />
                    </div>
                    <div>
                      <p class="text-sm font-bold text-foreground" data-testid="blocked-date">
                        {{ formatDateLabel(block.date) }}
                      </p>
                      <p class="text-xs text-muted-foreground mt-0.5">
                        {{ block.reason || 'Closed / Holiday' }}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    class="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    :data-testid="`unblock-${block.id}`"
                    @click="confirmUnblock(block.id)"
                  >
                    Unblock Date
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Block Date Form -->
          <Card class="h-fit rounded-2xl border border-border shadow-soft">
            <CardHeader class="border-b border-border/70 pb-4">
              <CardTitle class="text-base font-bold text-foreground">Block a Date</CardTitle>
              <CardDescription class="text-xs">
                Close a specific day for all bookings.
              </CardDescription>
            </CardHeader>

            <CardContent class="p-5 space-y-4">
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground" for="block-date">
                  Closure Date *
                </label>
                <input
                  id="block-date"
                  v-model="blockForm.date"
                  type="date"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  data-testid="block-date-input"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground" for="block-reason">
                  Closure Reason
                </label>
                <input
                  id="block-reason"
                  v-model="blockForm.reason"
                  type="text"
                  placeholder="e.g. National Holiday, Staff Training"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  data-testid="block-reason-input"
                />
              </div>

              <!-- Quick block suggested chips -->
              <div class="space-y-2">
                <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Select This Week
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="date in suggestedBlockDates()"
                    :key="date"
                    type="button"
                    class="rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95"
                    :class="blockForm.date === date ? 'border-primary bg-primary/10 text-primary font-bold' : 'bg-muted/30'"
                    :data-testid="`quick-block-${date}`"
                    @click="blockForm.date = date"
                  >
                    {{ formatDateLabel(date) }}
                  </button>
                </div>
              </div>

              <Button
                class="w-full gap-2 text-xs font-semibold shadow-xs"
                :disabled="!blockForm.date || blocking"
                data-testid="block-date-submit"
                @click="submitBlock"
              >
                <Save class="size-3.5" />
                {{ blocking ? 'Blocking date…' : 'Block Date' }}
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- 3. Platform Info Tab -->
      <TabsContent value="platform" class="mt-6">
        <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card class="rounded-2xl border border-border shadow-soft">
            <CardHeader class="border-b border-border/70 pb-4">
              <CardTitle class="text-base font-bold text-foreground">Platform Identity & Contact</CardTitle>
              <CardDescription class="text-xs">
                Brand name and support contact details shown across public headers, footers, and patient emails.
              </CardDescription>
            </CardHeader>

            <CardContent class="p-6 space-y-4">
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground" for="platform-name">
                  Platform Name *
                </label>
                <Input
                  id="platform-name"
                  v-model="platformForm.platformName"
                  placeholder="Tawasul Academy"
                  data-testid="platform-name"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground" for="contact-email">
                  Public Support Email *
                </label>
                <Input
                  id="contact-email"
                  v-model="platformForm.contactEmail"
                  type="email"
                  placeholder="contact@tawasul.com"
                  data-testid="contact-email"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground" for="contact-phone">
                  Contact Phone Number
                </label>
                <Input
                  id="contact-phone"
                  v-model="platformForm.contactPhone"
                  placeholder="+20 100 000 0000"
                  data-testid="contact-phone"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground" for="whatsapp">
                  WhatsApp Support Number
                </label>
                <Input
                  id="whatsapp"
                  v-model="platformForm.whatsappNumber"
                  placeholder="+20 100 000 0000"
                  data-testid="whatsapp-number"
                />
              </div>

              <div class="pt-2">
                <Button
                  class="gap-2 text-xs font-semibold shadow-xs"
                  data-testid="save-platform"
                  :disabled="savingSection === 'platform'"
                  @click="saveSection('platform', { ...platformForm })"
                >
                  <Save class="size-3.5" />
                  {{ savingSection === 'platform' ? 'Saving changes…' : 'Save Platform Info' }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- Live Preview Card -->
          <Card class="h-fit rounded-2xl border border-border bg-muted/20 p-5 shadow-soft space-y-3.5">
            <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Live Patient Preview
            </span>
            <div class="rounded-xl border border-border bg-card p-4 space-y-2.5 text-xs">
              <div class="font-bold text-foreground text-sm flex items-center gap-1.5">
                <span>{{ platformForm.platformName || 'Tawasul Academy' }}</span>
              </div>
              <div class="flex items-center gap-2 text-muted-foreground">
                <Mail class="size-3 text-primary" />
                <span>{{ platformForm.contactEmail || 'contact@tawasul.com' }}</span>
              </div>
              <div class="flex items-center gap-2 text-muted-foreground">
                <Phone class="size-3 text-primary" />
                <span>{{ platformForm.contactPhone || '+20 100 000 0000' }}</span>
              </div>
              <div v-if="platformForm.whatsappNumber" class="flex items-center gap-2 text-muted-foreground">
                <MessageSquare class="size-3 text-emerald-600" />
                <span>WhatsApp: {{ platformForm.whatsappNumber }}</span>
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground/80 leading-relaxed">
              These details appear in appointment confirmation emails, session invitations, and the public page footer.
            </p>
          </Card>
        </div>
      </TabsContent>

      <!-- 4. Pricing Tab -->
      <TabsContent value="pricing" class="mt-6">
        <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card class="rounded-2xl border border-border shadow-soft">
            <CardHeader class="border-b border-border/70 pb-4">
              <CardTitle class="text-base font-bold text-foreground">Session Pricing & Duration</CardTitle>
              <CardDescription class="text-xs">
                Base hourly rates and default appointment duration charged to patients at checkout.
              </CardDescription>
            </CardHeader>

            <CardContent class="p-6 space-y-5">
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground" for="price-per-hour">
                  Hourly Rate (EGP) *
                </label>
                <div class="relative">
                  <Input
                    id="price-per-hour"
                    v-model.number="pricingForm.sessionPricePerHour"
                    type="number"
                    min="0"
                    data-testid="price-per-hour"
                    class="h-11 font-bold text-base pr-14"
                  />
                  <span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    EGP
                  </span>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-foreground" for="session-duration">
                  Default Session Length
                </label>
                <select
                  id="session-duration"
                  v-model.number="pricingForm.defaultSessionDuration"
                  class="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
                  data-testid="session-duration"
                >
                  <option :value="30">30 minutes</option>
                  <option :value="45">45 minutes</option>
                  <option :value="60">60 minutes</option>
                </select>
              </div>

              <div class="pt-2">
                <Button
                  class="gap-2 text-xs font-semibold shadow-xs"
                  data-testid="save-pricing"
                  :disabled="savingSection === 'pricing'"
                  @click="saveSection('pricing', { ...pricingForm })"
                >
                  <Save class="size-3.5" />
                  {{ savingSection === 'pricing' ? 'Saving pricing…' : 'Save Pricing' }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- Pricing Calculator Info Card -->
          <Card class="h-fit rounded-2xl border border-border bg-muted/20 p-5 shadow-soft space-y-3">
            <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Pricing Summary
            </span>
            <div class="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Base 60-min session:</span>
                <span class="font-bold text-foreground text-sm">
                  {{ pricingForm.sessionPricePerHour }} EGP
                </span>
              </div>
              <div class="flex items-center justify-between text-muted-foreground">
                <span>Default length:</span>
                <span class="font-medium text-foreground">{{ pricingForm.defaultSessionDuration }} minutes</span>
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground leading-relaxed">
              Patients will be prompted to pay this amount online during the 3-step booking flow before their session is scheduled.
            </p>
          </Card>
        </div>
      </TabsContent>

      <!-- 5. Default Working Hours Tab -->
      <TabsContent value="hours" class="mt-6">
        <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card class="rounded-2xl border border-border shadow-soft">
            <CardHeader class="border-b border-border/70 pb-4">
              <CardTitle class="text-base font-bold text-foreground">Working Hours Defaults</CardTitle>
              <CardDescription class="text-xs">
                Baseline clinic hours. Note: the weekly schedule in the Schedule tab drives actual patient slot booking.
              </CardDescription>
            </CardHeader>

            <CardContent class="p-6 space-y-5">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-foreground" for="working-start">
                    Clinic Opens
                  </label>
                  <input
                    id="working-start"
                    v-model="hoursForm.defaultWorkingStart"
                    type="time"
                    class="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:border-primary font-mono"
                    data-testid="working-start"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-foreground" for="working-end">
                    Clinic Closes
                  </label>
                  <input
                    id="working-end"
                    v-model="hoursForm.defaultWorkingEnd"
                    type="time"
                    class="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:border-primary font-mono"
                    data-testid="working-end"
                  />
                </div>
              </div>

              <div class="pt-2">
                <Button
                  class="gap-2 text-xs font-semibold shadow-xs"
                  data-testid="save-hours"
                  :disabled="savingSection === 'hours'"
                  @click="saveSection('hours', { ...hoursForm })"
                >
                  <Save class="size-3.5" />
                  {{ savingSection === 'hours' ? 'Saving hours…' : 'Save Working Hours' }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card class="h-fit rounded-2xl border border-border bg-muted/20 p-5 shadow-soft space-y-3">
            <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Schedule Rule
            </span>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Default working hours serve as a fallback. To offer booking slots to patients, ensure active time windows are configured in the <strong>Schedule</strong> tab.
            </p>
          </Card>
        </div>
      </TabsContent>

      <!-- 6. Payment Gateway Tab -->
      <TabsContent value="gateway" class="mt-6">
        <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card class="rounded-2xl border border-border shadow-soft">
            <CardHeader class="border-b border-border/70 pb-4">
              <CardTitle class="text-base font-bold text-foreground">Payment Gateway Integration</CardTitle>
              <CardDescription class="text-xs">
                Select and configure your active payment processor credentials.
              </CardDescription>
            </CardHeader>

            <CardContent class="p-6 space-y-5">
              <!-- Gateway selector -->
              <div class="space-y-2">
                <label class="block text-xs font-semibold text-foreground" for="gateway-select">
                  Active Payment Processor
                </label>
                <select
                  id="gateway-select"
                  v-model="gatewayForm.paymentGateway"
                  class="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
                  data-testid="gateway-select"
                >
                  <option value="paymob">Paymob (Egypt & MENA cards, wallets)</option>
                  <option value="stripe">Stripe (International cards)</option>
                </select>
              </div>

              <!-- Security notice & Update Keys toggle -->
              <div class="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <ShieldCheck class="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span class="text-xs font-bold text-foreground">API Credentials</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-7 text-xs font-semibold"
                    data-testid="update-keys-toggle"
                    @click="updateKeys = !updateKeys"
                  >
                    {{ updateKeys ? 'Cancel Key Edit' : 'Update Keys' }}
                  </Button>
                </div>
                <p v-if="!updateKeys" class="text-[11px] text-muted-foreground">
                  API keys and secrets are securely masked in the database. Toggle "Update Keys" to modify them.
                </p>
              </div>

              <!-- Gateway Keys Inputs (Shown when updateKeys is true) -->
              <div v-if="updateKeys" class="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-foreground" for="gateway-key">
                    Gateway API Key *
                  </label>
                  <Input
                    id="gateway-key"
                    v-model="gatewayForm.paymentGatewayKey"
                    placeholder="Enter new gateway key"
                    data-testid="gateway-key"
                  />
                </div>

                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label class="block text-xs font-semibold text-foreground" for="gateway-secret">
                      Gateway Secret / Webhook Secret *
                    </label>
                    <button
                      type="button"
                      class="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      @click="showSecret = !showSecret"
                    >
                      <Eye v-if="!showSecret" class="size-3" />
                      <EyeOff v-else class="size-3" />
                      <span>{{ showSecret ? 'Hide' : 'Show' }}</span>
                    </button>
                  </div>
                  <Input
                    id="gateway-secret"
                    v-model="gatewayForm.paymentGatewaySecret"
                    :type="showSecret ? 'text' : 'password'"
                    placeholder="Enter new gateway secret"
                    data-testid="gateway-secret"
                  />
                </div>
              </div>

              <div class="pt-2">
                <Button
                  class="gap-2 text-xs font-semibold shadow-xs"
                  data-testid="save-gateway"
                  :disabled="savingSection === 'gateway'"
                  @click="saveSection('gateway', updateKeys ? { ...gatewayForm } : { paymentGateway: gatewayForm.paymentGateway })"
                >
                  <Save class="size-3.5" />
                  {{ savingSection === 'gateway' ? 'Saving gateway…' : 'Save Gateway Settings' }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card class="h-fit rounded-2xl border border-border bg-muted/20 p-5 shadow-soft space-y-3">
            <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Security Compliance
            </span>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Payment credentials are never exposed to browser clients. Webhooks are cryptographically verified using HMAC signatures.
            </p>
          </Card>
        </div>
      </TabsContent>
    </Tabs>

    <!-- Delete Recurring Schedule Slot Confirmation Dialog -->
    <Teleport to="body">
      <Dialog v-model:open="deleteDialogOpen">
        <DialogContent class="max-w-md" data-testid="delete-dialog">
          <DialogHeader>
            <DialogTitle>Remove Schedule Slot?</DialogTitle>
            <DialogDescription class="text-xs leading-relaxed mt-1">
              This will permanently remove this recurring availability window. Existing confirmed bookings are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter class="mt-4 gap-2">
            <Button type="button" variant="outline" @click="deleteDialogOpen = false">
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="delete-confirm"
              @click="confirmDelete"
            >
              Remove Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Teleport>
  </div>
</template>
