export interface AdminSchedule {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  sessionDuration: number
  isActive: boolean
}

export interface BlockedDate {
  id: string
  date: string
  reason: string | null
}

export interface PendingBooking {
  id: string
  patientName: string
  patientEmail: string
  patientPhone: string
  date: string
  startTime: string
  endTime: string
  status: string
  createdAt: string
}

export interface AdminDoctor {
  id: string
  name: string
  email?: string
  phone?: string
  photo?: string
  specializations?: string[]
  isActive: boolean
  slug?: string
  sessionCountThisMonth?: number
  sessionCountAllTime?: number
}

export interface AdminDoctorDetail extends AdminDoctor {
  userId: string
  bio: string | null
  availability: AvailabilitySlot[]
  blockedSlots: BlockedSlot[]
}

export interface AvailabilitySlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  sessionDuration: number
}

export interface BlockedSlot {
  id: string
  date: string
  startTime: string
  endTime: string
}

export interface AdminBooking {
  id: string
  patientName: string
  patientEmail: string
  patientPhone: string
  doctorId: string | null
  doctorName: string | null
  date: string
  startTime: string
  endTime: string
  service: string
  status: string
  createdAt: string
}

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface AdminPayment {
  id: string
  amount: number
  currency: string
  status: string
  createdAt: string
  gatewayReference: string | null
  patientName: string
  doctorName: string | null
  service: string
  bookingDate: string
}

export interface PaymentsSummary {
  totalRevenue: number
  totalRevenueThisMonth: number
  totalRefunded: number
}

export interface AdminStaffMember {
  id: string
  name: string
  email: string
  phone: string | null
  photo: string | null
  isActive: boolean
  permissions: Array<{ resource: string; action: string }>
}

export interface AdminPatient {
  id: string
  name: string
  email: string
  phone: string | null
  photo: string | null
  totalSessions: number
  lastSessionDate: string | null
  createdAt: string
}

export interface AdminPatientDetail {  id: string
  name: string
  email: string
  phone: string | null
  photo: string | null
  createdAt: string
  bookings: Array<{
    id: string
    doctorName: string | null
    date: string
    startTime: string
    endTime: string
    service: string
    status: string
  }>
  payments: Array<{
    id: string
    amount: number
    currency: string
    status: string
    createdAt: string
    gatewayReference: string | null
  }>
}

export interface AdminSettings {
  id: string
  platformName: string
  contactEmail: string
  contactPhone: string
  whatsappNumber: string
  paymentGateway: string
  paymentGatewayKey: string
  paymentGatewaySecret: string
  sessionPricePerHour: number
  defaultSessionDuration: number
  defaultWorkingStart: string
  defaultWorkingEnd: string
  jitsiDomain: string
}

export interface AdminOverview {
  totalBookingsThisMonth: number
  totalBookingsAllTime: number
  totalRevenueThisMonth: number
  totalRevenueAllTime: number
  totalActivePatients: number
  totalActiveDoctors: number
  recentBookings: Array<{
    id: string
    patientName: string
    doctorName: string | null
    date: string
    service: string
    status: string
  }>
}