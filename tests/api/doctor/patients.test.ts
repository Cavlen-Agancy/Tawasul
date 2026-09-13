import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import patientsHandler from '~/server/api/doctor/patients.get'
import patientDetailHandler from '~/server/api/doctor/patients/[userId]/index.get'
import patientNotesHandler from '~/server/api/doctor/patients/[userId]/notes.get'
import sessionNotesHandler from '~/server/api/doctor/patients/[userId]/sessions/[bookingId]/notes.get'
import createNoteHandler from '~/server/api/doctor/patients/[userId]/sessions/[bookingId]/notes.post'
import patchNoteHandler from '~/server/api/doctor/patients/[userId]/sessions/[bookingId]/notes/[noteId].patch'
import deleteNoteHandler from '~/server/api/doctor/patients/[userId]/sessions/[bookingId]/notes/[noteId].delete'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'
import { deleteTestBooking } from '../booking/helpers'
import { createTestAdminDoctor, deleteTestAdminDoctor } from '../admin/helpers'

const toDeleteUsers: string[] = []
const toDeleteBookings: string[] = []
const toDeleteDoctors: Array<{ user: { id: string }; doctor: { id: string } }> = []

function doctorContext(userId: string) {
  return { user: { userId, email: 'doctor@test.com', accountType: 'DOCTOR' } }
}

function params(params: Record<string, string>, userId: string) {
  return { ...doctorContext(userId), params } as never
}

afterAll(async () => {
  await prisma.doctorNote.deleteMany({}).catch(() => undefined)
  await Promise.all(toDeleteBookings.map((id) => deleteTestBooking(id)))
  await Promise.all(toDeleteDoctors.map((d) => deleteTestAdminDoctor(d.doctor.id, d.user.id)))
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

async function makeBooking(patientId: string, doctorId: string, status: 'CONFIRMED' | 'PENDING' | 'CANCELLED', date = '2030-08-10T12:00:00Z') {
  const booking = await prisma.booking.create({
    data: {
      userId: patientId,
      doctorId,
      date: new Date(date),
      startTime: '10:00',
      endTime: '11:00',
      service: 'Online Consultation',
      status,
    },
  })
  toDeleteBookings.push(booking.id)
  return booking
}

describe('GET /api/doctor/patients', () => {
  it('returns 401 without auth', async () => {
    try {
      await patientsHandler(createApiEvent({ method: 'GET', url: '/api/doctor/patients', context: {} }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 401, 'Unauthorized')
    }
  })

  it('returns 403 for a PATIENT role', async () => {
    const patient = await createTestUser({ emailVerified: true, email: `pt-role-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    try {
      await patientsHandler(createApiEvent({
        method: 'GET',
        url: '/api/doctor/patients',
        context: { user: { userId: patient.id, email: patient.email, accountType: 'PATIENT' } },
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })

  it('lists only patients with a CONFIRMED booking, grouped with counts', async () => {
    const mine = await createTestAdminDoctor()
    toDeleteDoctors.push(mine)
    const confirmed = await createTestUser({ emailVerified: true, email: `pt-conf-${Date.now()}@test.com` })
    const pendingOnly = await createTestUser({ emailVerified: true, email: `pt-pend-${Date.now()}@test.com` })
    toDeleteUsers.push(confirmed.id, pendingOnly.id)
    await makeBooking(confirmed.id, mine.doctor.id, 'CONFIRMED', '2030-08-10T12:00:00Z')
    await makeBooking(confirmed.id, mine.doctor.id, 'CONFIRMED', '2030-08-12T12:00:00Z')
    await makeBooking(pendingOnly.id, mine.doctor.id, 'PENDING')

    const res = await patientsHandler(createApiEvent({
      method: 'GET',
      url: '/api/doctor/patients',
      context: doctorContext(mine.user.id),
    })) as { patients: Array<{ userId: string; totalSessions: number; lastSession: string }> }

    const mine2 = res.patients.find((p) => p.userId === confirmed.id)
    expect(mine2?.totalSessions).toBe(2)
    expect(mine2?.lastSession).toBe('2030-08-12')
    expect(res.patients.some((p) => p.userId === pendingOnly.id)).toBe(false)
  })
})

describe('GET /api/doctor/patients/:userId', () => {
  it('returns 403 when no CONFIRMED booking links doctor and patient', async () => {
    const mine = await createTestAdminDoctor()
    toDeleteDoctors.push(mine)
    const stranger = await createTestUser({ emailVerified: true, email: `pt-str-${Date.now()}@test.com` })
    toDeleteUsers.push(stranger.id)
    try {
      await patientDetailHandler(createApiEvent({
        method: 'GET',
        url: `/api/doctor/patients/${stranger.id}`,
        context: params({ userId: stranger.id }, mine.user.id),
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })

  it('returns sessions DESC with only the own note attached', async () => {
    const mine = await createTestAdminDoctor()
    const peer = await createTestAdminDoctor()
    toDeleteDoctors.push(mine, peer)
    const patient = await createTestUser({ emailVerified: true, email: `pt-det-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const b1 = await makeBooking(patient.id, mine.doctor.id, 'CONFIRMED', '2030-08-10T12:00:00Z')
    const b2 = await makeBooking(patient.id, mine.doctor.id, 'CONFIRMED', '2030-08-15T12:00:00Z')
    const peerBooking = await makeBooking(patient.id, peer.doctor.id, 'CONFIRMED', '2030-08-11T12:00:00Z')
    await prisma.doctorNote.create({ data: { bookingId: b1.id, doctorId: mine.doctor.id, content: 'Own note' } })
    await prisma.doctorNote.create({ data: { bookingId: peerBooking.id, doctorId: peer.doctor.id, content: 'Peer note' } })

    const res = await patientDetailHandler(createApiEvent({
      method: 'GET',
      url: `/api/doctor/patients/${patient.id}`,
      context: params({ userId: patient.id }, mine.user.id),
    }) as never) as {
      user: { id: string }
      sessions: Array<{ bookingId: string; date: string; note: { content: string } | null }>
    }
    expect(res.user.id).toBe(patient.id)
    expect(res.sessions.map((s) => s.date)).toEqual(['2030-08-15', '2030-08-10'])
    expect(res.sessions.find((s) => s.bookingId === b1.id)?.note?.content).toBe('Own note')
    expect(res.sessions.find((s) => s.bookingId === b2.id)?.note).toBeNull()
    // peer session is not mine: not listed at all
    expect(res.sessions.some((s) => s.bookingId === peerBooking.id)).toBe(false)
  })
})

describe('GET /api/doctor/patients/:userId/notes', () => {
  it('returns own + peer notes with isOwn flags, 403 without access', async () => {
    const mine = await createTestAdminDoctor()
    const peer = await createTestAdminDoctor()
    const outsider = await createTestAdminDoctor()
    toDeleteDoctors.push(mine, peer, outsider)
    const patient = await createTestUser({ emailVerified: true, email: `pt-notes-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const b1 = await makeBooking(patient.id, mine.doctor.id, 'CONFIRMED')
    const peerBooking = await makeBooking(patient.id, peer.doctor.id, 'CONFIRMED', '2030-08-11T12:00:00Z')
    await prisma.doctorNote.create({ data: { bookingId: b1.id, doctorId: mine.doctor.id, content: 'Mine' } })
    await prisma.doctorNote.create({ data: { bookingId: peerBooking.id, doctorId: peer.doctor.id, content: 'Theirs' } })

    const res = await patientNotesHandler(createApiEvent({
      method: 'GET',
      url: `/api/doctor/patients/${patient.id}/notes`,
      context: params({ userId: patient.id }, mine.user.id),
    }) as never) as { notes: Array<{ content: string; isOwn: boolean; doctorName: string }> }
    expect(res.notes.find((n) => n.content === 'Mine')?.isOwn).toBe(true)
    const theirs = res.notes.find((n) => n.content === 'Theirs')
    expect(theirs?.isOwn).toBe(false)
    expect(theirs?.doctorName).toBeTruthy()

    try {
      await patientNotesHandler(createApiEvent({
        method: 'GET',
        url: `/api/doctor/patients/${patient.id}/notes`,
        context: params({ userId: patient.id }, outsider.user.id),
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })
})

describe('session notes CRUD', () => {
  it('POST validates, upserts, and blocks other-doctor sessions', async () => {
    const mine = await createTestAdminDoctor()
    const other = await createTestAdminDoctor()
    toDeleteDoctors.push(mine, other)
    const patient = await createTestUser({ emailVerified: true, email: `pt-crud-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const mine1 = await makeBooking(patient.id, mine.doctor.id, 'CONFIRMED')
    const others = await makeBooking(patient.id, other.doctor.id, 'CONFIRMED', '2030-08-11T12:00:00Z')
    const url = (b: string) => `/api/doctor/patients/${patient.id}/sessions/${b}/notes`

    // 400 on empty
    try {
      await createNoteHandler(createApiEvent({
        method: 'POST', url: url(mine1.id), body: { content: '   ' },
        context: params({ userId: patient.id, bookingId: mine1.id }, mine.user.id),
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Note content is required')
    }

    // 400 on too long
    try {
      await createNoteHandler(createApiEvent({
        method: 'POST', url: url(mine1.id), body: { content: 'x'.repeat(2001) },
        context: params({ userId: patient.id, bookingId: mine1.id }, mine.user.id),
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Note content must be 2000 characters or less')
    }

    // 403 on another doctor's session
    try {
      await createNoteHandler(createApiEvent({
        method: 'POST', url: url(others.id), body: { content: 'Sneaky' },
        context: params({ userId: patient.id, bookingId: others.id }, mine.user.id),
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }

    // create then upsert-update (still one row)
    const created = await createNoteHandler(createApiEvent({
      method: 'POST', url: url(mine1.id), body: { content: 'First' },
      context: params({ userId: patient.id, bookingId: mine1.id }, mine.user.id),
    }) as never) as { note: { id: string; content: string } }
    expect(created.note.content).toBe('First')
    const updated = await createNoteHandler(createApiEvent({
      method: 'POST', url: url(mine1.id), body: { content: 'Second' },
      context: params({ userId: patient.id, bookingId: mine1.id }, mine.user.id),
    }) as never) as { note: { id: string; content: string } }
    expect(updated.note.id).toBe(created.note.id)
    expect(updated.note.content).toBe('Second')
    expect(await prisma.doctorNote.count({ where: { bookingId: mine1.id } })).toBe(1)
  })

  it('GET session notes enforces userId binding and flags ownership', async () => {
    const mine = await createTestAdminDoctor()
    const peer = await createTestAdminDoctor()
    toDeleteDoctors.push(mine, peer)
    const patient = await createTestUser({ emailVerified: true, email: `pt-sg-${Date.now()}@test.com` })
    const stranger = await createTestUser({ emailVerified: true, email: `pt-sg2-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id, stranger.id)
    const b1 = await makeBooking(patient.id, mine.doctor.id, 'CONFIRMED')
    const peerBooking = await makeBooking(patient.id, peer.doctor.id, 'CONFIRMED', '2030-08-11T12:00:00Z')
    await prisma.doctorNote.create({ data: { bookingId: b1.id, doctorId: mine.doctor.id, content: 'Mine here' } })
    await prisma.doctorNote.create({ data: { bookingId: peerBooking.id, doctorId: peer.doctor.id, content: 'Peer here' } })
    // peer note on MY session too (peer saw this patient? peer has own CONFIRMED booking so visibility holds)
    const peerNoteOnMine = await prisma.doctorNote.create({ data: { bookingId: b1.id, doctorId: peer.doctor.id, content: 'Peer on mine' } })
    void peerNoteOnMine

    const res = await sessionNotesHandler(createApiEvent({
      method: 'GET',
      url: `/api/doctor/patients/${patient.id}/sessions/${b1.id}/notes`,
      context: params({ userId: patient.id, bookingId: b1.id }, mine.user.id),
    }) as never) as { notes: Array<{ content: string; isOwn: boolean }> }
    expect(res.notes.find((n) => n.content === 'Mine here')?.isOwn).toBe(true)
    expect(res.notes.find((n) => n.content === 'Peer on mine')?.isOwn).toBe(false)

    // userId mismatch -> 403, not 404
    try {
      await sessionNotesHandler(createApiEvent({
        method: 'GET',
        url: `/api/doctor/patients/${stranger.id}/sessions/${b1.id}/notes`,
        context: params({ userId: stranger.id, bookingId: b1.id }, mine.user.id),
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }
  })

  it('PATCH/DELETE enforce ownership', async () => {
    const mine = await createTestAdminDoctor()
    const peer = await createTestAdminDoctor()
    toDeleteDoctors.push(mine, peer)
    const patient = await createTestUser({ emailVerified: true, email: `pt-own-${Date.now()}@test.com` })
    toDeleteUsers.push(patient.id)
    const b1 = await makeBooking(patient.id, mine.doctor.id, 'CONFIRMED')
    const peerBooking = await makeBooking(patient.id, peer.doctor.id, 'CONFIRMED', '2030-08-11T12:00:00Z')
    const mine1 = await prisma.doctorNote.create({ data: { bookingId: b1.id, doctorId: mine.doctor.id, content: 'V1' } })
    const theirs = await prisma.doctorNote.create({ data: { bookingId: peerBooking.id, doctorId: peer.doctor.id, content: 'Theirs' } })
    const patchUrl = (b: string, n: string) => `/api/doctor/patients/${patient.id}/sessions/${b}/notes/${n}`

    // peer PATCH -> 403
    try {
      await patchNoteHandler(createApiEvent({
        method: 'PATCH', url: patchUrl(peerBooking.id, theirs.id), body: { content: 'Hacked' },
        context: params({ userId: patient.id, bookingId: peerBooking.id, noteId: theirs.id }, mine.user.id),
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }

    // own PATCH works
    const patched = await patchNoteHandler(createApiEvent({
      method: 'PATCH', url: patchUrl(b1.id, mine1.id), body: { content: 'V2' },
      context: params({ userId: patient.id, bookingId: b1.id, noteId: mine1.id }, mine.user.id),
    }) as never) as { note: { content: string } }
    expect(patched.note.content).toBe('V2')

    // peer DELETE -> 403
    try {
      await deleteNoteHandler(createApiEvent({
        method: 'DELETE', url: patchUrl(peerBooking.id, theirs.id),
        context: params({ userId: patient.id, bookingId: peerBooking.id, noteId: theirs.id }, mine.user.id),
      }) as never)
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 403, 'Forbidden')
    }

    // own DELETE works
    const deleted = await deleteNoteHandler(createApiEvent({
      method: 'DELETE', url: patchUrl(b1.id, mine1.id),
      context: params({ userId: patient.id, bookingId: b1.id, noteId: mine1.id }, mine.user.id),
    }) as never) as { deleted: boolean }
    expect(deleted.deleted).toBe(true)
    expect(await prisma.doctorNote.findUnique({ where: { id: mine1.id } })).toBeNull()
  })
})
