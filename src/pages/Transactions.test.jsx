import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Transactions from './Transactions.jsx'
import * as storage from '../storage.js'
import { DEFAULT_CATEGORIES } from '../defaultCategories.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const MONTH = '2026-03'
let container, root

const cat = (name) => storage.getCategories().find((c) => c.name === name)
const seed = (over) =>
  storage.addTransaction({ type: 'expense', date: `${MONTH}-10`, amount: 10, title: 'x', ...over })

function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Transactions month={MONTH} />))
}

beforeEach(() => {
  storage.clearAll()
  storage.ensureDefaultCategories(DEFAULT_CATEGORIES)
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  vi.restoreAllMocks()
})

// ----- helpers to drive React-controlled fields -----
const q = (sel) => container.querySelector(sel)
const rows = () => [...container.querySelectorAll('.tx-row')]
const rowTitles = () => rows().map((r) => r.querySelector('.tx-title').textContent)

function setInput(el, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
function setSelect(el, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}
const addForm = () => container.querySelectorAll('.tx-form')[0]
const field = (form, label) => form.querySelector(`[aria-label="${label}"]`)
const submit = (form) => act(() => form.querySelector('button[type=submit]').click())

function fillAndAdd({ amount, title, categoryName, date }) {
  const f = addForm()
  if (date) act(() => setInput(field(f, 'Date'), date))
  act(() => setInput(field(f, 'Amount'), amount))
  if (title !== undefined) act(() => setInput(field(f, 'Title'), title))
  if (categoryName) act(() => setSelect(field(f, 'Category'), cat(categoryName).id))
  submit(f)
}

describe('adding transactions', () => {
  it('adds an expense, accepts a decimal comma, and clears the form', () => {
    mount()
    fillAndAdd({ amount: '24,35', title: 'biedronka', categoryName: 'Grocery' })

    const [t] = storage.getTransactions()
    expect(t).toMatchObject({
      type: 'expense', amount: 24.35, title: 'biedronka', date: `${MONTH}-01`, categoryId: cat('Grocery').id,
    })
    expect(rowTitles()).toEqual(['biedronka'])
    expect(q('.notice').textContent).toContain('Added')
    expect(field(addForm(), 'Amount').value).toBe('')
    expect(field(addForm(), 'Title').value).toBe('')
  })

  it('adds income using the Income toggle and only offers income categories', () => {
    mount()
    const f = addForm()
    act(() => [...f.querySelectorAll('.type-toggle button')].find((b) => b.textContent === 'Income').click())
    const names = [...field(f, 'Category').options].map((o) => o.textContent)
    expect(names.some((n) => n.includes('Salary'))).toBe(true)
    expect(names.some((n) => n.includes('Grocery'))).toBe(false)

    fillAndAdd({ amount: '19502.52', title: 'salary', categoryName: 'Salary' })
    expect(storage.getTransactions()[0]).toMatchObject({ type: 'income', amount: 19502.52 })
    expect(q('.tx-amount.income').textContent).toContain('+')
  })

  it('shows an error and saves nothing for an invalid amount', () => {
    mount()
    fillAndAdd({ amount: '', title: 'nothing' })
    expect(q('.error').textContent).toMatch(/Amount/)
    fillAndAdd({ amount: '-5', title: 'nothing' })
    expect(q('.error').textContent).toMatch(/Amount/)
    expect(storage.getTransactions()).toHaveLength(0)
  })

  it('does not save a date earlier than January 2026', () => {
    mount()
    fillAndAdd({ amount: '5', title: 'old', date: '2025-12-31' })
    expect(storage.getTransactions()).toHaveLength(0)
  })

  it('says so when a transaction is added to a month other than the one being viewed', () => {
    mount()
    fillAndAdd({ amount: '5', title: 'april thing', date: '2026-04-05' })
    expect(q('.notice').textContent).toContain('April 2026')
    expect(rowTitles()).toEqual([]) // not in March
  })
})

describe('category suggestion', () => {
  it('suggests the category from earlier transactions and keeps manual choices', () => {
    seed({ title: 'biedronka', categoryId: cat('Grocery').id })
    mount()
    const f = addForm()

    act(() => setInput(field(f, 'Title'), 'biedronka'))
    expect(field(f, 'Category').value).toBe(cat('Grocery').id)
    expect(q('.hint').textContent).toContain('suggested')

    // user picks another category by hand -> typing more must not override it
    act(() => setSelect(field(f, 'Category'), cat('Shopping').id))
    act(() => setInput(field(f, 'Title'), 'biedronka again'))
    expect(field(f, 'Category').value).toBe(cat('Shopping').id)
    expect(q('.hint')).toBeNull()
  })
})

describe('transaction list', () => {
  it('shows only the selected month, newest first', () => {
    seed({ title: 'older', date: `${MONTH}-02` })
    seed({ title: 'newer', date: `${MONTH}-20` })
    seed({ title: 'other month', date: '2026-04-01' })
    mount()
    expect(rowTitles()).toEqual(['newer', 'older'])
  })

  it('shows "Uncategorized" for transactions without a category', () => {
    seed({ title: 'mystery', categoryId: null })
    mount()
    expect(rows()[0].textContent).toContain('Uncategorized')
  })

  it('searches by title', () => {
    seed({ title: 'biedronka' })
    seed({ title: 'lidl' })
    mount()
    act(() => setInput(q('[aria-label="Search"]'), 'BIED'))
    expect(rowTitles()).toEqual(['biedronka'])
    act(() => setInput(q('[aria-label="Search"]'), 'zzz'))
    expect(container.textContent).toContain('No transactions match your filters')
  })

  it('filters by type and by category, and totals what is shown', () => {
    seed({ title: 'a', amount: 100, categoryId: cat('Grocery').id })
    seed({ title: 'b', amount: 50, categoryId: cat('Coffee').id })
    seed({ title: 'pay', type: 'income', amount: 1000, categoryId: cat('Salary').id })
    mount()
    expect(rows()).toHaveLength(3)

    act(() => setSelect(q('[aria-label="Filter by type"]'), 'income'))
    expect(rowTitles()).toEqual(['pay'])

    act(() => setSelect(q('[aria-label="Filter by type"]'), 'all'))
    act(() => setSelect(q('[aria-label="Filter by category"]'), cat('Grocery').id))
    expect(rowTitles()).toEqual(['a'])
    expect(q('.tx-summary').textContent.replace(/\s/g, ' ')).toContain('100,00')

    act(() => setSelect(q('[aria-label="Filter by category"]'), 'all'))
    expect(rows()).toHaveLength(3)
  })

  it('filters uncategorized transactions', () => {
    seed({ title: 'has cat', categoryId: cat('Grocery').id })
    seed({ title: 'no cat', categoryId: null })
    mount()
    act(() => setSelect(q('[aria-label="Filter by category"]'), 'none'))
    expect(rowTitles()).toEqual(['no cat'])
  })
})

describe('editing and deleting', () => {
  it('edits a transaction', () => {
    seed({ title: 'lidl', amount: 20, categoryId: cat('Grocery').id })
    mount()
    act(() => q('[aria-label="Edit lidl"]').click())

    const form = container.querySelectorAll('.tx-form')[1] // [0] is the add form
    expect(field(form, 'Amount').value).toBe('20')
    act(() => setInput(field(form, 'Amount'), '35,5'))
    act(() => setInput(field(form, 'Title'), 'lidl market'))
    submit(form)

    expect(storage.getTransactions()[0]).toMatchObject({ amount: 35.5, title: 'lidl market' })
    expect(rowTitles()).toEqual(['lidl market'])
    expect(container.querySelectorAll('.tx-form')).toHaveLength(1) // edit form closed
  })

  it('cancels an edit without saving', () => {
    seed({ title: 'lidl', amount: 20 })
    mount()
    act(() => q('[aria-label="Edit lidl"]').click())
    const form = container.querySelectorAll('.tx-form')[1]
    act(() => setInput(field(form, 'Amount'), '999'))
    act(() => [...form.querySelectorAll('button')].find((b) => b.textContent.includes('Cancel')).click())
    expect(storage.getTransactions()[0].amount).toBe(20)
  })

  it('shows an error when an edit is invalid and keeps the form open', () => {
    seed({ title: 'lidl', amount: 20 })
    mount()
    act(() => q('[aria-label="Edit lidl"]').click())
    const form = container.querySelectorAll('.tx-form')[1]
    act(() => setInput(field(form, 'Amount'), '0'))
    submit(form)
    expect(form.querySelector('.error').textContent).toMatch(/Amount/)
    expect(storage.getTransactions()[0].amount).toBe(20)
  })

  it('deletes only after confirmation', () => {
    seed({ title: 'lidl' })
    mount()

    vi.spyOn(window, 'confirm').mockReturnValue(false)
    act(() => q('[aria-label="Delete lidl"]').click())
    expect(storage.getTransactions()).toHaveLength(1)

    window.confirm.mockReturnValue(true)
    act(() => q('[aria-label="Delete lidl"]').click())
    expect(storage.getTransactions()).toHaveLength(0)
    expect(rows()).toHaveLength(0)
  })
})

describe('CSV import modal integration', () => {
  it('opens and closes the CSV modal', () => {
    mount()
    expect(q('.modal-backdrop')).toBeNull()
    act(() => q('[aria-label="Upload CSV"]').click())
    expect(q('.modal-backdrop')).not.toBeNull()
    expect(q('.modal-card').textContent).toContain('Upload CSV Statement')

    act(() => q('[aria-label="Close modal"]').click())
    expect(q('.modal-backdrop')).toBeNull()
  })
})
