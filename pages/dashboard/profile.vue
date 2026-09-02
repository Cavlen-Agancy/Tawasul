<script setup lang="ts">
import { Camera, Mail } from 'lucide-vue-next'

definePageMeta({
  layout: 'patient-layout',
  middleware: ['auth', 'patient-only'],
})

const { profile, isLoading, error, fetchProfile, updateProfile, uploadPhoto } = usePatientDashboard()
const { toast } = useToast()

const name = ref('')
const phone = ref('')
const photo = ref<string | undefined>(undefined)
const nameError = ref('')
const saving = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function applyProfile() {
  name.value = profile.value?.name ?? ''
  phone.value = profile.value?.phone ?? ''
  photo.value = profile.value?.photo ?? undefined
}

onMounted(async () => {
  await fetchProfile()
  applyProfile()
})

function onPickFile() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const photoUrl = await uploadPhoto(file)
    if (photoUrl) photo.value = photoUrl
    toast({ title: 'Photo updated', variant: 'success' })
  } catch (e) {
    toast({ title: (e as { data?: { message?: string } }).data?.message || 'Upload failed', variant: 'destructive' })
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function save() {
  nameError.value = ''
  if (!name.value.trim() || name.value.trim().length < 2) {
    nameError.value = 'Name must be at least 2 characters'
    return
  }
  saving.value = true
  try {
    await updateProfile({ name: name.value.trim(), phone: phone.value || undefined })
    toast({ title: 'Profile updated', variant: 'success' })
  } catch (e) {
    toast({ title: (e as { data?: { message?: string } }).data?.message || 'Could not save profile', variant: 'destructive' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
      Profile
    </h1>

    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <Skeleton v-if="isLoading" class="mt-6 h-64 w-full" />

    <div v-else class="mt-6 grid gap-8 md:grid-cols-[240px_1fr]">
      <div class="flex flex-col items-center gap-4 md:items-start">
        <Avatar class="size-28">
          <AvatarImage :src="photo" alt="Profile photo" />
          <AvatarFallback class="text-3xl">{{ (name || profile?.name || 'U').slice(0, 1) }}</AvatarFallback>
        </Avatar>

        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          data-testid="photo-input"
          @change="onFileSelected"
        >
        <Button variant="secondary" data-testid="upload-photo" :disabled="uploading" @click="onPickFile">
          <Camera class="size-4" />
          {{ uploading ? 'Uploading…' : 'Upload Photo' }}
        </Button>
      </div>

      <div class="space-y-5">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-foreground" for="name">Name</label>
          <Input id="name" v-model="name" data-testid="profile-name" :error="!!nameError" />
          <p v-if="nameError" class="mt-1 text-sm text-destructive">{{ nameError }}</p>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-foreground" for="phone">Phone</label>
          <Input id="phone" v-model="phone" data-testid="profile-phone" placeholder="+20 100 000 0000" />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-foreground">Email</label>
          <div class="flex h-12 items-center gap-2 rounded-xl border-[1.5px] border-input bg-[#F5F5F5] px-4 text-base text-muted-foreground" data-testid="profile-email">
            <Mail class="size-4" />
            {{ profile?.email }}
          </div>
        </div>

        <Button data-testid="save-profile" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save Changes' }}
        </Button>
      </div>
    </div>
  </div>
</template>
