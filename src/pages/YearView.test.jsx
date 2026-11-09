import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import YearView from './YearView.jsx'
import * as storage from '../storage.js'
import { DEFAULT_CATEGORIES } from '../defaultCategories.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container, root

function mount(props = {}) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<YearView {...props} />))
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

describe('YearView Page', () => {
  it('renders annual overview with 12 months matrix', () => {
    mount()
    expect(container.querySelector('.year-title').textContent).toContain('2026 Year Overview')
    expect(container.textContent).toContain('Jan')
    expect(container.textContent).toContain('Dec')
    expect(container.textContent).toContain('Total Income')
    expect(container.textContent).toContain('Total Expenses')
    expect(container.textContent).toContain('Net Savings')
  })

  it('aggregates annual income, expenses, and savings correctly across months', () => {
    const gCat = cat('Grocery')
    const sCat = cat('Salary')

    // Jan
    storage.addTransaction({ type: 'income', date: '2026-01-10', amount: 8000, categoryId: sCat.id })
    storage.addTransaction({ type: 'expense', date: '2026-01-15', amount: 2000, categoryId: gCat.id })

    // Feb
    storage.addTransaction({ type: 'income', date: '2026-02-10', amount: 8000, categoryId: sCat.id })
    storage.addTransaction({ type: 'expense', date: '2026-02-15', amount: 2500, categoryId: gCat.id })

    mount()

    // Annual income: 16,000, Annual expenses: 4,500, Net savings: 11,500
    const cards = container.querySelectorAll('.card-value')
    expect(cards[0].textContent).toContain('16')
    expect(cards[1].textContent).toContain('4')
    expect(cards[2].textContent).toContain('11')

    // Category matrix row for Grocery
    const groceryRow = [...container.querySelectorAll('.matrix-category-row')].find((r) =>
      r.textContent.includes('Grocery'),
    )
    expect(groceryRow).not.toBeNull()
    expect(groceryRow.textContent).toContain('4') // total 4500
  })

  it('navigates years with stepper and prevents going earlier than 2026', () => {
    mount()
    const prevBtn = container.querySelector('[aria-label="Previous year"]')
    const nextBtn = container.querySelector('[aria-label="Next year"]')

    expect(prevBtn.disabled).toBe(true)

    // Advance to 2027
    act(() => nextBtn.click())
    expect(container.querySelector('.year-title').textContent).toContain('2027 Year Overview')
    expect(prevBtn.disabled).toBe(false)

    // Back to 2026
    act(() => prevBtn.click())
    expect(container.querySelector('.year-title').textContent).toContain('2026 Year Overview')
    expect(prevBtn.disabled).toBe(true)
  })

  it('calls onSelectMonth callback when month header is clicked', () => {
    const onSelect = vi.fn()
    mount({ onSelectMonth: onSelect })

    const janBtn = [...container.querySelectorAll('.month-jump-btn')].find((b) =>
      b.textContent.includes('Jan'),
    )
    act(() => janBtn.click())
    expect(onSelect).toHaveBeenCalledWith('2026-01')
  })

  it('switches to Year Comparison mode and compares two years side-by-side', () => {
    const gCat = cat('Grocery')
    const sCat = cat('Salary')

    // 2026: 10k income, 3k grocery
    storage.addTransaction({ type: 'income', date: '2026-05-10', amount: 10000, categoryId: sCat.id })
    storage.addTransaction({ type: 'expense', date: '2026-05-15', amount: 3000, categoryId: gCat.id })

    // 2027: 12k income, 2.5k grocery (saved 500!)
    storage.addTransaction({ type: 'income', date: '2027-05-10', amount: 12000, categoryId: sCat.id })
    storage.addTransaction({ type: 'expense', date: '2027-05-15', amount: 2500, categoryId: gCat.id })

    mount()

    // Switch to comparison tab
    const compareTab = [...container.querySelectorAll('.mode-btn')].find((b) =>
      b.textContent.includes('Compare Years'),
    )
    act(() => compareTab.click())

    expect(container.textContent).toContain('Monthly Comparison: 2026 vs. 2027')
    expect(container.textContent).toContain('Category-by-Category YoY Comparison')

    // Grocery row should show 2026 vs 2027 and percentage saved
    const groceryRow = [...container.querySelectorAll('.compare-table tbody tr')].find((r) =>
      r.textContent.includes('Grocery'),
    )
    expect(groceryRow).not.toBeNull()
    expect(groceryRow.textContent).toContain('3000') // 2026
    expect(groceryRow.textContent).toContain('2500') // 2027
    expect(groceryRow.textContent).toContain('-17%') // -500 / 3000 = -17%
  })

  it('switches to Compare Seasons mode and compares expenses by season', () => {
    const gCat = cat('Grocery')

    // Summer (July)
    storage.addTransaction({ type: 'expense', date: '2026-07-10', amount: 1200, categoryId: gCat.id })
    // Autumn (October)
    storage.addTransaction({ type: 'expense', date: '2026-10-15', amount: 800, categoryId: gCat.id })

    mount()

    // Switch to Compare Seasons
    const seasonsTab = [...container.querySelectorAll('.mode-btn')].find((b) =>
      b.textContent.includes('Compare Seasons'),
    )
    act(() => seasonsTab.click())

    expect(container.textContent).toContain('Summer')
    expect(container.textContent).toContain('Autumn')
    expect(container.textContent).toContain('Winter')
    expect(container.textContent).toContain('Spring')
    expect(container.textContent).toContain('Category Breakdown by Season')

    // Grocery row in season table
    expect(container.textContent).toContain('1200')
    expect(container.textContent).toContain('800')
  })
})
