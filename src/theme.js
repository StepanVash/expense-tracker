const THEME_KEY = 'expense-tracker:theme'

/** @returns {'light' | 'dark' | 'system'} */
export function getStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // fallback if storage unavailable
  }
  return 'system'
}

/**
 * Calculates the active theme based on user choice and OS preference.
 * @param {'light' | 'dark' | 'system'} themeChoice
 * @returns {'light' | 'dark'}
 */
export function resolveTheme(themeChoice) {
  if (themeChoice === 'light' || themeChoice === 'dark') return themeChoice
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

/**
 * Applies the theme data attribute to document.documentElement and saves the setting.
 * @param {'light' | 'dark' | 'system'} themeChoice
 */
export function applyTheme(themeChoice) {
  if (typeof document === 'undefined') return
  const resolved = resolveTheme(themeChoice)
  document.documentElement.dataset.theme = resolved
  try {
    localStorage.setItem(THEME_KEY, themeChoice)
  } catch {
    // ignore
  }
}

/**
 * Initialize theme listeners on startup. Returns a cleanup function.
 * @param {(resolved: 'light' | 'dark') => void} [onChange]
 */
export function initTheme(onChange) {
  const current = getStoredTheme()
  applyTheme(current)

  if (typeof window === 'undefined' || !window.matchMedia) return () => {}

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system')
      if (onChange) onChange(resolveTheme('system'))
    }
  }

  mediaQuery.addEventListener('change', listener)
  return () => mediaQuery.removeEventListener('change', listener)
}
