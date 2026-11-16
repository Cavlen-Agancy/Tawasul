import { RoomServiceClient } from 'livekit-server-sdk'
import { prisma } from '~/server/utils/prisma'

const terminationTimers = new Map<string, ReturnType<typeof setTimeout>>()
let schedulerStarted = false
let sweepInterval: ReturnType<typeof setInterval> | null = null

/** Node timers overflow above this delay and would fire immediately. */
const MAX_TIMEOUT_MS = 2_147_483_647

function liveKitRoomService(): RoomServiceClient | null {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) return null

  const internalUrl = process.env.LIVEKIT_INTERNAL_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'http://tawasul_livekit:7880'
      : (process.env.LIVEKIT_URL || 'ws://localhost:7880').replace('ws://', 'http://').replace('wss://', 'https://'))

  return new RoomServiceClient(internalUrl, apiKey, apiSecret)
}

function isNotFoundError(error: unknown): boolean {
  const e = error as { code?: string | number; status?: number; message?: string }
  return e?.code === 'not_found'
    || e?.code === 5
    || e?.status === 404
    || /not found/i.test(e?.message ?? '')
}

function unrefTimer(timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>) {
  if (timer && typeof timer === 'object' && 'unref' in timer) {
    (timer as { unref: () => void }).unref()
  }
}

/**
 * Terminates one booking's LiveKit room. Safe to call repeatedly:
 * - an already-terminated row is a no-op;
 * - a missing LiveKit room is treated as already terminated;
 * - `bookingId` + exact `roomName` guard prevents cross-booking deletion.
 */
export async function terminateSessionRoom(bookingId: string, roomName?: string): Promise<boolean> {
  const room = await prisma.sessionRoom.findUnique({ where: { bookingId } })
  if (!room) return false
  if (roomName && room.roomName !== roomName) return false
  if (room.terminatedAt) return true

  const client = liveKitRoomService()
  if (!client) {
    console.error('[session-termination] LiveKit credentials are not configured; cannot terminate room', room.roomName)
    return false
  }

  try {
    await client.deleteRoom(room.roomName)
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.error('[session-termination] Failed to delete LiveKit room', room.roomName, error)
      return false
    }
  }

  await prisma.sessionRoom.updateMany({
    where: {
      bookingId,
      roomName: room.roomName,
      // If a reschedule moved `expiresAt` while this termination was in flight,
      // do not mark the new expiry as terminated; its own timer/sweep will run.
      expiresAt: room.expiresAt,
      terminatedAt: null,
    },
    data: { terminatedAt: new Date() },
  })
  return true
}

/**
 * Schedules one room for termination at the exact appointment end. Re-issuing
 * a token or doctor access replaces the previous timer for that room.
 */
export function scheduleSessionTermination(bookingId: string, roomName: string, closeAt: number): void {
  const existing = terminationTimers.get(roomName)
  if (existing) {
    clearTimeout(existing)
    terminationTimers.delete(roomName)
  }

  const arm = (delay: number) => {
    const timer = setTimeout(() => {
      terminationTimers.delete(roomName)
      // Re-check the wall clock so long waits (or clock changes) do not fire
      // early; timers longer than Node's maximum are chained.
      const remaining = closeAt - Date.now()
      if (remaining > 0) {
        arm(remaining)
        return
      }
      void terminateSessionRoom(bookingId, roomName).catch((error) => {
        console.error('[session-termination] Scheduled termination failed:', error)
      })
    }, Math.min(delay, MAX_TIMEOUT_MS))
    unrefTimer(timer)
    terminationTimers.set(roomName, timer)
  }

  const delay = closeAt - Date.now()
  if (delay <= 0) {
    void terminateSessionRoom(bookingId, roomName).catch((error) => {
      console.error('[session-termination] Immediate termination failed:', error)
    })
    return
  }

  arm(delay)
}

/**
 * Startup/recovery sweep. Finds rooms whose appointment end has passed but
 * whose termination was never recorded (app restart, missed timer, transient
 * LiveKit failure) and terminates them. Each room is scoped by bookingId and
 * roomName, so one booking can never terminate another.
 */
export async function sweepExpiredSessionRooms(now = new Date()): Promise<number> {
  const expired = await prisma.sessionRoom.findMany({
    where: { expiresAt: { lte: now }, terminatedAt: null },
    select: { bookingId: true, roomName: true },
  })

  let terminated = 0
  for (const room of expired) {
    try {
      if (await terminateSessionRoom(room.bookingId, room.roomName)) {
        terminated += 1
      }
    } catch (error) {
      console.error('[session-termination] Sweep failed for room', room.roomName, error)
    }
  }
  return terminated
}

/**
 * Re-arms exact timers for rooms that are still active after an application
 * restart. `expiresAt` is durable in SessionRoom, so this catches the in-process
 * timer loss without a separate job queue.
 */
export async function scheduleActiveSessionRooms(now = new Date()): Promise<number> {
  const active = await prisma.sessionRoom.findMany({
    where: { expiresAt: { gt: now }, terminatedAt: null },
    select: { bookingId: true, roomName: true, expiresAt: true },
  })

  for (const room of active) {
    scheduleSessionTermination(room.bookingId, room.roomName, room.expiresAt.getTime())
  }
  return active.length
}

/**
 * Starts the single-instance sweeper. A token request also schedules an exact
 * timer; startup re-arms active rooms and sweeps expired missed executions.
 */
export function startSessionTerminationScheduler(): void {
  if (schedulerStarted) return
  schedulerStarted = true

  void (async () => {
    try {
      await sweepExpiredSessionRooms()
      await scheduleActiveSessionRooms()
    } catch (error) {
      console.error('[session-termination] Startup recovery failed:', error)
    }
  })()

  sweepInterval = setInterval(() => {
    void sweepExpiredSessionRooms().catch((error) => {
      console.error('[session-termination] Periodic sweep failed:', error)
    })
  }, 30 * 1000)
  unrefTimer(sweepInterval)
}

export function stopSessionTerminationSchedulerForTests(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval)
    sweepInterval = null
  }
  for (const timer of terminationTimers.values()) clearTimeout(timer)
  terminationTimers.clear()
  schedulerStarted = false
}
