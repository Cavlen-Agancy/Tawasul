import { describe, expect, it, vi } from 'vitest'
import { getArabicMediaErrorMessage } from '~/composables/useLiveKitSession'

describe('getArabicMediaErrorMessage', () => {
  it('returns appropriate Arabic messages for permission denied errors', () => {
    const permErr = new Error('Permission denied by system')
    permErr.name = 'NotAllowedError'
    expect(getArabicMediaErrorMessage(permErr, 'microphone')).toBe(
      'لم نتمكن من تشغيل الميكروفون. تأكد من السماح للمتصفح باستخدام الميكروفون من إعدادات الموقع.',
    )
    expect(getArabicMediaErrorMessage(permErr, 'camera')).toBe(
      'لم نتمكن من تشغيل الكاميرا. تأكد من السماح للمتصفح باستخدام الكاميرا من إعدادات الموقع.',
    )
  })

  it('returns appropriate Arabic messages for hardware in-use / busy errors', () => {
    const busyErr = new Error('Device in use')
    busyErr.name = 'NotReadableError'
    expect(getArabicMediaErrorMessage(busyErr, 'camera')).toBe(
      'تعذر تشغيل الكاميرا. تأكد من أن الكاميرا ليست مستخدمة بواسطة تطبيق آخر.',
    )
    expect(getArabicMediaErrorMessage(busyErr, 'microphone')).toBe(
      'تعذر تشغيل الميكروفون. تأكد من أن الميكروفون ليس مستخدمًا بواسطة تطبيق آخر.',
    )
  })

  it('returns appropriate Arabic messages for device not found errors', () => {
    const notFoundErr = new Error('Requested device not found')
    notFoundErr.name = 'NotFoundError'
    expect(getArabicMediaErrorMessage(notFoundErr, 'camera')).toBe(
      'لم يتم العثور على كاميرا متصلة بجهازك.',
    )
    expect(getArabicMediaErrorMessage(notFoundErr, 'microphone')).toBe(
      'لم يتم العثور على ميكروفون متصل بجهازك.',
    )
  })

  it('returns fallback Arabic messages for unknown errors', () => {
    const unknownErr = new Error('Random failure')
    expect(getArabicMediaErrorMessage(unknownErr, 'camera')).toBe(
      'تعذر تفعيل الكاميرا. يرجى إعادة المحاولة.',
    )
    expect(getArabicMediaErrorMessage(unknownErr, 'microphone')).toBe(
      'تعذر تفعيل الميكروفون. يرجى إعادة المحاولة.',
    )
  })
})

describe('Media Toggle Lifecycle simulation', () => {
  it('simulates infinite ON -> OFF -> ON -> OFF -> ON cycles on LiveKit participant without unpublishing', async () => {
    // Mock a LiveKit LocalParticipant conforming to expected behavior
    let isMicMuted = false
    let isCamMuted = false
    let unpublishCount = 0
    let muteCalls = 0
    let unmuteCalls = 0

    const mockLocalParticipant = {
      get isMicrophoneEnabled() {
        return !isMicMuted
      },
      get isCameraEnabled() {
        return !isCamMuted
      },
      setMicrophoneEnabled: vi.fn(async (enabled: boolean) => {
        isMicMuted = !enabled
        if (!enabled) muteCalls++
        else unmuteCalls++
        return {} as any
      }),
      setCameraEnabled: vi.fn(async (enabled: boolean) => {
        isCamMuted = !enabled
        if (!enabled) muteCalls++
        else unmuteCalls++
        return {} as any
      }),
      unpublishTrack: vi.fn(async () => {
        unpublishCount++
      }),
    }

    // Initial state: ON
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(true)
    expect(mockLocalParticipant.isCameraEnabled).toBe(true)

    // Toggle Mic OFF
    await mockLocalParticipant.setMicrophoneEnabled(false)
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(false)

    // Toggle Mic ON
    await mockLocalParticipant.setMicrophoneEnabled(true)
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(true)

    // Toggle Mic OFF
    await mockLocalParticipant.setMicrophoneEnabled(false)
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(false)

    // Toggle Mic ON
    await mockLocalParticipant.setMicrophoneEnabled(true)
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(true)

    // Toggle Cam OFF
    await mockLocalParticipant.setCameraEnabled(false)
    expect(mockLocalParticipant.isCameraEnabled).toBe(false)

    // Toggle Cam ON
    await mockLocalParticipant.setCameraEnabled(true)
    expect(mockLocalParticipant.isCameraEnabled).toBe(true)

    // Toggle Cam OFF
    await mockLocalParticipant.setCameraEnabled(false)
    expect(mockLocalParticipant.isCameraEnabled).toBe(false)

    // Toggle Cam ON
    await mockLocalParticipant.setCameraEnabled(true)
    expect(mockLocalParticipant.isCameraEnabled).toBe(true)

    // Crucial check: unpublishTrack must NEVER have been called during toggles!
    expect(unpublishCount).toBe(0)
    expect(mockLocalParticipant.unpublishTrack).not.toHaveBeenCalled()
  })

  it('protects against race condition / double click when toggle is in-flight', async () => {
    let callCount = 0
    let resolvePromise: () => void = () => {}

    const delayedOperation = () =>
      new Promise<void>((resolve) => {
        resolvePromise = resolve
      })

    let isToggling = false

    async function safeToggle() {
      if (isToggling) return
      isToggling = true
      try {
        callCount++
        await delayedOperation()
      } finally {
        isToggling = false
      }
    }

    // First click triggers
    const p1 = safeToggle()
    expect(isToggling).toBe(true)

    // Second and third clicks while in-flight
    const p2 = safeToggle()
    const p3 = safeToggle()

    resolvePromise()
    await Promise.all([p1, p2, p3])

    expect(callCount).toBe(1)
    expect(isToggling).toBe(false)
  })
})
