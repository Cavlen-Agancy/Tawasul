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