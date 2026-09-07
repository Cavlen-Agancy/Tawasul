import type {
  Appointment,
  AppointmentResponse,
  PatientProfile,
  PaymentsResponse,
  PaymentRecord,
  SessionRoomResponse,
} from './types'
import { getApiMessage } from '~/lib/api'

export interface AvailableSlot {
  startTime: string
  endTime: string
  sessionDuration: number
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
    try {
      const data = await $fetch<{ dates: string[] }>('/api/booking/available-dates', {
        query: { month, year },
      })
      availableDates.value = data.dates
      return data.dates
    } catch (e) {
      error.value = getApiMessage(e)
      return []
    }
  }

  async function fetchAvailableSlots(date: string): Promise<AvailableSlot[]> {
    try {
      const data = await $fetch<{ slots: AvailableSlot[] }>('/api/booking/available-slots', {
        query: { date },
      })
      availableSlots.value = data.slots
      return data.slots
    } catch (e) {
      error.value = getApiMessage(e)
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
    if (bookings.length === 0) {
      await fetchAvailableSlots(date)
    }
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
    fetchProfile,
    updateProfile,
    uploadPhoto,
    fetchAppointments,
    fetchAllAppointments,
    cancelAppointment,
    fetchAllBookings,
    fetchAvailableDates,
    fetchAvailableSlots,
    fetchBookingsForDate,
    selectDate,
    fetchPayments,
    fetchSession,
    clear,
  }
}
