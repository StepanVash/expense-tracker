import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getStoredTheme, resolveTheme, applyTheme, initTheme } from './theme.js'

describe('theme utilities', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('defaults to system when no theme is saved', () => {
    expect(getStoredTheme()).toBe('system')
  })

  it('stores and applies light theme', () => {
    applyTheme('light')
    expect(getStoredTheme()).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('stores and applies dark theme', () => {
    applyTheme('dark')
    expect(getStoredTheme()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('resolves explicit light and dark themes', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('resolves system theme based on matchMedia', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    expect(resolveTheme('system')).toBe('dark')
  })

  it('initializes and applies current theme', () => {
    applyTheme('dark')
    const cleanup = initTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
    cleanup()
  })
})
