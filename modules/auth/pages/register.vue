<script setup lang="ts">
import { z } from 'zod'
import { getApiMessage } from '~/lib/api'

definePageMeta({ layout: 'default', middleware: 'guest' })

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

const name = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const registered = ref(false)
const submitting = ref(false)

function issueFor(field: string): string | undefined {
  const parsed = registerSchema.safeParse({
    name: name.value,
    email: email.value,
    phone: phone.value || undefined,
    password: password.value,
    confirmPassword: confirmPassword.value,
  })
  if (!parsed.success) {
    return parsed.error.issues.find((i) => i.path[0] === field)?.message
  }
  return undefined
}

async function onSubmit() {
  error.value = ''
  const parsed = registerSchema.safeParse({
    name: name.value,
    email: email.value,
    phone: phone.value || undefined,
    password: password.value,
    confirmPassword: confirmPassword.value,
  })
  if (!parsed.success) return

  submitting.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        name: name.value,
        email: email.value,
        phone: phone.value || undefined,
        password: password.value,
      },
    })
    registered.value = true
  } catch (e) {
    error.value = getApiMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex w-full justify-center px-4 py-12 lg:py-20">
    <Card v-if="!registered" class="w-full max-w-[440px] p-6 sm:p-8">
      <CardHeader class="p-0 pb-6">
        <CardTitle class="text-2xl font-semibold tracking-tight">
          Create your account
        </CardTitle>
        <CardDescription class="mt-2 text-sm">
          Join Tawasul Academy and start your journey to wellbeing.
        </CardDescription>
      </CardHeader>

      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-1.5">
          <label for="register-name" class="text-sm font-medium">Full Name</label>
          <Input
            id="register-name"
            v-model="name"
            data-testid="register-name"
            name="name"
            autocomplete="name"
            placeholder="Ahmed Hassan"
            :error="Boolean(issueFor('name'))"
          >
          </Input>
          <p v-if="issueFor('name')" class="text-xs text-destructive">{{ issueFor('name') }}</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="register-email" class="text-sm font-medium">Email</label>
          <Input
            id="register-email"
            v-model="email"
            data-testid="register-email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="ahmed@example.com"
            :error="Boolean(issueFor('email'))"
          >
          </Input>
          <p v-if="issueFor('email')" class="text-xs text-destructive">{{ issueFor('email') }}</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="register-phone" class="text-sm font-medium">Phone <span class="text-muted-foreground">(optional)</span></label>
          <Input
            id="register-phone"
            v-model="phone"
            data-testid="register-phone"
            type="tel"
            name="phone"
            autocomplete="tel"
            placeholder="+20 100 000 0000"
            :error="Boolean(issueFor('phone'))"
          >
          </Input>
          <p v-if="issueFor('phone')" class="text-xs text-destructive">{{ issueFor('phone') }}</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="register-password" class="text-sm font-medium">Password</label>
          <Input
            id="register-password"
            v-model="password"
            data-testid="register-password"
            type="password"
            name="password"
            autocomplete="new-password"
            placeholder="At least 8 characters"
            :error="Boolean(issueFor('password'))"
          >
          </Input>
          <p v-if="issueFor('password')" class="text-xs text-destructive">{{ issueFor('password') }}</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="register-confirm" class="text-sm font-medium">Confirm Password</label>
          <Input
            id="register-confirm"
            v-model="confirmPassword"
            data-testid="register-confirm"
            type="password"
            name="confirmPassword"
            autocomplete="new-password"
            placeholder="Repeat your password"
            :error="Boolean(issueFor('confirmPassword'))"
          >
          </Input>
          <p v-if="issueFor('confirmPassword')" class="text-xs text-destructive">{{ issueFor('confirmPassword') }}</p>
        </div>

        <p v-if="error" data-testid="register-error" class="text-sm text-destructive">{{ error }}</p>

        <Button type="submit" data-testid="register-submit" class="mt-2 w-full" :disabled="submitting">
          {{ submitting ? 'Creating account…' : 'Create account' }}
        </Button>
      </form>

      <CardFooter class="p-0 pt-6">
        <p class="text-center text-sm text-muted-foreground">
          Already have an account?
          <NuxtLink to="/login" class="font-semibold text-primary hover:underline">
            Log in
          </NuxtLink>
        </p>
      </CardFooter>
    </Card>

    <Card v-else class="w-full max-w-[440px] p-6 sm:p-8">
      <CardHeader class="p-0 pb-4">
        <CardTitle class="text-2xl font-semibold tracking-tight">
          Check your email
        </CardTitle>
        <CardDescription class="mt-2 text-sm">
          We sent a verification link to <strong>{{ email }}</strong>. Click it to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent class="p-0">
        <p class="text-sm text-muted-foreground">Didn't receive it? Check your spam folder.</p>
      </CardContent>
      <CardFooter class="p-0 pt-6">
        <NuxtLink to="/login" class="text-sm font-semibold text-primary hover:underline">
          Back to login
        </NuxtLink>
      </CardFooter>
    </Card>
  </div>
</template>