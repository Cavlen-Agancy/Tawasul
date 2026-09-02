export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'

export interface PatientProfile {
  id: string
  name: string
  email: string
  phone?: string
  photo?: string
}

export interface Appointment {
  id: string
  doctorName: string
  doctorPhoto?: string
  date: string // YYYY-MM-DD
  startTime: string // "10:00"
  endTime: string // "11:00"
  service: string
  status: BookingStatus
  sessionRoom?: {
    roomName: string
  }
}

export interface AppointmentResponse {
  appointments: Appointment[]
}

export interface PaymentRecord {
  id: string
  amount: number
  currency: string
  status: PaymentStatus
  createdAt: string // ISO
  booking: {
    doctorName: string
    date: string
    service: string
  }
}

export interface PaymentsResponse {
  payments: PaymentRecord[]
}

export interface SessionRoomResponse {
  roomName: string
  jitsiDomain: string
}
