import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useTheme } from '~/composables/useTheme'

describe('useTheme composable', () => {
  let localStorageMock: Record<string, string>
  let classListMock: Set<string>
  let metaContent: string
  let mediaQueryCallback: ((e: { matches: boolean }) => void) | null

  beforeEach(() => {
    localStorageMock = {}
    classListMock = new Set<string>()
    metaContent = ''
    mediaQueryCallback = null

    // Set up mock window, document, and localStorage
    const mockStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key]
      }),
    }

    const mockDocument = {
      documentElement: {
        classList: {
          add: vi.fn((cls: string) => classListMock.add(cls)),
          remove: vi.fn((cls: string) => classListMock.delete(cls)),
          contains: vi.fn((cls: string) => classListMock.has(cls)),
        },
      },
      querySelector: vi.fn((selector: string) => {
        if (selector === 'meta[name="theme-color"]') {
          return {
            setAttribute: vi.fn((name: string, val: string) => {
              if (name === 'content') metaContent = val
            }),
          }
        }
        return null
      }),
    }

    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, cb: (e: { matches: boolean }) => void) => {
        if (event === 'change') {
          mediaQueryCallback = cb
        }
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    // Provide browser globals
    vi.stubGlobal('localStorage', mockStorage)
    vi.stubGlobal('document', mockDocument)
    vi.stubGlobal('window', { matchMedia: mockMatchMedia })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes theme, isDark, and functions', () => {
    const { theme, isDark, setTheme, toggleTheme, cycleTheme } = useTheme()
    expect(theme.value).toBeDefined()
    expect(typeof isDark.value).toBe('boolean')
    expect(typeof setTheme).toBe('function')
    expect(typeof toggleTheme).toBe('function')
    expect(typeof cycleTheme).toBe('function')
  })

  it('sets dark theme and updates storage and classList', () => {
    const { theme, isDark, setTheme } = useTheme()

    setTheme('dark')
    expect(theme.value).toBe('dark')
    expect(isDark.value).toBe(true)
    expect(localStorageMock['tawasul-color-mode']).toBe('dark')
    expect(classListMock.has('dark')).toBe(true)
  })

  it('sets light theme and removes dark class', () => {
    const { theme, isDark, setTheme } = useTheme()

    setTheme('light')
    expect(theme.value).toBe('light')
    expect(isDark.value).toBe(false)
    expect(localStorageMock['tawasul-color-mode']).toBe('light')
    expect(classListMock.has('dark')).toBe(false)
  })

  it('toggles theme from light to dark and vice versa', () => {
    const { isDark, setTheme, toggleTheme } = useTheme()

    setTheme('light')
    expect(isDark.value).toBe(false)

    toggleTheme()
    expect(isDark.value).toBe(true)
    expect(classListMock.has('dark')).toBe(true)

    toggleTheme()
    expect(isDark.value).toBe(false)
    expect(classListMock.has('dark')).toBe(false)
  })

  it('cycles theme through light, dark, and system', () => {
    const { theme, setTheme, cycleTheme } = useTheme()

    setTheme('light')
    expect(theme.value).toBe('light')

    cycleTheme()
    expect(theme.value).toBe('dark')

    cycleTheme()
    expect(theme.value).toBe('system')

    cycleTheme()
    expect(theme.value).toBe('light')
  })

  it('handles localStorage errors gracefully', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('QuotaExceeded')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {},
    }
    vi.stubGlobal('localStorage', brokenStorage)

    const { theme, setTheme } = useTheme()
    expect(() => setTheme('dark')).not.toThrow()
    expect(theme.value).toBe('dark')
  })
})
