import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Dashboard from './Dashboard.jsx'
import * as storage from '../storage.js'
import { DEFAULT_CATEGORIES } from '../defaultCategories.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const MONTH = '2026-01'
let container, root

function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Dashboard month={MONTH} />))
}

beforeEach(() => {
  storage.clearAll()
  storage.ensureDefaultCategories(DEFAULT_CATEGORIES)
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

const cat = (name) => storage.getCategories().find((c) => c.name === name)

describe('Dashboard Page', () => {
  it('displays motivational banner when income exceeds expenses', () => {
    storage.addTransaction({ type: 'income', date: `${MONTH}-09`, amount: 10000, title: 'salary' })
    storage.addTransaction({ type: 'expense', date: `${MONTH}-10`, amount: 2000, title: 'rent' })
    mount()

    expect(container.querySelector('.insight-banner').textContent).toContain('Woohoo!')
    expect(container.querySelector('.insight-banner').textContent).toContain('80% savings rate')
  })

  it('displays warning banner when spending exceeds income', () => {
    storage.addTransaction({ type: 'income', date: `${MONTH}-09`, amount: 1000, title: 'part-time' })
    storage.addTransaction({ type: 'expense', date: `${MONTH}-10`, amount: 3000, title: 'car repair' })
    mount()

    expect(container.querySelector('.insight-banner').textContent).toContain('Heads up')
  })

  it('ranks and displays top 5 largest expenses', () => {
    const gCat = cat('Grocery')
    storage.addTransaction({ type: 'expense', date: `${MONTH}-01`, amount: 50, title: 'Small snack', categoryId: gCat.id })
    storage.addTransaction({ type: 'expense', date: `${MONTH}-02`, amount: 1500, title: 'Rent payment' })
    storage.addTransaction({ type: 'expense', date: `${MONTH}-03`, amount: 350, title: 'Big grocery trip', categoryId: gCat.id })
    storage.addTransaction({ type: 'expense', date: `${MONTH}-04`, amount: 120, title: 'Train ticket' })
    storage.addTransaction({ type: 'expense', date: `${MONTH}-05`, amount: 80, title: 'Restaurant' })
    storage.addTransaction({ type: 'expense', date: `${MONTH}-06`, amount: 20, title: 'Coffee' })
    mount()

    const items = container.querySelectorAll('.top-expense-item')
    expect(items).toHaveLength(5)
    expect(items[0].textContent).toContain('Rent payment')
    expect(items[0].textContent).toContain('#1')
    expect(items[1].textContent).toContain('Big grocery trip')
  })

  it('allows inline editing of planned budget amounts and saves them immediately', () => {
    const gCat = cat('Grocery')
    storage.addTransaction({ type: 'expense', date: `${MONTH}-05`, amount: 400, categoryId: gCat.id })
    mount()

    // Click to edit planned budget for Grocery
    const editBtn = container.querySelector(`[aria-label="Edit planned budget for ${gCat.name}"]`)
    act(() => editBtn.click())

    // Type new budget 1000
    const input = container.querySelector(`[aria-label="Planned budget for ${gCat.name}"]`)
    expect(input).not.toBeNull()
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '1000')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    // Click save check button
    act(() => container.querySelector('.save-btn').click())

    // Verifies budget was saved to storage
    const saved = storage.getBudgets(MONTH).find((b) => b.categoryId === gCat.id)
    expect(saved.planned).toBe(1000)

    // Table reflects left difference: 1000 planned - 400 actual = +600 left
    expect(container.querySelector('.diff-pill.success').textContent).toContain('600')
  })
})
