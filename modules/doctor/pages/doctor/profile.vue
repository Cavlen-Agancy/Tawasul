<script setup lang="ts">
definePageMeta({
  layout: 'doctor-layout',
  middleware: ['auth', 'doctor-only'],
})

const { profile, isLoading, error, fetchProfile, updateProfile, uploadPhoto } = useDoctorDashboard()
const { toast } = useToast()

const name = ref('')
const phone = ref('')
const bio = ref('')
const specializations = ref<string[]>([])
const saving = ref(false)

const photoInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

function fillForm() {
  name.value = profile.value?.name ?? ''
  phone.value = profile.value?.phone ?? ''
  bio.value = profile.value?.bio ?? ''
  specializations.value = [...(profile.value?.specializations ?? [])]
}

async function save() {
  saving.value = true
  try {
    await updateProfile({
      name: name.value,
      phone: phone.value,
      bio: bio.value,
      specializations: specializations.value,
    })
    fillForm()
    toast({ title: 'Profile updated', variant: 'success' })
  } catch (e) {
    toast({
      title: (e as { data?: { message?: string } }).data?.message || 'Could not update profile',
      variant: 'destructive',
    })
  } finally {
    saving.value = false
  }
}

function triggerUpload() {
  photoInput.value?.click()
}

async function onPhotoSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  uploading.value = true
  try {
    await uploadPhoto(file)
    toast({ title: 'Photo updated', variant: 'success' })
  } catch (err) {
    toast({
      title: (err as { data?: { message?: string } }).data?.message || 'Could not upload photo',
      variant: 'destructive',
    })
  } finally {
    uploading.value = false
  }
}

onMounted(async () => {
  await fetchProfile()
  fillForm()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[900px]">
    <h1 class="text-2xl font-semibold tracking-tight text-foreground" data-testid="page-title">
      My Profile
    </h1>
    <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

    <div v-if="isLoading && !profile" class="mt-6 grid gap-4">
      <Skeleton class="h-24 w-full" />
      <Skeleton class="h-12 w-full" />
      <Skeleton class="h-12 w-full" />
    </div>

    <Card v-else class="mt-6">
      <CardContent class="grid gap-8 p-6 md:grid-cols-[220px_1fr]">
        <div class="flex flex-col items-center gap-3">
          <Avatar class="size-32">
            <AvatarImage :src="profile?.photo || undefined" :alt="profile?.name" />
            <AvatarFallback class="text-3xl">{{ profile?.name?.slice(0, 1).toUpperCase() }}</AvatarFallback>
          </Avatar>
          <input
            ref="photoInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            data-testid="photo-input"
            @change="onPhotoSelected"
          />
          <Button variant="outline" size="sm" data-testid="upload-photo" :disabled="uploading" @click="triggerUpload">
            {{ uploading ? 'Uploading…' : 'Upload Photo' }}
          </Button>
        </div>

        <div class="grid gap-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground" for="doctor-name">Name</label>
            <Input id="doctor-name" v-model="name" type="text" data-testid="doctor-profile-name" />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground" for="doctor-phone">Phone</label>
            <Input id="doctor-phone" v-model="phone" type="tel" data-testid="doctor-profile-phone" />
          </div>
          <div>
            <span class="mb-1.5 block text-sm font-medium text-foreground">Email</span>
            <p class="text-sm text-muted-foreground" data-testid="doctor-profile-email">{{ profile?.email }}</p>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground" for="doctor-bio">Bio</label>
            <textarea
              id="doctor-bio"
              v-model="bio"
              rows="4"
              class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              data-testid="doctor-profile-bio"
            />
            <p v-if="!bio" class="mt-1 text-xs text-yellow-700" data-testid="bio-warning">
              Add a bio so patients can find you.
            </p>
          </div>
          <div>
            <span class="mb-1.5 block text-sm font-medium text-foreground">Specializations</span>
            <SpecializationsTagInput v-model="specializations" />
          </div>
          <div>
            <Button data-testid="save-profile" :disabled="saving" @click="save">
              {{ saving ? 'Saving…' : 'Save Changes' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
