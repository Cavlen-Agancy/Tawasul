import type {
  Appointment,
  AppointmentResponse,
  PatientProfile,
  PaymentsResponse,
  PaymentRecord,
  SessionRoomResponse,
  SessionType,
} from './types'
import { getApiMessage } from '~/lib/api'

export interface AvailableSlot {
  startTime: string
  endTime: string
  sessionDuration: number
  current?: boolean
}

export type BookingSessionType = SessionType

export interface CreateBookingResult {
  bookingId: string
  amount: number
  currency: string
  sessionType: BookingSessionType
  paymentUrl?: string
}

export function usePatientDashboard() {
  const profile = useState<PatientProfile | null>('patient-profile', () => null)
  const upcomingAppointments = useState<Appointment[]>('patient-upcoming-appointments', () => [])
  const pastAppointments = useState<Appointment[]>('patient-past-appointments', () => [])
  const payments = useState<PaymentRecord[]>('patient-payments', () => [])
  const isLoading = useState<boolean>('patient-dashboard-loading', () => false)
  const error = useState<string | null>('patient-dashboard-error', () => null)
  const allBookings = useState<Appointment[]>('patient-all-bookings', () => [])
  const availableDates = useState<string[]>('patient-available-dates', () => [])
  const availableSlots = useState<AvailableSlot[]>('patient-available-slots', () => [])
  const selectedDate = useState<string | null>('patient-selected-date', () => null)
  const fetchError = useState<string | null>('patient-fetch-error', () => null)

  // ── Booking creation flow (right slide-in panel, replaces the old /book page) ──
  const bookingFlowOpen = useState<boolean>('patient-booking-flow-open', () => false)
  const bookingStep = useState<number>('patient-booking-step', () => 1)
  const bookingSessionType = useState<BookingSessionType>('patient-booking-session-type', () => 'ONLINE')
  const bookingFlowDate = useState<string | null>('patient-booking-flow-date', () => null)
  const bookingFlowSlots = useState<AvailableSlot[]>('patient-booking-flow-slots', () => [])
  const bookingFlowTime = useState<string | null>('patient-booking-flow-time', () => null)
  const bookingFlowLoading = useState<boolean>('patient-booking-flow-loading', () => false)
  const bookingFlowError = useState<string | null>('patient-booking-flow-error', () => null)
  const bookingFlowSuccess = useState<string | null>('patient-booking-flow-success', () => null)
  const bookingFlowBookingId = useState<string | null>('patient-booking-flow-booking-id', () => null)
  const bookingFlowAmount = useState<number>('patient-booking-flow-amount', () => 0)
  const bookingFlowCurrency = useState<string>('patient-booking-flow-currency', () => 'EGP')

  function clearFetchError(): void {
    fetchError.value = null
  }

  function isClosedDay(dateString: string): boolean {
    const [y, m, d] = dateString.split('-').map((v) => parseInt(v, 10))
    if (!y || !m || !d) return false
    // Friday only is the weekly closure day (Sunday = 0 .. Saturday = 6).
    return new Date(y, (m || 1) - 1, d).getDay() === 5
  }

  function getClosedDayMessage(): string {
    return 'The clinic is closed on Fridays.'
  }

  async function fetchProfile(): Promise<PatientProfile | null> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<PatientProfile>('/api/patient/profile')
      profile.value = data
      return data
    } catch (e) {
      error.value = getApiMessage(e)
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function updateProfile(data: { name: string; phone?: string }): Promise<PatientProfile | null> {
    isLoading.value = true
    error.value = null
    try {
      const updated = await $fetch<PatientProfile>('/api/patient/profile', {
        method: 'PATCH',
        body: data,
      })
      profile.value = updated
      return updated
    } catch (e) {
      error.value = getApiMessage(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    isLoading.value = true
    error.value = null
    try {
      const form = new FormData()
      form.append('file', file)
      const data = await $fetch<{ photoUrl: string }>('/api/patient/profile/photo', {
        method: 'POST',
        body: form,
      })
      if (profile.value) profile.value.photo = data.photoUrl
      return data.photoUrl
    } catch (e) {
      error.value = getApiMessage(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAppointments(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const [upcoming, past] = await Promise.all([
        $fetch<AppointmentResponse>('/api/patient/appointments', { query: { tab: 'upcoming' } }),
        $fetch<AppointmentResponse>('/api/patient/appointments', { query: { tab: 'past' } }),
      ])
      upcomingAppointments.value = upcoming.appointments
      pastAppointments.value = past.appointments
    } catch (e) {
      error.value = getApiMessage(e)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAllAppointments(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<AppointmentResponse>('/api/patient/appointments', { query: { tab: 'all' } })
      upcomingAppointments.value = data.appointments
      pastAppointments.value = []
    } catch (e) {
      error.value = getApiMessage(e)
    } finally {
      isLoading.value = false
    }
  }

  async function cancelAppointment(bookingId: string): Promise<void> {
    error.value = null
    try {
      await $fetch(`/api/booking/${bookingId}/cancel`, { method: 'PATCH' })
      const moved = upcomingAppointments.value.find((a) => a.id === bookingId)
      upcomingAppointments.value = upcomingAppointments.value.filter((a) => a.id !== bookingId)
      if (moved) {
        pastAppointments.value = [{ ...moved, status: 'CANCELLED' }, ...pastAppointments.value]
      }
      allBookings.value = allBookings.value.map((a) =>
        a.id === bookingId ? { ...a, status: 'CANCELLED' } : a,
      )
    } catch (e) {
      error.value = getApiMessage(e)
      throw e
    }
  }

  async function updateBookingTime(bookingId: string, startTime: string): Promise<Appointment> {
    error.value = null
    try {
      const updated = await $fetch<Appointment>(`/api/booking/${bookingId}`, {
        method: 'PATCH',
        body: { startTime },
      })
      allBookings.value = allBookings.value.map((a) => (a.id === bookingId ? updated : a))
      return updated
    } catch (e) {
      error.value = getApiMessage(e)
      throw e
    }
  }

  async function fetchAllBookings(): Promise<Appointment[]> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<AppointmentResponse>('/api/patient/appointments', { query: { tab: 'all' } })
      allBookings.value = data.appointments
      return allBookings.value
    } catch (e) {
      error.value = getApiMessage(e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAvailableDates(month: number, year: number): Promise<string[]> {
    fetchError.value = null
    try {
      const data = await $fetch<{ dates: string[] }>('/api/booking/available-dates', {
        query: { month, year },
      })
      availableDates.value = data.dates
      return data.dates
    } catch (e) {
      error.value = getApiMessage(e)
      fetchError.value = getApiMessage(e) || 'Failed to load availability. Please try again.'
      return []
    }
  }

  async function fetchAvailableSlots(date: string): Promise<AvailableSlot[]> {
    fetchError.value = null
    try {
      const data = await $fetch<{ slots: AvailableSlot[] }>('/api/booking/available-slots', {
        query: { date },
      })
      availableSlots.value = data.slots
      return data.slots
    } catch (e) {
      error.value = getApiMessage(e)
      fetchError.value = getApiMessage(e) || 'Failed to load availability. Please try again.'
      return []
    }
  }

  function fetchBookingsForDate(date: string): Appointment[] {
    return allBookings.value.filter((a) => a.date === date)
  }

  async function selectDate(date: string): Promise<Appointment[]> {
    selectedDate.value = date
    availableSlots.value = []
    const bookings = fetchBookingsForDate(date)
    // Always fetch slots so booked days can still offer remaining free times.
    await fetchAvailableSlots(date)
    return bookings
  }

  async function fetchPayments(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<PaymentsResponse>('/api/patient/payments')
      payments.value = data.payments
    } catch (e) {
      error.value = getApiMessage(e)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSession(bookingId: string): Promise<SessionRoomResponse | null> {
    try {
      return await $fetch<SessionRoomResponse>(`/api/patient/session/${bookingId}`)
    } catch {
      return null
    }
  }

  function openBookingFlow(prefillDate?: string | null): void {
    bookingFlowOpen.value = true
    bookingStep.value = 1
    bookingFlowError.value = null
    bookingFlowSuccess.value = null
    bookingFlowTime.value = null
    if (prefillDate) {
      bookingFlowDate.value = prefillDate
      void fetchBookingFlowSlots(prefillDate)
    }
  }

  function closeBookingFlow(): void {
    bookingFlowOpen.value = false
    bookingStep.value = 1
    bookingFlowError.value = null
    bookingFlowSuccess.value = null
    bookingFlowBookingId.value = null
    bookingFlowTime.value = null
    bookingFlowLoading.value = false
  }

  function setBookingSessionType(type: BookingSessionType): void {
    bookingSessionType.value = type
    bookingFlowError.value = null
  }

  function goBookingStep(step: number): void {
    bookingStep.value = step
    bookingFlowError.value = null
  }

  async function fetchBookingFlowSlots(date: string): Promise<AvailableSlot[]> {
    bookingFlowDate.value = date
    bookingFlowTime.value = null
    bookingFlowLoading.value = true
    bookingFlowError.value = null
    try {
      const data = await $fetch<{ slots: AvailableSlot[] }>('/api/booking/available-slots', {
        query: { date },
      })
      bookingFlowSlots.value = data.slots
      return data.slots
    } catch (e) {
      bookingFlowError.value = getApiMessage(e)
      bookingFlowSlots.value = []
      return []
    } finally {
      bookingFlowLoading.value = false
    }
  }

  function selectBookingFlowTime(startTime: string): void {
    bookingFlowTime.value = startTime
    bookingFlowError.value = null
  }

  async function submitBookingFlow(): Promise<CreateBookingResult | null> {
    if (!bookingFlowDate.value || !bookingFlowTime.value) {
      bookingFlowError.value = 'Please select a date and time'
      return null
    }
    bookingFlowLoading.value = true
    bookingFlowError.value = null
    try {
      const created = await $fetch<{ bookingId: string; amount: number; currency: string }>(
        '/api/booking/create',
        {
          method: 'POST',
          body: {
            date: bookingFlowDate.value,
            startTime: bookingFlowTime.value,
            sessionType: bookingSessionType.value,
          },
        },
      )
      bookingFlowAmount.value = created.amount
      bookingFlowCurrency.value = created.currency
      bookingFlowBookingId.value = created.bookingId

      if (bookingSessionType.value === 'IN_CLINIC') {
        bookingFlowSuccess.value = created.bookingId
        await fetchAllBookings()
        return {
          bookingId: created.bookingId,
          amount: created.amount,
          currency: created.currency,
          sessionType: 'IN_CLINIC',
        }
      }

      const payment = await $fetch<{ paymentUrl?: string; clientSecret?: string }>(
        '/api/payment/initiate',
        {
          method: 'POST',
          body: { bookingId: created.bookingId },
        },
      )
      if (payment.paymentUrl) {
        window.location.href = payment.paymentUrl
        return {
          bookingId: created.bookingId,
          amount: created.amount,
          currency: created.currency,
          sessionType: 'ONLINE',
          paymentUrl: payment.paymentUrl,
        }
      }
      bookingFlowSuccess.value = created.bookingId
      await fetchAllBookings()
      if (payment.clientSecret) {
        bookingFlowError.value = 'Online checkout is not configured on this deployment. Your booking will remain pending.'
      }
      return {
        bookingId: created.bookingId,
        amount: created.amount,
        currency: created.currency,
        sessionType: 'ONLINE',
      }
    } catch (e) {
      bookingFlowError.value = getApiMessage(e)
      return null
    } finally {
      bookingFlowLoading.value = false
    }
  }

  async function retryBookingPayment(bookingId: string): Promise<boolean> {
    bookingFlowLoading.value = true
    bookingFlowError.value = null
    try {
      const payment = await $fetch<{ paymentUrl?: string }>('/api/payment/initiate', {
        method: 'POST',
        body: { bookingId },
      })
      if (payment.paymentUrl) {
        window.location.href = payment.paymentUrl
        return true
      }
      return false
    } catch (e) {
      bookingFlowError.value = getApiMessage(e)
      return false
    } finally {
      bookingFlowLoading.value = false
    }
  }

  async function rescheduleBooking(bookingId: string, date: string, startTime: string): Promise<Appointment> {
    error.value = null
    try {
      const updated = await $fetch<Appointment>(`/api/patient/appointments/${bookingId}/reschedule`, {
        method: 'PATCH',
        body: { date, startTime },
      })
      allBookings.value = allBookings.value.map((a) => (a.id === bookingId ? updated : a))
      return updated
    } catch (e) {
      // Fallback to the existing same-day time-update endpoint when the
      // reschedule endpoint is unavailable and the date is unchanged.
      const current = allBookings.value.find((a) => a.id === bookingId)
      const statusCode = (e as { response?: { status?: number } }).response?.status
      if (current && current.date === date && (statusCode === 404 || statusCode === undefined)) {
        try {
          return await updateBookingTime(bookingId, startTime)
        } catch (fallbackError) {
          error.value = getApiMessage(fallbackError)
          throw fallbackError
        }
      }
      error.value = getApiMessage(e)
      throw e
    }
  }

  function clear() {
    profile.value = null
    upcomingAppointments.value = []
    pastAppointments.value = []
    payments.value = []
    allBookings.value = []
    availableDates.value = []
    availableSlots.value = []
    selectedDate.value = null
    error.value = null
    bookingFlowOpen.value = false
    bookingStep.value = 1
    bookingSessionType.value = 'ONLINE'
    bookingFlowDate.value = null
    bookingFlowSlots.value = []
    bookingFlowTime.value = null
    bookingFlowLoading.value = false
    bookingFlowError.value = null
    bookingFlowSuccess.value = null
    bookingFlowBookingId.value = null
  }

  return {
    profile,
    upcomingAppointments,
    pastAppointments,
    payments,
    isLoading,
    error,
    allBookings,
    availableDates,
    availableSlots,
    selectedDate,
    fetchError,
    bookingFlowOpen,
    bookingStep,
    bookingSessionType,
    bookingFlowDate,
    bookingFlowSlots,
    bookingFlowTime,
    bookingFlowLoading,
    bookingFlowError,
    bookingFlowSuccess,
    bookingFlowBookingId,
    bookingFlowAmount,
    bookingFlowCurrency,
    clearFetchError,
    isClosedDay,
    getClosedDayMessage,
    fetchProfile,
    updateProfile,
    uploadPhoto,
    fetchAppointments,
    fetchAllAppointments,
    cancelAppointment,
    fetchAllBookings,
    updateBookingTime,
    rescheduleBooking,
    fetchAvailableDates,
    fetchAvailableSlots,
    fetchBookingsForDate,
    selectDate,
    fetchPayments,
    fetchSession,
    openBookingFlow,
    closeBookingFlow,
    setBookingSessionType,
    goBookingStep,
    fetchBookingFlowSlots,
    selectBookingFlowTime,
    submitBookingFlow,
    retryBookingPayment,
    clear,
  }
}
