import { describe, it, expect, beforeEach } from 'vitest'
import * as storage from './storage.js'

beforeEach(() => storage.clearAll())

describe('transactions', () => {
  it('starts empty', () => {
    expect(storage.getTransactions()).toEqual([])
  })

  it('adds, updates and deletes a transaction', () => {
    const tx = storage.addTransaction({
      type: 'expense', date: '2026-01-02', amount: '24.35', title: ' biedronka ', categoryId: null,
    })
    expect(tx.id).toBeTruthy()
    expect(tx.amount).toBe(24.35)
    expect(tx.title).toBe('biedronka')

    storage.updateTransaction(tx.id, { amount: 30 })
    expect(storage.getTransactions()[0].amount).toBe(30)

    storage.deleteTransaction(tx.id)
    expect(storage.getTransactions()).toEqual([])
  })

  it('rejects invalid data', () => {
    expect(() => storage.addTransaction({ type: 'expense', date: '2026-01-02', amount: 0 })).toThrow()
    expect(() => storage.addTransaction({ type: 'expense', date: '1.01', amount: 5 })).toThrow()
    expect(() => storage.addTransaction({ type: 'gift', date: '2026-01-02', amount: 5 })).toThrow()
  })

  it('filters by month', () => {
    storage.addTransaction({ type: 'expense', date: '2026-01-31', amount: 1 })
    storage.addTransaction({ type: 'expense', date: '2026-02-01', amount: 2 })
    expect(storage.getTransactionsForMonth('2026-01')).toHaveLength(1)
  })

  it('keeps data after a "page reload" (data is in localStorage)', () => {
    storage.addTransaction({ type: 'income', date: '2026-01-09', amount: 19502.52, title: 'salary' })
    const raw = JSON.parse(localStorage.getItem('expense-tracker:v1'))
    expect(raw.transactions).toHaveLength(1)
  })
})

describe('categories & budgets', () => {
  it('seeds default categories only once', () => {
    const defaults = [
      { type: 'expense', name: 'Grocery', emoji: '🥝' },
      { type: 'income', name: 'Salary', emoji: '💼' },
    ]
    storage.ensureDefaultCategories(defaults)
    expect(storage.getCategories()).toHaveLength(2)

    // user deletes everything -> defaults must NOT come back
    storage.getCategories().forEach((c) => storage.deleteCategory(c.id))
    storage.ensureDefaultCategories(defaults)
    expect(storage.getCategories()).toHaveLength(0)
  })

  it('does not allow duplicate names within the same type', () => {
    storage.addCategory({ name: 'Other', type: 'expense' })
    expect(() => storage.addCategory({ name: 'other', type: 'expense' })).toThrow(/already exists/)
    // the same name is fine for income
    expect(() => storage.addCategory({ name: 'Other', type: 'income' })).not.toThrow()
  })

  it('renames a category but not into an existing name', () => {
    const a = storage.addCategory({ name: 'Food', type: 'expense' })
    storage.addCategory({ name: 'Rent', type: 'expense' })
    expect(storage.updateCategory(a.id, { name: 'Grocery', emoji: '🥝' }).name).toBe('Grocery')
    expect(() => storage.updateCategory(a.id, { name: 'Rent' })).toThrow(/already exists/)
    expect(() => storage.updateCategory(a.id, { type: 'income' })).toThrow()
  })

  it('deleting a category un-categorizes its transactions and removes its budgets', () => {
    const cat = storage.addCategory({ name: 'Grocery', emoji: '🥝', type: 'expense' })
    const tx = storage.addTransaction({ type: 'expense', date: '2026-01-02', amount: 10, categoryId: cat.id })
    storage.setBudget(cat.id, '2026-01', 1500)
    expect(storage.getBudgets('2026-01')).toHaveLength(1)

    storage.deleteCategory(cat.id)
    expect(storage.getCategories()).toEqual([])
    expect(storage.getBudgets()).toEqual([])
    expect(storage.getTransactions().find((t) => t.id === tx.id).categoryId).toBeNull()
  })

  it('setBudget replaces the previous value, 0 removes it', () => {
    storage.setBudget('c1', '2026-01', 100)
    storage.setBudget('c1', '2026-01', 200)
    expect(storage.getBudgets('2026-01')).toEqual([{ categoryId: 'c1', month: '2026-01', planned: 200 }])
    storage.setBudget('c1', '2026-01', 0)
    expect(storage.getBudgets('2026-01')).toEqual([])
  })
})

describe('backup / restore', () => {
  it('round-trips data through export/import', () => {
    storage.addTransaction({ type: 'expense', date: '2026-01-02', amount: 5 })
    const backup = storage.exportData()
    storage.clearAll()
    storage.importData(backup)
    expect(storage.getTransactions()).toHaveLength(1)
  })

  it('rejects files that are not backups', () => {
    expect(() => storage.importData('{"hello":1}')).toThrow()
  })
})
