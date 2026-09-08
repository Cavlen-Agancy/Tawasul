import type { AdminBooking, AdminDoctor, AdminDoctorDetail, AvailabilitySlot, BlockedSlot, AdminPayment, PaymentsSummary, AdminStaffMember, AdminPatient, AdminPatientDetail, AdminSettings, AdminOverview, AdminSchedule, BlockedDate, PendingBooking } from './types'

function formatDateISO(d: Date | string): string {
  // Calendar-day display: never construct a Date from a date-only string
  // (`new Date('YYYY-MM-DD')` is UTC midnight, so local getters flip the day
  // on UTC-X browsers). Date-only strings pass through; full ISO instants
  // from `@db.Date` readbacks (always UTC midnight) contribute their UTC day.
  if (typeof d === 'string') {
    const plain = d.match(/^(\d{4}-\d{2}-\d{2})/)
    if (plain) return plain[1] as string
  }
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useAdminDashboard() {
  const schedules = ref<AdminSchedule[]>([])
  const blockedDates = ref<BlockedDate[]>([])
  const pendingBookings = ref<PendingBooking[]>([])
  const activeDoctors = ref<AdminDoctor[]>([])
  const bookings = ref<AdminBooking[]>([])
  const doctors = ref<AdminDoctor[]>([])
  const currentDoctor = ref<AdminDoctorDetail | null>(null)
  const doctorAvailability = ref<AvailabilitySlot[]>([])
  const doctorBlockedSlots = ref<BlockedSlot[]>([])
  const payments = ref<AdminPayment[]>([])
  const paymentsSummary = ref<PaymentsSummary>({ totalRevenue: 0, totalRevenueThisMonth: 0, totalRefunded: 0 })
  const staff = ref<AdminStaffMember[]>([])
  const patients = ref<AdminPatient[]>([])
  const currentPatient = ref<AdminPatientDetail | null>(null)
  const settings = ref<AdminSettings | null>(null)
  const overview = ref<AdminOverview | null>(null)

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
    const data = await unwrap(() => $fetch<{ schedules: AdminSchedule[] }>('/api/admin/schedule'))
    if (data) schedules.value = data.schedules
  }

  async function addSchedule(input: Omit<AdminSchedule, 'id'>): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ schedule: AdminSchedule }>('/api/admin/schedule', { method: 'POST', body: input }),
    )
    if (data?.schedule) {
      schedules.value = [...schedules.value, data.schedule]
      return true
    }
    return false
  }

  async function updateSchedule(id: string, input: Partial<AdminSchedule>): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ schedule: AdminSchedule }>(`/api/admin/schedule/${id}`, { method: 'PATCH', body: input }),
    )
    if (data?.schedule) {
      schedules.value = schedules.value.map((s) => (s.id === id ? { ...s, ...data.schedule } : s))
      return true
    }
    return false
  }

  async function deleteSchedule(id: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ ok: true }>(`/api/admin/schedule/${id}`, { method: 'DELETE' }),
    )
    if (data?.ok) {
      schedules.value = schedules.value.filter((s) => s.id !== id)
      return true
    }
    return false
  }

  async function fetchBlockedDates() {
    const data = await unwrap(() => $fetch<{ blockedDates: Array<{ id: string; date: Date | string; reason: string | null }> }>('/api/admin/blocked-dates'))
    if (data) {
      blockedDates.value = data.blockedDates.map((b) => ({
        id: b.id,
        date: formatDateISO(b.date),
        reason: b.reason,
      }))
    }
  }

  async function blockDate(input: { date: string; reason?: string | null }): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ blockedDate: { id: string; date: Date | string; reason: string | null } }>('/api/admin/blocked-dates', {
        method: 'POST',
        body: input,
      }),
    )
    if (data?.blockedDate) {
      blockedDates.value = [
        ...blockedDates.value,
        {
          id: data.blockedDate.id,
          date: formatDateISO(data.blockedDate.date),
          reason: data.blockedDate.reason,
        },
      ]
      return true
    }
    return false
  }

  async function unblockDate(id: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ ok: true }>(`/api/admin/blocked-dates/${id}`, { method: 'DELETE' }),
    )
    if (data?.ok) {
      blockedDates.value = blockedDates.value.filter((b) => b.id !== id)
      return true
    }
    return false
  }

  async function fetchPendingBookings() {
    const data = await unwrap(() =>
      $fetch<{ bookings: PendingBooking[] }>('/api/admin/bookings/pending'),
    )
    if (data) pendingBookings.value = data.bookings ?? []
  }

  async function fetchBookings(filters: Record<string, string> = {}) {
    const data = await unwrap(() =>
      $fetch<{ bookings: AdminBooking[] }>('/api/admin/bookings', { query: filters }),
    )
    if (data) bookings.value = data.bookings ?? []
  }

  async function cancelBooking(id: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ message: string }>(`/api/admin/bookings/${id}/cancel`, {
        method: 'PATCH',
      }),
    )
    if (data) {
      bookings.value = bookings.value.map((b) => (b.id === id ? { ...b, status: 'CANCELLED' } : b))
      pendingBookings.value = pendingBookings.value.filter((b) => b.id !== id)
      return true
    }
    return false
  }

  async function assignDoctor(bookingId: string, doctorId: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ booking: { id: string; doctorId: string | null; status: string } }>(
        `/api/admin/bookings/${bookingId}/assign`,
        { method: 'PATCH', body: { doctorId } },
      ),
    )
    if (data?.booking) {
      pendingBookings.value = pendingBookings.value.filter((b) => b.id !== bookingId)
      bookings.value = bookings.value.map((b) =>
        b.id === bookingId ? { ...b, doctorId: data.booking.doctorId, status: data.booking.status } : b,
      )
      return true
    }
    return false
  }

  async function fetchActiveDoctors() {
    const data = await unwrap(() => $fetch<{ doctors: AdminDoctor[] }>('/api/admin/doctors?active=true'))
    if (data) activeDoctors.value = data.doctors ?? []
  }

  async function fetchDoctorDayBookings(doctorId: string, date: string): Promise<AdminBooking[]> {
    const data = await unwrap(() =>
      $fetch<{ bookings: AdminBooking[] }>('/api/admin/bookings', {
        query: { doctorId, start: date, end: date },
      }),
    )
    return data?.bookings ?? []
  }

  async function fetchDoctors() {
    const data = await unwrap(() => $fetch<{ doctors: AdminDoctor[] }>('/api/admin/doctors'))
    if (data) doctors.value = data.doctors ?? []
  }

  async function fetchDoctor(id: string): Promise<AdminDoctorDetail | null> {
    const data = await unwrap(() => $fetch<AdminDoctorDetail>(`/api/admin/doctors/${id}`))
    if (data) {
      currentDoctor.value = data
      doctorAvailability.value = data.availability ?? []
      doctorBlockedSlots.value = data.blockedSlots ?? []
      return data
    }
    return null
  }

  async function createDoctor(input: { name: string; email: string; phone?: string; bio?: string; specializations?: string[] }): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ id: string }>('/api/admin/doctors', { method: 'POST', body: input }),
    )
    if (data) {
      await fetchDoctors()
      return true
    }
    return false
  }

  async function updateDoctor(id: string, input: Record<string, unknown>): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<AdminDoctorDetail>(`/api/admin/doctors/${id}`, { method: 'PATCH', body: input }),
    )
    if (data) {
      doctors.value = doctors.value.map((d) => (d.id === id ? { ...d, ...data } : d))
      if (currentDoctor.value?.id === id) {
        currentDoctor.value = { ...currentDoctor.value, ...data }
      }
      return true
    }
    return false
  }

  async function deleteDoctor(id: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ success: boolean }>(`/api/admin/doctors/${id}`, { method: 'DELETE' }),
    )
    if (data?.success) {
      doctors.value = doctors.value.filter((d) => d.id !== id)
      if (currentDoctor.value?.id === id) {
        currentDoctor.value = null
      }
      return true
    }
    return false
  }

  async function fetchAvailability(id: string) {
    const data = await unwrap(() =>
      $fetch<{ availability: AvailabilitySlot[]; blockedSlots: BlockedSlot[] }>(
        `/api/admin/doctors/${id}/availability`,
      ),
    )
    if (data) {
      doctorAvailability.value = data.availability ?? []
      doctorBlockedSlots.value = data.blockedSlots ?? []
    }
  }

  async function updateAvailability(id: string, availability: Array<{ dayOfWeek: number; startTime: string; endTime: string; sessionDuration: number }>): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ success: boolean; availability: AvailabilitySlot[] }>(
        `/api/admin/doctors/${id}/availability`,
        { method: 'POST', body: { availability } },
      ),
    )
    if (data?.success) {
      doctorAvailability.value = data.availability ?? []
      return true
    }
    return false
  }

  async function blockSlot(id: string, input: { date: string; startTime: string; endTime: string }): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch(`/api/admin/doctors/${id}/availability/block`, { method: 'POST', body: input }),
    )
    if (data) {
      await fetchAvailability(id)
      return true
    }
    return false
  }

  async function unblockSlot(id: string, blockId: string): Promise<boolean> {    const data = await unwrap(() =>
      $fetch<{ success: boolean }>(`/api/admin/doctors/${id}/availability/block/${blockId}`, {
        method: 'DELETE',
      }),
    )
    if (data?.success) {
      doctorBlockedSlots.value = doctorBlockedSlots.value.filter((b) => b.id !== blockId)
      return true
    }
    return false
  }

  async function fetchPayments(filters: Record<string, string> = {}) {
    const data = await unwrap(() =>
      $fetch<{ payments: AdminPayment[]; summary: PaymentsSummary }>('/api/admin/payments', {
        query: filters,
      }),
    )
    if (data) {
      payments.value = data.payments ?? []
      paymentsSummary.value = data.summary ?? { totalRevenue: 0, totalRevenueThisMonth: 0, totalRefunded: 0 }
    }
  }

  async function fetchStaff() {
    const data = await unwrap(() => $fetch<{ staff: AdminStaffMember[] }>('/api/admin/staff'))
    if (data) staff.value = data.staff ?? []
  }

  async function createStaff(input: { name: string; email: string; password?: string; phone?: string; permissions?: Array<{ resource: string; action: string }> }): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ id: string }>('/api/admin/staff', { method: 'POST', body: input }),
    )
    if (data) {
      await fetchStaff()
      return true
    }
    return false
  }

  async function updateStaff(id: string, input: Record<string, unknown>): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<AdminStaffMember>(`/api/admin/staff/${id}`, { method: 'PATCH', body: input }),
    )
    if (data) {
      staff.value = staff.value.map((s) => (s.id === id ? { ...s, ...data } : s))
      return true
    }
    return false
  }

  async function deactivateStaff(id: string): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ success: boolean }>(`/api/admin/staff/${id}`, { method: 'DELETE' }),
    )
    if (data?.success) {
      staff.value = staff.value.map((s) => (s.id === id ? { ...s, isActive: false } : s))
      return true
    }
    return false
  }

  async function fetchPatients(search = '') {
    const data = await unwrap(() =>
      $fetch<{ patients: AdminPatient[] }>('/api/admin/patients', {
        query: search ? { search } : {},
      }),
    )
    if (data) patients.value = data.patients ?? []
  }

  async function fetchPatient(id: string): Promise<AdminPatientDetail | null> {
    const data = await unwrap(() => $fetch<AdminPatientDetail>(`/api/admin/patients/${id}`))
    if (data) {
      currentPatient.value = data
      return data
    }
    return null
  }

  async function updatePatient(id: string, input: { name?: string; phone?: string | null }): Promise<boolean> {
    const data = await unwrap(() =>
      $fetch<{ patient: AdminPatient }>(`/api/admin/patients/${id}`, { method: 'PATCH', body: input }),
    )
    if (data?.patient) {
      patients.value = patients.value.map((p) => (p.id === id ? { ...p, ...data.patient } : p))
      if (currentPatient.value?.id === id) {
        currentPatient.value = { ...currentPatient.value, ...data.patient }
      }
      return true
    }
    return false
  }

  async function fetchSettings(): Promise<AdminSettings | null> {
    const data = await unwrap(() => $fetch<AdminSettings>('/api/admin/settings'))
    if (data) {
      settings.value = data
      return data
    }
    return null
  }

  async function updateSettings(input: Record<string, unknown>): Promise<AdminSettings | null> {
    const data = await unwrap(() =>
      $fetch<AdminSettings>('/api/admin/settings', { method: 'PATCH', body: input }),
    )
    if (data) {
      settings.value = data
      return data
    }
    return null
  }

  async function fetchOverview(): Promise<AdminOverview | null> {
    const data = await unwrap(() => $fetch<AdminOverview>('/api/admin/overview'))
    if (data) {
      overview.value = data
      return data
    }
    return null
  }

  async function fetchBooking(id: string): Promise<AdminBooking | null> {
    const data = await unwrap(() => $fetch<AdminBooking>(`/api/admin/bookings/${id}`))
    return data
  }

  return {
    schedules,
    activeSchedules,
    blockedDates,
    upcomingBlockedDates,
    pendingBookings,
    activeDoctors,
    bookings,
    doctors,
    currentDoctor,
    doctorAvailability,
    doctorBlockedSlots,
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
    cancelBooking,
    assignDoctor,
    fetchActiveDoctors,
    fetchDoctorDayBookings,
    fetchDoctors,
    fetchDoctor,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    fetchAvailability,
    updateAvailability,
    blockSlot,
    unblockSlot,
    payments,
    paymentsSummary,
    fetchPayments,
    staff,
    fetchStaff,
    createStaff,
    updateStaff,
    deactivateStaff,
    patients,
    currentPatient,
    fetchPatients,
    fetchPatient,
    updatePatient,
    settings,
    fetchSettings,
    updateSettings,
    overview,
    fetchOverview,
    fetchBooking,
  }
}