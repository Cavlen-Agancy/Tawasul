import { describe, expect, it, afterAll } from 'vitest'
import postHandler from '~/modules/admin/server/api/admin/staff/index.post'
import patchHandler from '~/modules/admin/server/api/admin/staff/[id].patch'
import deleteHandler from '~/modules/admin/server/api/admin/staff/[id].delete'
import { createApiEvent, expectApiError, createTestUser, deleteTestUser } from '../helpers'

const toDeleteUsers: string[] = []

function staffContext(userId: string) {
  return { user: { userId, email: 'staff@test.com', accountType: 'STAFF' } }
}

async function staffWithAll(): Promise<string> {
  const staff = await createTestUser({
    emailVerified: true,
    accountType: 'STAFF',
    email: `ast-staff-${Date.now()}-${Math.random()}@test.com`,
    permissions: [
      { resource: 'STAFF', action: 'CREATE' },
      { resource: 'STAFF', action: 'READ' },
      { resource: 'STAFF', action: 'UPDATE' },
      { resource: 'STAFF', action: 'DELETE' },
    ],
  })
  toDeleteUsers.push(staff.id)
  return staff.id
}

afterAll(async () => {
  await Promise.all(toDeleteUsers.map((id) => deleteTestUser(id)))
})

describe('POST /api/admin/staff', () => {
  it('creates staff with permissions and returns 201', async () => {
    const staffId = await staffWithAll()
    const email = `ast-new-${Date.now()}@test.com`
    const res = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/staff',
      body: {
        name: 'New Staff',
        email,
        permissions: [{ resource: 'APPOINTMENTS', action: 'READ' }],
      },
      context: staffContext(staffId),
    })) as { id: string; email: string; permissions: Array<{ resource: string }> }
    expect(res.email).toBe(email)
    expect(res.permissions).toHaveLength(1)
    expect(res).not.toHaveProperty('password')
    toDeleteUsers.push(res.id)
  })

  it('returns 400 for a duplicate email', async () => {
    const staffId = await staffWithAll()
    const email = `ast-dup-${Date.now()}@test.com`
    const first = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/staff',
      body: { name: 'Dup One', email },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteUsers.push(first.id)
    try {
      await postHandler(createApiEvent({
        method: 'POST',
        url: '/api/admin/staff',
        body: { name: 'Dup Two', email },
        context: staffContext(staffId),
      }))
      expect.unreachable('should have thrown')
    } catch (e) {
      expectApiError(e, 400, 'Email already in use')
    }
  })
})

describe('PATCH /api/admin/staff/:id', () => {
  it('replaces permissions', async () => {
    const staffId = await staffWithAll()
    const created = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/staff',
      body: { name: 'Perm Staff', email: `ast-perm-${Date.now()}@test.com` },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteUsers.push(created.id)

    const res = await patchHandler(createApiEvent({
      method: 'PATCH',
      url: `/api/admin/staff/${created.id}`,
      body: { permissions: [{ resource: 'PAYMENTS', action: 'READ' }, { resource: 'DOCTORS', action: 'READ' }] },
      context: { params: { id: created.id }, ...staffContext(staffId) },
    })) as { permissions: Array<{ resource: string }> }
    expect(res.permissions).toHaveLength(2)
  })
})

describe('DELETE /api/admin/staff/:id', () => {
  it('soft-deactivates staff', async () => {
    const staffId = await staffWithAll()
    const created = await postHandler(createApiEvent({
      method: 'POST',
      url: '/api/admin/staff',
      body: { name: 'Gone Staff', email: `ast-gone-${Date.now()}@test.com` },
      context: staffContext(staffId),
    })) as { id: string }
    toDeleteUsers.push(created.id)

    const res = await deleteHandler(createApiEvent({
      method: 'DELETE',
      url: `/api/admin/staff/${created.id}`,
      context: { params: { id: created.id }, ...staffContext(staffId) },
    })) as { success: boolean }
    expect(res.success).toBe(true)
  })

  it('returns 403 for the seed admin', async () => {
    const previous = process.env.SEED_ADMIN_EMAIL
    const seedEmail = `ast-seed-${Date.now()}@test.com`
    process.env.SEED_ADMIN_EMAIL = seedEmail
    try {
      const staffId = await staffWithAll()
      const created = await postHandler(createApiEvent({
        method: 'POST',
        url: '/api/admin/staff',
        body: { name: 'Seed Staff', email: seedEmail },
        context: staffContext(staffId),
      })) as { id: string }
      toDeleteUsers.push(created.id)

      try {
        await deleteHandler(createApiEvent({
          method: 'DELETE',
          url: `/api/admin/staff/${created.id}`,
          context: { params: { id: created.id }, ...staffContext(staffId) },
        }))
        expect.unreachable('should have thrown')
      } catch (e) {
        expectApiError(e, 403, 'Cannot deactivate seed admin')
      }
    } finally {
      if (previous === undefined) delete process.env.SEED_ADMIN_EMAIL
      else process.env.SEED_ADMIN_EMAIL = previous
    }
  })
})
