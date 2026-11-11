import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import * as storage from './storage.js'
import * as pinStore from './pin.js'
import { currentMonth, formatMonth, shiftMonth } from './format.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container, root

beforeEach(() => {
  storage.clearAll()
  pinStore.clearPin()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const render = () => act(() => root.render(<App />))
const click = (el) => act(() => el.click())
const tab = (label) => [...container.querySelectorAll('.tab')].find((t) => t.textContent.includes(label))

function renderUnlocked() {
  pinStore.setPin('1234')
  render()
  act(() => type(container.querySelector('[aria-label="PIN"]'), '1234'))
  click(container.querySelector('.pin-submit-btn'))
}

describe('App', () => {
  it('asks first-time user to set up a PIN before showing the app', () => {
    render()
    expect(container.textContent).toContain('Set Up Access PIN')
    expect(container.querySelector('.tabs')).toBeNull()

    // Mismatched PINs show an error
    act(() => {
      type(container.querySelector('[aria-label="New PIN"]'), '4321')
      type(container.querySelector('[aria-label="Confirm PIN"]'), '9999')
    })
    click(container.querySelector('.pin-submit-btn'))
    expect(container.querySelector('.pin-error').textContent).toContain('do not match')
    expect(container.querySelector('.tabs')).toBeNull()

    // Matching PIN unlocks the app and persists hashed PIN
    act(() => {
      type(container.querySelector('[aria-label="New PIN"]'), '4321')
      type(container.querySelector('[aria-label="Confirm PIN"]'), '4321')
    })
    click(container.querySelector('.pin-submit-btn'))
    expect(pinStore.hasPin()).toBe(true)
    expect(container.querySelector('.tabs')).not.toBeNull()
  })

  it('shows Enter Your PIN dialog on launch when a PIN exists and locks/unlocks properly', () => {
    pinStore.setPin('2468')
    render()

    expect(container.textContent).toContain('Enter Your PIN')
    expect(container.querySelector('.tabs')).toBeNull()

    // Wrong PIN stays locked
    act(() => type(container.querySelector('[aria-label="PIN"]'), '0000'))
    click(container.querySelector('.pin-submit-btn'))
    expect(container.querySelector('.pin-error').textContent).toContain('Incorrect PIN')
    expect(container.querySelector('.tabs')).toBeNull()

    // Correct PIN unlocks
    act(() => type(container.querySelector('[aria-label="PIN"]'), '2468'))
    click(container.querySelector('.pin-submit-btn'))
    expect(container.querySelector('.tabs')).not.toBeNull()

    // Clicking Lock button in header re-locks the app
    click(container.querySelector('[aria-label="Lock app"]'))
    expect(container.textContent).toContain('Enter Your PIN')
    expect(container.querySelector('.tabs')).toBeNull()
  })

  it('starts on the dashboard with the current month and an empty state', () => {
    renderUnlocked()
    expect(container.querySelector('.month-label').textContent).toBe(formatMonth(currentMonth()))
    expect(container.querySelectorAll('.card')).toHaveLength(4)
    expect(container.textContent).toContain('No transactions')
  })

  it('switches months with the arrows', () => {
    renderUnlocked()
    click(container.querySelector('[aria-label="Previous month"]'))
    expect(container.querySelector('.month-label').textContent).toBe(formatMonth(shiftMonth(currentMonth(), -1)))
    click(container.querySelector('[aria-label="Next month"]'))
    click(container.querySelector('[aria-label="Next month"]'))
    expect(container.querySelector('.month-label').textContent).toBe(formatMonth(shiftMonth(currentMonth(), 1)))
  })

  it('shows January 2026 (not an earlier month) if the computer clock is before 2026', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2023, 8, 15)) // September 2023
    try {
      renderUnlocked()
      expect(container.querySelector('.month-label').textContent).toBe('January 2026')
      expect(container.querySelector('[aria-label="Previous month"]').disabled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not let you go before January 2026', () => {
    renderUnlocked()
    const prev = container.querySelector('[aria-label="Previous month"]')
    // click back far more times than needed to reach January 2026
    for (let i = 0; i < 40 && !prev.disabled; i++) click(prev)
    expect(container.querySelector('.month-label').textContent).toBe('January 2026')
    expect(prev.disabled).toBe(true)
    click(prev)
    expect(container.querySelector('.month-label').textContent).toBe('January 2026')
  })

  it('allows picking any month and year directly (e.g. Apr 2027)', () => {
    renderUnlocked()
    expect(container.querySelector('.month-popup')).toBeNull()

    // open month picker popup
    click(container.querySelector('[aria-label="Select month and year"]'))
    expect(container.querySelector('.month-popup')).not.toBeNull()

    // advance year to 2027
    click(container.querySelector('[aria-label="Next year"]'))
    expect(container.querySelector('.popup-year-label').textContent).toBe('2027')

    // click Apr
    click(container.querySelector('[aria-label="Apr 2027"]'))

    // popup closed and header displays April 2027
    expect(container.querySelector('.month-popup')).toBeNull()
    expect(container.querySelector('.month-label').textContent).toBe('April 2027')
  })

  it('summarises income, expenses and savings for the selected month only', () => {
    const m = currentMonth()
    storage.addTransaction({ type: 'income', date: `${m}-05`, amount: 1000 })
    storage.addTransaction({ type: 'expense', date: `${m}-06`, amount: 250.5 })
    storage.addTransaction({ type: 'expense', date: `${shiftMonth(m, -1)}-06`, amount: 999 }) // other month
    renderUnlocked()
    const values = [...container.querySelectorAll('.card-value')].map((v) => v.textContent.replace(/\s/g, ' '))
    expect(values[0]).toContain('1000,00')
    expect(values[1]).toContain('250,50')
    expect(values[2]).toContain('749,50')
    expect(container.textContent).not.toContain('No transactions')
  })

  it('navigates between tabs and allows resetting PIN in Settings', () => {
    renderUnlocked()
    click(tab('Transactions'))
    expect(container.textContent).toContain('Add transaction')
    click(tab('Analytics'))
    expect(container.textContent).toContain('12-Month Matrix')
    click(tab('Settings'))
    expect(container.textContent).toContain('Security & PIN')
    expect(container.textContent).toContain('Expense categories')

    // Reset PIN in Settings
    act(() => {
      type(container.querySelector('[aria-label="Current PIN"]'), '1234')
      type(container.querySelector('[aria-label="New PIN"]'), '7788')
      type(container.querySelector('[aria-label="Confirm New PIN"]'), '7788')
    })
    click(container.querySelector('.pin-reset-form button[type="submit"]'))
    expect(container.textContent).toContain('PIN has been reset successfully')

    // Lock and verify new PIN works
    click(container.querySelector('[aria-label="Lock app"]'))
    act(() => type(container.querySelector('[aria-label="PIN"]'), '1234'))
    click(container.querySelector('.pin-submit-btn'))
    expect(container.querySelector('.pin-error').textContent).toContain('Incorrect PIN')

    act(() => type(container.querySelector('[aria-label="PIN"]'), '7788'))
    click(container.querySelector('.pin-submit-btn'))
    expect(container.querySelector('.tabs')).not.toBeNull()

    click(tab('Dashboard'))
    expect(container.querySelectorAll('.card')).toHaveLength(4)
  })

  it('cycles theme from the header quick button', () => {
    renderUnlocked()
    const themeBtn = container.querySelector('.theme-quick-btn:not(.lock-btn)')
    expect(themeBtn).not.toBeNull()
    click(themeBtn)
    expect(document.documentElement.dataset.theme).toBeDefined()
  })
})
