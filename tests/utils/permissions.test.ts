import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

vi.mock('../../server/utils/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}))

vi.mock('../../server/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

import { prisma } from '../../server/utils/prisma'
import { requireAuth } from '../../server/utils/auth'
import { requirePermission } from '../../server/utils/permissions'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedFindMany = vi.mocked(prisma.permission.findMany)

const mockEvent = () => ({ context: {} }) as never

beforeEach(() => {
  vi.resetAllMocks()
  mockedRequireAuth.mockReturnValue({
    userId: 'u1',
    email: 'staff@tawasul.com',
    accountType: 'STAFF',
  })
})

describe('requirePermission', () => {
  it('resolves when permission exists', async () => {
    mockedFindMany.mockResolvedValue([{ resource: 'APPOINTMENTS', action: 'READ' } as never])
    await expect(requirePermission(mockEvent(), 'APPOINTMENTS', 'READ')).resolves.toBeUndefined()
  })

  it('throws 403 when no permissions found', async () => {
    mockedFindMany.mockResolvedValue([])
    try {
      await requirePermission(mockEvent(), 'APPOINTMENTS', 'READ')
      expect.unreachable('should have thrown')
    } catch (error: unknown) {
      expect((error as { statusCode?: number }).statusCode).toBe(403)
    }
  })

  it('throws 403 with correct message', async () => {
    mockedFindMany.mockResolvedValue([])
    try {
      await requirePermission(mockEvent(), 'APPOINTMENTS', 'READ')
      expect.unreachable('should have thrown')
    } catch (error: unknown) {
      expect((error as { message?: string }).message).toBe(
        'You do not have permission to perform this action',
      )
    }
  })

  it('calls requireAuth with STAFF', async () => {
    mockedFindMany.mockResolvedValue([{ resource: 'APPOINTMENTS', action: 'READ' } as never])
    await requirePermission(mockEvent(), 'APPOINTMENTS', 'READ')
    expect(mockedRequireAuth).toHaveBeenCalledWith(expect.anything(), ['STAFF'])
  })

  it('queries correct resource and action', async () => {
    mockedFindMany.mockResolvedValue([{ resource: 'APPOINTMENTS', action: 'READ' } as never])
    await requirePermission(mockEvent(), 'APPOINTMENTS', 'READ')
    expect(mockedFindMany).toHaveBeenCalledWith({
      where: { userId: 'u1', resource: 'APPOINTMENTS', action: 'READ' },
    })
  })
})