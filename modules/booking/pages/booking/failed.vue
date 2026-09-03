<script setup lang="ts">
import { XCircle } from 'lucide-vue-next'

definePageMeta({ layout: 'patient-layout' })

const { fetchBookingDetail, retryPayment, bookingId, isLoading, error, reset } = useBooking()

const route = useRoute()
const booking = ref<Awaited<ReturnType<typeof fetchBookingDetail>> | null>(null)
const loaded = ref(false)

async function load() {
  const id = route.query.bookingId
  if (typeof id === 'string' && id) {
    bookingId.value = id
    booking.value = await fetchBookingDetail(id)
  }
  loaded.value = true
}

onMounted(load)

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function chooseDifferentTime() {
  reset()
  navigateTo('/book')
}
</script>

<template>
  <div class="flex w-full justify-center px-4 py-12 lg:py-20">
    <div class="w-full max-w-[520px]">
      <Card v-if="loaded" class="w-full p-6 sm:p-8">
        <CardHeader class="items-center p-0 pb-6 text-center">
          <XCircle class="h-14 w-14 text-destructive" />
          <CardTitle class="text-2xl font-semibold tracking-tight">
            Payment was not completed
          </CardTitle>
          <CardDescription class="mt-2 text-sm">
            Your payment didn't go through. Your session isn't confirmed yet.
          </CardDescription>
        </CardHeader>

        <CardContent v-if="booking" class="p-0">
          <dl class="divide-y divide-border rounded-2xl border border-border">
            <div v-if="booking.doctorName" class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Doctor</dt>
              <dd class="text-sm font-medium text-foreground">{{ booking.doctorName }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Date</dt>
              <dd class="text-sm font-medium text-foreground">{{ formatDateLabel(booking.date) }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Time</dt>
              <dd class="text-sm font-medium text-foreground">{{ booking.startTime }} – {{ booking.endTime }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Service</dt>
              <dd class="text-sm font-medium text-foreground">{{ booking.service }}</dd>
            </div>
            <div class="flex justify-between px-5 py-4">
              <dt class="text-sm text-muted-foreground">Price</dt>
              <dd class="text-sm font-medium text-foreground">
                {{ booking.amount.toLocaleString() }} {{ booking.currency }}
              </dd>
            </div>
          </dl>
        </CardContent>

        <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

        <CardFooter class="flex flex-col gap-3 p-0 pt-6">
          <Button class="w-full" :disabled="isLoading" @click="retryPayment">
            {{ isLoading ? 'Preparing your payment…' : 'Try Again' }}
          </Button>
          <Button variant="outline" class="w-full" @click="chooseDifferentTime">
            Choose a Different Time
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
