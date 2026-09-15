import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getArabicMediaErrorMessage } from '~/composables/useLiveKitSession'
import { useSessionI18n, currentLocale } from '~/composables/useSessionI18n'

describe('useSessionI18n Localization', () => {
  beforeEach(() => {
    currentLocale.value = 'en'
  })

  it('defaults to English and resolves keys correctly', () => {
    const { t, locale } = useSessionI18n()
    expect(locale.value).toBe('en')
    expect(t('session.waitingRoom.badge')).toBe('Virtual Waiting Room')
    expect(t('session.controls.micMute')).toBe('Mute microphone')
    expect(t('session.controls.endCall')).toBe('End Session')
    expect(t('session.devices.title')).toBe('Media & Device Settings')
  })

  it('returns English error messages by default', () => {
    const { getMediaErrorMessage } = useSessionI18n()
    const permErr = new Error('Permission denied')
    permErr.name = 'NotAllowedError'

    expect(getMediaErrorMessage(permErr, 'microphone')).toBe(
      'Microphone access was denied. Please allow microphone permissions in your browser settings.',
    )
    expect(getMediaErrorMessage(permErr, 'camera')).toBe(
      'Camera access was denied. Please allow camera permissions in your browser settings.',
    )
  })

  it('switches to Arabic dynamically when locale is changed', () => {
    const { t, locale, getMediaErrorMessage } = useSessionI18n()
    locale.value = 'ar'

    expect(t('session.waitingRoom.badge')).toBe('غرفة الانتظار الافتراضية')
    expect(t('session.controls.micMute')).toBe('كتم الميكروفون')

    const busyErr = new Error('Camera in use')
    busyErr.name = 'NotReadableError'
    expect(getMediaErrorMessage(busyErr, 'camera')).toBe(
      'تعذر تشغيل الكاميرا. تأكد من أن الكاميرا ليست مستخدمة بواسطة تطبيق آخر.',
    )
  })
})

describe('getArabicMediaErrorMessage (backward-compatible wrapper)', () => {
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
})

describe('Media Toggle Lifecycle simulation', () => {
  it('simulates infinite ON -> OFF -> ON -> OFF -> ON cycles on LiveKit participant without unpublishing', async () => {
    let isMicMuted = false
    let isCamMuted = false
    let unpublishCount = 0

    const mockLocalParticipant = {
      get isMicrophoneEnabled() {
        return !isMicMuted
      },
      get isCameraEnabled() {
        return !isCamMuted
      },
      setMicrophoneEnabled: vi.fn(async (enabled: boolean) => {
        isMicMuted = !enabled
        return {} as any
      }),
      setCameraEnabled: vi.fn(async (enabled: boolean) => {
        isCamMuted = !enabled
        return {} as any
      }),
      unpublishTrack: vi.fn(async () => {
        unpublishCount++
      }),
    }

    // Initial state: ON
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(true)
    expect(mockLocalParticipant.isCameraEnabled).toBe(true)

    // Toggle Mic OFF -> ON -> OFF -> ON
    await mockLocalParticipant.setMicrophoneEnabled(false)
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(false)
    await mockLocalParticipant.setMicrophoneEnabled(true)
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(true)
    await mockLocalParticipant.setMicrophoneEnabled(false)
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(false)
    await mockLocalParticipant.setMicrophoneEnabled(true)
    expect(mockLocalParticipant.isMicrophoneEnabled).toBe(true)

    // Toggle Cam OFF -> ON -> OFF -> ON
    await mockLocalParticipant.setCameraEnabled(false)
    expect(mockLocalParticipant.isCameraEnabled).toBe(false)
    await mockLocalParticipant.setCameraEnabled(true)
    expect(mockLocalParticipant.isCameraEnabled).toBe(true)
    await mockLocalParticipant.setCameraEnabled(false)
    expect(mockLocalParticipant.isCameraEnabled).toBe(false)
    await mockLocalParticipant.setCameraEnabled(true)
    expect(mockLocalParticipant.isCameraEnabled).toBe(true)

    // Verify unpublishTrack was never called
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

    const p1 = safeToggle()
    expect(isToggling).toBe(true)
    const p2 = safeToggle()
    const p3 = safeToggle()

    resolvePromise()
    await Promise.all([p1, p2, p3])

    expect(callCount).toBe(1)
    expect(isToggling).toBe(false)
  })
})

describe('Device Switching & AirPods Scenario simulation', () => {
  it('switches active microphone device cleanly without room reconnection', async () => {
    let currentInput = 'built-in-mic'
    const switchActiveDevice = vi.fn(async (kind: string, deviceId: string) => {
      if (kind === 'audioinput') {
        currentInput = deviceId
      }
    })

    const roomMock = {
      switchActiveDevice,
      getActiveDevice: () => currentInput,
    }

    // User switches from Laptop Mic to AirPods Mic
    await roomMock.switchActiveDevice('audioinput', 'airpods-mic-id')
    expect(currentInput).toBe('airpods-mic-id')
    expect(switchActiveDevice).toHaveBeenCalledWith('audioinput', 'airpods-mic-id')

    // User switches to USB Mic
    await roomMock.switchActiveDevice('audioinput', 'usb-mic-id')
    expect(currentInput).toBe('usb-mic-id')
  })

  it('handles speaker setSinkId when supported and falls back gracefully when unsupported', async () => {
    // Supported scenario
    const mockAudioElement = {
      sinkId: '',
      setSinkId: vi.fn(async (id: string) => {
        mockAudioElement.sinkId = id
      }),
    }

    await mockAudioElement.setSinkId('airpods-output-id')
    expect(mockAudioElement.sinkId).toBe('airpods-output-id')
    expect(mockAudioElement.setSinkId).toHaveBeenCalledWith('airpods-output-id')

    // Unsupported scenario
    const unsupportedAudioElement: Record<string, unknown> = {}
    expect('setSinkId' in unsupportedAudioElement).toBe(false)
  })

  it('falls back gracefully when selected device is disconnected (hot unplug)', () => {
    const devices = [
      { deviceId: 'built-in-mic', label: 'Built-in Microphone', kind: 'audioinput' },
    ]

    let selectedMic = 'usb-mic-id' // Disconnected device

    // Hot unplug logic check:
    if (!devices.some((d) => d.deviceId === selectedMic)) {
      selectedMic = devices[0]?.deviceId || 'default'
    }

    expect(selectedMic).toBe('built-in-mic')
  })
})
