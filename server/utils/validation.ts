import { z } from 'zod'

export const authRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(1, 'Password is required').max(128),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

export const availableDatesQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1000).max(9999),
})

export const availableSlotsQuerySchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format'),
})

export const createBookingSchema = z.object({
  date: z.string().regex(dateRegex, 'Invalid date format'),
  startTime: z.string().regex(timeRegex, 'Invalid time format'),
  doctorId: z.string().min(1, 'Doctor is required'),
})

export const initiatePaymentSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
})

export const patientProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().max(30).optional().or(z.literal('')),
})

export const patientAppointmentsQuerySchema = z.object({
  tab: z.enum(['upcoming', 'past', 'all']).optional().default('upcoming'),
})

/**
 * Extracts a single human-readable message from a ZodError.
 * Falls back to the first issue message, then a generic message.
 */
export function validationMessage(error: z.ZodError): string {
  for (const issue of error.issues) {
    if (issue.code === 'too_small' && issue.path[0] === 'name') return 'Name must be at least 2 characters'
    if (issue.code === 'invalid_string' && issue.path[0] === 'email') return 'Invalid email format'
    if (issue.message.startsWith('Password')) return issue.message
    return issue.message
  }
  return 'Invalid request'
}

export function parseBody<T>(body: unknown, schema: z.ZodSchema<T>): T | null {
  const result = schema.safeParse(body)
  if (!result.success) return null
  return result.data
}