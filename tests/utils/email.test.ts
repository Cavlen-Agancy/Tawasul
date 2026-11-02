import { describe, expect, it, vi } from 'vitest'

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn() },
  })),
}))

import {
  passwordResetTemplate,
  bookingConfirmationTemplate,
  bookingCancellationTemplate,
  doctorWelcomeTemplate,
  sessionReminderTemplate,
} from '../../server/utils/email'

describe('passwordResetTemplate', () => {
  it('returns a string', () => {
    expect(typeof passwordResetTemplate('Sara', 'https://example.com/reset?token=xyz')).toBe('string')
  })

  it('contains the recipient name', () => {
    expect(passwordResetTemplate('Sara', 'https://example.com/reset?token=xyz')).toContain('Sara')
  })

  it('contains the reset URL', () => {
    expect(passwordResetTemplate('Sara', 'https://example.com/reset?token=xyz')).toContain(
      'https://example.com/reset?token=xyz',
    )
  })

  it('contains 1 hour expiry mention', () => {
    const html = passwordResetTemplate('Sara', 'https://example.com/reset?token=xyz')
    expect(html).toContain('1')
    expect(html).toMatch(/hour|ساعة/)
  })
})

describe('bookingConfirmationTemplate', () => {
  it('returns a string', () => {
    expect(
      typeof bookingConfirmationTemplate('Ahmed', 'Dr. Sara', '2024-03-04', '10:00 AM', 'Marital Counseling'),
    ).toBe('string')
  })

  it('contains patient name', () => {
    expect(bookingConfirmationTemplate('Ahmed', 'Dr. Sara', '2024-03-04', '10:00 AM', 'Marital Counseling')).toContain(
      'Ahmed',
    )
  })

  it('contains doctor name', () => {
    expect(bookingConfirmationTemplate('Ahmed', 'Dr. Sara', '2024-03-04', '10:00 AM', 'Marital Counseling')).toContain(
      'Dr. Sara',
    )
  })

  it('contains date', () => {
    expect(bookingConfirmationTemplate('Ahmed', 'Dr. Sara', '2024-03-04', '10:00 AM', 'Marital Counseling')).toContain(
      '2024-03-04',
    )
  })

  it('contains time', () => {
    expect(bookingConfirmationTemplate('Ahmed', 'Dr. Sara', '2024-03-04', '10:00 AM', 'Marital Counseling')).toContain(
      '10:00 AM',
    )
  })

  it('contains service', () => {
    expect(bookingConfirmationTemplate('Ahmed', 'Dr. Sara', '2024-03-04', '10:00 AM', 'Marital Counseling')).toContain(
      'Marital Counseling',
    )
  })
})

describe('bookingCancellationTemplate', () => {
  it('returns a string', () => {
    expect(typeof bookingCancellationTemplate('Ahmed', 'Dr. Sara', '2024-03-04', '10:00 AM')).toBe('string')
  })

  it('contains patient and doctor names and date/time', () => {
    const html = bookingCancellationTemplate('Ahmed', 'Dr. Sara', '2024-03-04', '10:00 AM')
    expect(html).toContain('Ahmed')
    expect(html).toContain('Dr. Sara')
    expect(html).toContain('2024-03-04')
    expect(html).toContain('10:00 AM')
  })
})

describe('doctorWelcomeTemplate', () => {
  it('returns a string', () => {
    expect(typeof doctorWelcomeTemplate('Dr. Amr', 'amr@email.com', 'TempPass123!', 'http://localhost:3000')).toBe('string')
  })

  it('contains doctor name', () => {
    expect(doctorWelcomeTemplate('Dr. Amr', 'amr@email.com', 'TempPass123!', 'http://localhost:3000')).toContain('Dr. Amr')
  })

  it('contains email', () => {
    expect(doctorWelcomeTemplate('Dr. Amr', 'amr@email.com', 'TempPass123!', 'http://localhost:3000')).toContain('amr@email.com')
  })

  it('contains temporary password', () => {
    expect(doctorWelcomeTemplate('Dr. Amr', 'amr@email.com', 'TempPass123!', 'http://localhost:3000')).toContain(
      'TempPass123!',
    )
  })

  it('contains the login URL', () => {
    expect(doctorWelcomeTemplate('Dr. Amr', 'amr@email.com', 'TempPass123!', 'http://localhost:3000')).toContain(
      'http://localhost:3000/login',
    )
  })

  it('contains instruction to change password', () => {
    const html = doctorWelcomeTemplate('Dr. Amr', 'amr@email.com', 'TempPass123!', 'http://localhost:3000')
    expect(html.toLowerCase()).toMatch(/change|password/)
  })
})

describe('sessionReminderTemplate', () => {
  it('returns a string and includes details', () => {
    const html = sessionReminderTemplate('Ahmed', 'Dr. Sara', '2024-03-05', '11:00 AM')
    expect(typeof html).toBe('string')
    expect(html).toContain('Ahmed')
    expect(html).toContain('Dr. Sara')
    expect(html).toContain('2024-03-05')
    expect(html).toContain('11:00 AM')
  })
})