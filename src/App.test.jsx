import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import * as storage from './storage.js'
import { currentMonth, formatMonth, shiftMonth } from './format.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container, root

beforeEach(() => {
  storage.clearAll()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const render = () => act(() => root.render(<App />))
const click = (el) => act(() => el.click())
const tab = (label) => [...container.querySelectorAll('.tab')].find((t) => t.textContent.includes(label))

describe('App', () => {
  it('starts on the dashboard with the current month and an empty state', () => {
    render()
    expect(container.querySelector('.month-label').textContent).toBe(formatMonth(currentMonth()))
    expect(container.querySelectorAll('.card')).toHaveLength(4)
    expect(container.textContent).toContain('No transactions')
  })

  it('switches months with the arrows', () => {
    render()
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
      render()
      expect(container.querySelector('.month-label').textContent).toBe('January 2026')
      expect(container.querySelector('[aria-label="Previous month"]').disabled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not let you go before January 2026', () => {
    render()
    const prev = container.querySelector('[aria-label="Previous month"]')
    // click back far more times than needed to reach January 2026
    for (let i = 0; i < 40 && !prev.disabled; i++) click(prev)
    expect(container.querySelector('.month-label').textContent).toBe('January 2026')
    expect(prev.disabled).toBe(true)
    click(prev)
    expect(container.querySelector('.month-label').textContent).toBe('January 2026')
  })

  it('allows picking any month and year directly (e.g. Apr 2027)', () => {
    render()
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
    render()
    const values = [...container.querySelectorAll('.card-value')].map((v) => v.textContent.replace(/\s/g, ' '))
    expect(values[0]).toContain('1000,00')
    expect(values[1]).toContain('250,50')
    expect(values[2]).toContain('749,50')
    expect(container.textContent).not.toContain('No transactions')
  })

  it('navigates between tabs', () => {
    render()
    click(tab('Transactions'))
    expect(container.textContent).toContain('Add transaction')
    click(tab('Year'))
    expect(container.textContent).toContain('Year Overview')
    click(tab('Settings'))
    expect(container.textContent).toContain('Expense categories')
    click(tab('Dashboard'))
    expect(container.querySelectorAll('.card')).toHaveLength(4)
  })
})
