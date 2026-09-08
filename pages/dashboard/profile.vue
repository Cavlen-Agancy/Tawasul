<script setup lang="ts">
import {
  AlertCircle,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  User,
} from 'lucide-vue-next'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const { profile, isLoading, error, fetchProfile, updateProfile, uploadPhoto } = usePatientDashboard()
const { user: authUser } = useAuth()
const { toast } = useToast()

const name = ref('')
const phone = ref('')
const photo = ref<string | undefined>(undefined)
const nameError = ref('')
const saving = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const initialName = ref('')
const initialPhone = ref('')

const isDirty = computed(() => {
  return name.value.trim() !== initialName.value.trim() || phone.value.trim() !== initialPhone.value.trim()
})

function applyProfile() {
  const currentName = profile.value?.name ?? ''
  const currentPhone = profile.value?.phone ?? ''
  name.value = currentName
  phone.value = currentPhone
  initialName.value = currentName
  initialPhone.value = currentPhone
  photo.value = profile.value?.photo ?? undefined
}

onMounted(async () => {
  await fetchProfile()
  applyProfile()
})

function clearNameError() {
  if (nameError.value && name.value.trim().length >= 2) {
    nameError.value = ''
  }
}

function discardChanges() {
  name.value = initialName.value
  phone.value = initialPhone.value
  nameError.value = ''
  toast({ title: 'Changes discarded', variant: 'info' })
}

function onPickFile() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  if (file.size > MAX_FILE_SIZE) {
    toast({ title: 'Photo must be smaller than 5MB', variant: 'destructive' })
    input.value = ''
    return
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    toast({ title: 'Please select a JPG, PNG, or WebP image', variant: 'destructive' })
    input.value = ''
    return
  }

  uploading.value = true
  try {
    const photoUrl = await uploadPhoto(file)
    if (photoUrl) {
      photo.value = photoUrl
      if (authUser.value) {
        authUser.value.photo = photoUrl
      }
    }
    toast({ title: 'Photo updated', variant: 'success' })
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Upload failed',
      variant: 'destructive',
    })
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function save() {
  nameError.value = ''
  const trimmedName = name.value.trim()
  if (!trimmedName || trimmedName.length < 2) {
    nameError.value = 'Name must be at least 2 characters'
    return
  }
  saving.value = true
  try {
    const updated = await updateProfile({
      name: trimmedName,
      phone: phone.value.trim() || undefined,
    })
    if (updated) {
      initialName.value = updated.name
      initialPhone.value = updated.phone ?? ''
      if (authUser.value) {
        authUser.value.name = updated.name
        if (updated.phone) authUser.value.phone = updated.phone
      }
    }
    toast({ title: 'Profile updated', variant: 'success' })
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not save profile',
      variant: 'destructive',
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl pb-16">
    <!-- Header Section -->
    <div class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" data-testid="page-title">
          Profile
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Manage your personal details, contact preferences, and account security.
        </p>
      </div>

      <!-- Quick status indicator -->
      <div class="flex items-center gap-2">
        <span
          v-if="isDirty"
          class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
        >
          <span class="size-1.5 animate-pulse rounded-full bg-amber-500" />
          Unsaved changes
        </span>
        <span
          v-else-if="profile"
          class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
        >
          <CheckCircle2 class="size-3.5 text-emerald-600" />
          Account Active
        </span>
      </div>
    </div>

    <!-- Error state with retry -->
    <div
      v-if="error"
      class="mb-6 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
    >
      <div class="flex items-center gap-2.5">
        <AlertCircle class="size-5 shrink-0" />
        <span>{{ error }}</span>
      </div>
      <Button variant="outline" size="sm" class="h-8 rounded-lg" @click="fetchProfile">
        Retry
      </Button>
    </div>

    <!-- Skeleton Loading -->
    <div v-if="isLoading && !profile" class="grid gap-8 lg:grid-cols-[300px_1fr]">
      <Card class="space-y-4 p-6">
        <Skeleton class="mx-auto size-28 rounded-full" />
        <Skeleton class="mx-auto h-5 w-36" />
        <Skeleton class="mx-auto h-4 w-48" />
        <Skeleton class="h-10 w-full rounded-xl" />
      </Card>
      <Card class="space-y-6 p-6">
        <Skeleton class="h-6 w-44" />
        <Skeleton class="h-12 w-full rounded-xl" />
        <Skeleton class="h-12 w-full rounded-xl" />
        <Skeleton class="h-12 w-full rounded-xl" />
        <Skeleton class="h-10 w-32 rounded-xl" />
      </Card>
    </div>

    <!-- Main Content -->
    <div v-else class="grid gap-8 lg:grid-cols-[320px_1fr]">
      <!-- Left Column: Identity & Information -->
      <div class="space-y-6">
        <!-- Profile Identity Card -->
        <Card class="overflow-hidden border-border/80 shadow-xs">
          <!-- Decorative Cover -->
          <div class="relative h-24 w-full bg-gradient-to-br from-primary/20 via-primary/10 to-teal-50/50">
            <div class="absolute -bottom-4 -right-4 size-20 rounded-full bg-primary/10 blur-xl" />
          </div>

          <div class="relative -mt-12 flex flex-col items-center px-6 pb-6 text-center">
            <!-- Avatar with interactive overlay -->
            <div class="relative">
              <Avatar class="size-24 ring-4 ring-white shadow-md transition-transform sm:size-28">
                <AvatarImage :src="photo" alt="Profile photo" class="object-cover" />
                <AvatarFallback class="bg-primary/10 text-2xl font-bold text-primary sm:text-3xl">
                  {{ (name || profile?.name || 'P').slice(0, 1).toUpperCase() }}
                </AvatarFallback>
              </Avatar>

              <!-- Uploading spinner -->
              <div
                v-if="uploading"
                class="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-xs"
              >
                <Loader2 class="size-6 animate-spin" />
                <span class="mt-1 text-[10px] font-medium">Uploading…</span>
              </div>

              <!-- Camera quick action button -->
              <button
                type="button"
                class="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-primary text-white shadow-md transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                title="Upload new photo"
                :disabled="uploading"
                @click="onPickFile"
              >
                <Camera class="size-4" />
              </button>
            </div>

            <!-- Hidden file input -->
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              data-testid="photo-input"
              @change="onFileSelected"
            >

            <!-- Name and Member details -->
            <h2 class="mt-3.5 max-w-full truncate text-lg font-bold text-foreground">
              {{ name || profile?.name || 'Patient' }}
            </h2>
            <p class="max-w-full truncate text-xs text-muted-foreground">
              {{ profile?.email }}
            </p>

            <div class="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <Badge variant="default" class="text-[11px] font-medium">
                Patient Member
              </Badge>
              <Badge variant="success" class="text-[11px] font-medium">
                <CheckCircle2 class="size-3 text-emerald-600" />
                Verified
              </Badge>
            </div>

            <!-- Photo Upload Button -->
            <Button
              variant="outline"
              size="sm"
              class="mt-5 w-full gap-2 rounded-xl border-border/80 text-xs font-semibold"
              data-testid="upload-photo"
              :disabled="uploading"
              @click="onPickFile"
            >
              <Camera class="size-3.5" />
              {{ uploading ? 'Uploading…' : 'Upload Photo' }}
            </Button>
            <p class="mt-2 text-[11px] text-muted-foreground">
              JPG, PNG or WebP up to 5MB
            </p>
          </div>
        </Card>

        <!-- Confidential Care Assurance Card -->
        <Card class="border-border/60 bg-muted/40 p-4 shadow-none">
          <div class="flex items-start gap-3">
            <div class="rounded-xl bg-primary/10 p-2 text-primary">
              <ShieldCheck class="size-5" />
            </div>
            <div>
              <p class="text-xs font-semibold text-foreground">
                Confidential & Secure Care
              </p>
              <p class="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Your medical history, appointment bookings, and personal records are encrypted and protected by health data confidentiality standards.
              </p>
            </div>
          </div>
        </Card>

        <!-- Quick Navigation Links -->
        <Card class="p-4 shadow-xs">
          <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Navigation
          </p>
          <div class="divide-y divide-border/60">
            <NuxtLink
              to="/dashboard/appointments"
              class="flex items-center justify-between py-2.5 text-xs font-medium text-foreground transition-colors hover:text-primary"
            >
              <span class="flex items-center gap-2.5">
                <Calendar class="size-4 text-muted-foreground" />
                My Appointments
              </span>
              <ChevronRight class="size-3.5 text-muted-foreground" />
            </NuxtLink>
            <NuxtLink
              to="/dashboard/payments"
              class="flex items-center justify-between py-2.5 text-xs font-medium text-foreground transition-colors hover:text-primary"
            >
              <span class="flex items-center gap-2.5">
                <CreditCard class="size-4 text-muted-foreground" />
                My Payments & Receipts
              </span>
              <ChevronRight class="size-3.5 text-muted-foreground" />
            </NuxtLink>
          </div>
        </Card>
      </div>

      <!-- Right Column: Personal Information & Settings -->
      <div class="space-y-6">
        <!-- Personal Details Card -->
        <Card class="border-border/80 shadow-xs">
          <CardHeader class="border-b border-border/60 pb-5">
            <CardTitle class="text-lg font-semibold text-foreground">
              Personal Details
            </CardTitle>
            <CardDescription class="text-xs text-muted-foreground">
              Update your primary profile details below. Your full name will be visible to your doctors during video sessions.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-5 p-6">
            <!-- Full Name -->
            <div>
              <label for="name" class="flex items-center justify-between text-sm font-medium text-foreground">
                <span>Full Name <span class="text-destructive">*</span></span>
                <span class="text-xs text-muted-foreground">Required</span>
              </label>
              <div class="relative mt-1.5">
                <User class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  v-model="name"
                  class="h-11 rounded-xl pl-10"
                  data-testid="profile-name"
                  :error="!!nameError"
                  placeholder="Enter your full name"
                  @input="clearNameError"
                />
              </div>
              <p v-if="nameError" class="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle class="size-3.5 shrink-0" />
                {{ nameError }}
              </p>
              <p v-else class="mt-1.5 text-xs text-muted-foreground">
                Please use the name you would like your counselors and doctors to address you by.
              </p>
            </div>

            <!-- Phone Number -->
            <div>
              <label for="phone" class="flex items-center justify-between text-sm font-medium text-foreground">
                <span>Phone Number</span>
                <span class="text-xs text-muted-foreground">Optional</span>
              </label>
              <div class="relative mt-1.5">
                <Phone class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  v-model="phone"
                  type="tel"
                  class="h-11 rounded-xl pl-10"
                  data-testid="profile-phone"
                  placeholder="+20 100 000 0000"
                />
              </div>
              <p class="mt-1.5 text-xs text-muted-foreground">
                Used for urgent appointment notifications and SMS session reminders.
              </p>
            </div>

            <!-- Email Address (Read-only) -->
            <div>
              <label class="flex items-center justify-between text-sm font-medium text-foreground">
                <span>Email Address</span>
                <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock class="size-3" />
                  Permanent ID
                </span>
              </label>
              <div
                class="relative mt-1.5 flex h-11 items-center justify-between rounded-xl border border-input bg-muted/50 px-3.5 text-sm text-muted-foreground"
                data-testid="profile-email"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <Mail class="size-4 shrink-0 text-muted-foreground" />
                  <span class="truncate font-medium text-foreground/80">{{ profile?.email }}</span>
                </div>
                <Badge variant="outline" class="shrink-0 gap-1 bg-background text-[11px] font-normal">
                  <CheckCircle2 class="size-3 text-emerald-600" />
                  Verified
                </Badge>
              </div>
              <p class="mt-1.5 text-xs text-muted-foreground">
                Your email is tied to your login credentials and cannot be edited directly.
              </p>
            </div>
          </CardContent>

          <!-- Footer Actions -->
          <CardFooter class="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-6 py-4">
            <div>
              <span v-if="isDirty" class="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <span class="size-2 animate-pulse rounded-full bg-amber-500" />
                You have unsaved changes
              </span>
              <span v-else class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check class="size-3.5 text-emerald-600" />
                All changes saved
              </span>
            </div>

            <div class="flex items-center gap-2.5">
              <Button
                v-if="isDirty"
                type="button"
                variant="ghost"
                size="sm"
                class="gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                :disabled="saving"
                @click="discardChanges"
              >
                <RotateCcw class="size-3.5" />
                Discard
              </Button>

              <Button
                type="button"
                class="gap-2 rounded-xl px-5 text-xs font-semibold"
                data-testid="save-profile"
                :disabled="saving"
                @click="save"
              >
                <Loader2 v-if="saving" class="size-3.5 animate-spin" />
                <Check v-else class="size-3.5" />
                {{ saving ? 'Saving…' : 'Save Changes' }}
              </Button>
            </div>
          </CardFooter>
        </Card>

        <!-- Account Security & Credentials Card -->
        <Card class="border-border/80 shadow-xs">
          <CardHeader class="border-b border-border/60 pb-5">
            <CardTitle class="text-lg font-semibold text-foreground">
              Account Security
            </CardTitle>
            <CardDescription class="text-xs text-muted-foreground">
              Manage your password and review your account authentication security.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-3.5 p-6">
            <!-- Password Row -->
            <div class="flex flex-col justify-between gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/10 sm:flex-row sm:items-center">
              <div class="flex items-center gap-3">
                <div class="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <KeyRound class="size-5" />
                </div>
                <div>
                  <p class="text-sm font-semibold text-foreground">
                    Password Protection
                  </p>
                  <p class="text-xs text-muted-foreground">
                    •••••••••••• (Encrypted and hashed)
                  </p>
                </div>
              </div>

              <NuxtLink
                to="/forgot-password"
                class="inline-flex items-center gap-1.5 rounded-lg border border-border/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary hover:text-primary"
              >
                <Lock class="size-3 text-muted-foreground" />
                Reset Password
              </NuxtLink>
            </div>

            <!-- Verification Status Row -->
            <div class="flex flex-col justify-between gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/10 sm:flex-row sm:items-center">
              <div class="flex items-center gap-3">
                <div class="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                  <CheckCircle2 class="size-5" />
                </div>
                <div>
                  <p class="text-sm font-semibold text-foreground">
                    Two-Factor & Session Security
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Secure HTTP-only session tokens with email verification active
                  </p>
                </div>
              </div>

              <Badge variant="success" class="self-start text-xs font-medium sm:self-auto">
                Protected
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
