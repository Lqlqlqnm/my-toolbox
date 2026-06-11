export type ThemeMode = 'system' | 'dark' | 'light'

const STORAGE_KEY = 'theme-mode'

export function getThemeMode(): ThemeMode {
  return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system'
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode)
  applyTheme(mode)
}

export function applyTheme(mode?: ThemeMode) {
  const m = mode || getThemeMode()
  const isDark =
    m === 'dark' || (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', isDark)
}

export function initTheme() {
  applyTheme()
  // Listen for system theme changes when in 'system' mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemeMode() === 'system') applyTheme()
  })
}
