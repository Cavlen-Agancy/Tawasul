import { ref, readonly } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tawasul-color-mode'

const isClient = () => typeof window !== 'undefined' && typeof document !== 'undefined'

// Module-level reactive singleton state so all components stay in sync
const themeMode = ref<ThemeMode>('system')
const isDark = ref(false)
let isInitialized = false
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null

function updateThemeColorMeta(dark: boolean) {
  if (!isClient()) return
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', dark ? '#11121a' : '#E91E8C')
  }
}

function applyTheme(dark: boolean) {
  if (!isClient()) return
  isDark.value = dark
  const root = document.documentElement
  if (dark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  updateThemeColorMeta(dark)
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (!isClient()) return false
  if (mode === 'dark') return true
  if (mode === 'light') return false
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

function setupMediaQueryListener() {
  if (!isClient() || mediaQueryListener || typeof window.matchMedia !== 'function') return
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQueryListener = (e: MediaQueryListEvent) => {
    if (themeMode.value === 'system') {
      applyTheme(e.matches)
    }
  }
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', mediaQueryListener)
  }
}

function initTheme() {
  if (!isClient() || isInitialized) return
  isInitialized = true

  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      themeMode.value = saved
    } else {
      themeMode.value = 'system'
    }
  } catch {
    themeMode.value = 'system'
  }

  const shouldBeDark = resolveIsDark(themeMode.value)
  applyTheme(shouldBeDark)
  setupMediaQueryListener()
}

export function useTheme() {
  if (isClient() && !isInitialized) {
    initTheme()
  }

  function setTheme(newMode: ThemeMode) {
    themeMode.value = newMode
    if (isClient()) {
      try {
        localStorage.setItem(STORAGE_KEY, newMode)
      } catch {
        // LocalStorage might fail in restricted environments
      }
      const shouldBeDark = resolveIsDark(newMode)
      applyTheme(shouldBeDark)
    }
  }

  function toggleTheme() {
    // If currently dark, switch to light; if currently light, switch to dark
    const next = isDark.value ? 'light' : 'dark'
    setTheme(next)
  }

  function cycleTheme() {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const nextIndex = (modes.indexOf(themeMode.value) + 1) % modes.length
    setTheme(modes[nextIndex])
  }

  return {
    theme: themeMode,
    isDark: readonly(isDark),
    setTheme,
    toggleTheme,
    cycleTheme,
    initTheme,
  }
}
