import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Settings from './Settings.jsx'
import * as storage from '../storage.js'
import * as pinStore from '../pin.js'
import { DEFAULT_CATEGORIES } from '../defaultCategories.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container, root

beforeEach(() => {
  storage.clearAll()
  pinStore.clearPin()
  storage.ensureDefaultCategories(DEFAULT_CATEGORIES)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Settings />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

/** Type into a React-controlled input. */
function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Settings page', () => {
  it('shows the default categories', () => {
    expect(container.textContent).toContain('Grocery')
    expect(container.textContent).toContain('Salary')
    expect(container.textContent).toContain('Coffee')
  })

  it('adds a new expense category', () => {
    const form = container.querySelectorAll('.add-category form')[0] // expense section
    act(() => form.querySelector('.emoji-input').click()) // open picker
    act(() => container.querySelector('[aria-label="Emoji 🎁"]').click()) // pick emoji
    act(() => type(form.querySelector('.name-input'), 'Gifts'))
    act(() => form.querySelector('button[type=submit]').click())

    expect(container.textContent).toContain('Gifts')
    const gifts = storage.getCategories().find((c) => c.name === 'Gifts')
    expect(gifts.type).toBe('expense')
    expect(gifts.emoji).toBe('🎁')
  })

  it('opens the emoji picker, selects an emoji and closes it', () => {
    const form = container.querySelectorAll('.add-category form')[0]
    expect(container.querySelector('.emoji-popup')).toBeNull()
    act(() => form.querySelector('.emoji-input').click())
    expect(container.querySelector('.emoji-popup')).not.toBeNull()
    act(() => container.querySelector('[aria-label="Emoji 🚀"]').click())
    expect(container.querySelector('.emoji-popup')).toBeNull()
    expect(form.querySelector('.emoji-input').textContent).toBe('🚀')
  })

  it('closes the emoji picker on Escape', () => {
    const form = container.querySelectorAll('.add-category form')[0]
    act(() => form.querySelector('.emoji-input').click())
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(container.querySelector('.emoji-popup')).toBeNull()
  })

  it('shows an error for a duplicate name', () => {
    const form = container.querySelectorAll('.add-category form')[0]
    act(() => type(form.querySelector('.name-input'), 'grocery'))
    act(() => form.querySelector('button[type=submit]').click())
    expect(container.querySelector('.error').textContent).toMatch(/already exists/)
  })

  it('stops at 50 symbols and shows an error message', () => {
    const form = container.querySelectorAll('.add-category form')[0]
    const input = form.querySelector('.name-input')

    act(() => type(input, 'x'.repeat(50)))
    expect(container.querySelector('.error')).toBeNull() // exactly 50 is fine

    act(() => type(input, 'x'.repeat(51)))
    expect(input.value).toHaveLength(50) // extra symbol refused
    expect(container.querySelector('.error').textContent).toMatch(/cannot be longer than 50 symbols/)

    act(() => type(input, 'short')) // error disappears once the user fixes it
    expect(container.querySelector('.error')).toBeNull()
  })

  it('renames a category', () => {
    act(() => container.querySelector('[aria-label="Edit Coffee"]').click())
    const input = container.querySelector('.category-list .name-input')
    act(() => type(input, 'Coffee & snacks'))
    act(() => input.form.querySelector('button[type=submit]').click())
    expect(container.textContent).toContain('Coffee & snacks')
  })

  it('switches themes between Light, Dark, and System', () => {
    const darkBtn = Array.from(container.querySelectorAll('.theme-toggle-btn')).find((b) =>
      b.textContent.includes('Dark'),
    )
    act(() => darkBtn.click())
    expect(document.documentElement.dataset.theme).toBe('dark')

    const lightBtn = Array.from(container.querySelectorAll('.theme-toggle-btn')).find((b) =>
      b.textContent.includes('Light'),
    )
    act(() => lightBtn.click())
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('displays learned merchant rules and allows deleting them', () => {
    const grocery = storage.getCategories().find((c) => c.name === 'Grocery')
    storage.saveLearnedRule({ pattern: 'biedronka', categoryId: grocery.id, type: 'expense' })

    // unmount and mount new Settings to pick up saved rule
    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<Settings />))
    expect(container.textContent).toContain('biedronka')

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const deleteBtn = container.querySelector('[aria-label=\'Delete rule for "biedronka"\']')
    expect(deleteBtn).not.toBeNull()

    act(() => deleteBtn.click())
    expect(storage.getLearnedRules()).toHaveLength(0)
    expect(container.textContent).toContain('Forgot learned rule')
  })

  it('downloads a JSON backup file', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURL = vi.fn()
    window.URL.createObjectURL = createObjectURL
    window.URL.revokeObjectURL = revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const downloadBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Download Backup'),
    )
    expect(downloadBtn).not.toBeNull()
    act(() => downloadBtn.click())

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(container.textContent).toContain('Backup exported')
  })

  it('resets all data when confirmed in Danger Zone', () => {
    // Add custom transaction first
    storage.addTransaction({
      type: 'expense',
      date: '2026-02-10',
      amount: 120,
      title: 'Headphones',
    })
    expect(storage.getTransactions()).toHaveLength(1)

    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Reset All Data'),
    )
    act(() => resetBtn.click())

    // Confirmation box is shown
    expect(container.textContent).toContain('Are you sure you want to reset all data?')

    const confirmBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Yes, reset everything'),
    )
    act(() => confirmBtn.click())

    expect(storage.getTransactions()).toHaveLength(0)
    expect(container.textContent).toContain('All data has been reset to defaults')
  })

  it('sets a new PIN and resets an existing PIN in Security & PIN', () => {
    const newPinInput = container.querySelector('[aria-label="New PIN"]')
    const confirmInput = container.querySelector('[aria-label="Confirm New PIN"]')
    const form = container.querySelector('.pin-reset-form')

    // Rejects mismatched confirmation
    act(() => {
      type(newPinInput, '1234')
      type(confirmInput, '9999')
    })
    act(() => form.querySelector('button[type="submit"]').click())
    expect(form.querySelector('.error').textContent).toContain('do not match')
    expect(pinStore.hasPin()).toBe(false)

    // Sets PIN when valid
    act(() => {
      type(newPinInput, '1234')
      type(confirmInput, '1234')
    })
    act(() => form.querySelector('button[type="submit"]').click())
    expect(pinStore.hasPin()).toBe(true)
    expect(pinStore.verifyPin('1234')).toBe(true)
    expect(container.textContent).toContain('PIN has been set successfully')

    // Now Current PIN field appears to reset PIN
    const currentInput = container.querySelector('[aria-label="Current PIN"]')
    expect(currentInput).not.toBeNull()

    // Rejects wrong current PIN
    act(() => {
      type(currentInput, '0000')
      type(container.querySelector('[aria-label="New PIN"]'), '5678')
      type(container.querySelector('[aria-label="Confirm New PIN"]'), '5678')
    })
    act(() => form.querySelector('button[type="submit"]').click())
    expect(form.querySelector('.error').textContent).toContain('Current PIN is incorrect')
    expect(pinStore.verifyPin('1234')).toBe(true)

    // Resets PIN when current PIN is correct
    act(() => {
      type(currentInput, '1234')
      type(container.querySelector('[aria-label="New PIN"]'), '5678')
      type(container.querySelector('[aria-label="Confirm New PIN"]'), '5678')
    })
    act(() => form.querySelector('button[type="submit"]').click())
    expect(pinStore.verifyPin('1234')).toBe(false)
    expect(pinStore.verifyPin('5678')).toBe(true)
    expect(container.textContent).toContain('PIN has been reset successfully')
  })
})
