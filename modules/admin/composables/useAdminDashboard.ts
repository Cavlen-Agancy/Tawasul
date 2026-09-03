import type { AdminBooking, AdminDoctor, AdminSchedule, BlockedDate, PendingBooking } from './types'

export function useAdminDashboard() {
  const schedules = ref<AdminSchedule[]>([])
  const blockedDates = ref<BlockedDate[]>([])
  const pendingBookings = ref<PendingBooking[]>([])
  const activeDoctors = ref<AdminDoctor[]>([])
  const bookings = ref<AdminBooking[]>([])

  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeSchedules = computed(() => schedules.value.filter((s) => s.isActive))
  const upcomingBlockedDates = computed(() =>
    blockedDates.value
      .filter((b) => b.date >= new Date().toISOString().slice(0, 10))
      .sort((a, b) => a.date.localeCompare(b.date)),
  )

  function extractMessage(e: unknown): string {
    return (e as { data?: { message?: string } }).data?.message || 'Something went wrong'
  }

  async function unwrap<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      error.value = null
      return await fn()
    } catch (e) {
      error.value = extractMessage(e)
      return null
    }
  }

  async function fetchAll() {
    loading.value = true
    await Promise.all([
      fetchSchedules(),
      fetchBlockedDates(),
      fetchPendingBookings(),
      fetchActiveDoctors(),
      fetchBookings(),
    ])
    loading.value = false
  }

  async function fetchSchedules() {
    const data = await unwrap(() => $fetch<AdminSchedule[]>('/api/admin/schedules'))
    if (data) schedules.value = data
  }

  async function addSchedule(input: Omit<AdminSchedule, 'id'>): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<AdminSchedule>('/api/admin/schedules', { method: 'POST', body: input }),
    )
    if (data) {
      schedules.value = [...schedules.value, data]
      return true
    }
    return false
  }

  async function updateSchedule(id: string, input: Partial<AdminSchedule>): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<AdminSchedule>(`/api/admin/schedules/${id}`, { method: 'PATCH', body: input }),
    )
    if (data) {
      schedules.value = schedules.value.map((s) => (s.id === id ? { ...s, ...data } : s))
      return true
    }
    return false
  }

  async function deleteSchedule(id: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ ok: true }>(`/api/admin/schedules/${id}`, { method: 'DELETE' }),
    )
    if (data) {
      schedules.value = schedules.value.filter((s) => s.id !== id)
      return true
    }
    return false
  }

  async function fetchBlockedDates() {
    const data = await unwrap(() => $fetch<BlockedDate[]>('/api/admin/blocked-dates'))
    if (data) blockedDates.value = data
  }

  async function blockDate(input: { date: string; reason?: string | null }): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<BlockedDate>('/api/admin/blocked-dates', { method: 'POST', body: input }),
    )
    if (data) {
      blockedDates.value = [...blockedDates.value, data]
      return true
    }
    return false
  }

  async function unblockDate(id: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ ok: true }>(`/api/admin/blocked-dates/${id}`, { method: 'DELETE' }),
    )
    if (data) {
      blockedDates.value = blockedDates.value.filter((b) => b.id !== id)
      return true
    }
    return false
  }

  async function fetchPendingBookings() {
    const data = await unwrap(() =>
      $fetch<PendingBooking[]>('/api/admin/pending-bookings', { query: { status: 'PENDING' } }),
    )
    if (data) pendingBookings.value = data
  }

  async function fetchBookings() {
    const data = await unwrap(() => $fetch<AdminBooking[]>('/api/admin/bookings'))
    if (data) bookings.value = data
  }

  async function updateBookingStatus(id: string, status: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ ok: true }>(`/api/admin/bookings/${id}/status`, { method: 'PATCH', body: { status } }),
    )
    if (data) {
      bookings.value = bookings.value.map((b) => (b.id === id ? { ...b, status } : b))
      pendingBookings.value = pendingBookings.value.filter((b) => b.id !== id)
      return true
    }
    return false
  }

  async function assignDoctor(bookingId: string, doctorId: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ ok: true }>(`/api/admin/bookings/${bookingId}/assign`, {
        method: 'POST',
        body: { doctorId },
      }),
    )
    if (data) {
      pendingBookings.value = pendingBookings.value.filter((b) => b.id !== bookingId)
      return true
    }
    return false
  }

  async function fetchActiveDoctors() {
    const data = await unwrap(() => $fetch<AdminDoctor[]>('/api/admin/doctors?active=true'))
    if (data) activeDoctors.value = data
  }

  return {
    schedules,
    activeSchedules,
    blockedDates,
    upcomingBlockedDates,
    pendingBookings,
    activeDoctors,
    bookings,
    loading,
    error,
    fetchAll,
    fetchSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    fetchBlockedDates,
    blockDate,
    unblockDate,
    fetchPendingBookings,
    fetchBookings,
    updateBookingStatus,
    assignDoctor,
    fetchActiveDoctors,
  }
}