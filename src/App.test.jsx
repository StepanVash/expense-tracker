import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
    expect(container.querySelectorAll('.card')).toHaveLength(3)
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
    expect(container.textContent).toContain('Coming in Step 3')
    click(tab('Settings'))
    expect(container.textContent).toContain('Expense categories')
    click(tab('Dashboard'))
    expect(container.querySelectorAll('.card')).toHaveLength(3)
  })
})
