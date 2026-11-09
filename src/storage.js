/**
 * storage.js – the ONLY place in the app that reads or writes data.
 *
 * Right now everything is saved in the browser's localStorage.
 * When the app goes public (v2), only this file needs to be rewritten
 * to talk to a cloud database instead – the rest of the app stays the same.
 *
 * Data model
 * ----------
 * transaction = { id, type: 'income' | 'expense', date: 'YYYY-MM-DD',
 *                 amount: number (PLN, > 0), title: string, categoryId: string }
 * category    = { id, name, emoji, type: 'income' | 'expense', color, excelName? }
 * budget      = { categoryId, month: 'YYYY-MM', planned: number }
 */

const STORAGE_KEY = 'expense-tracker:v1'
const DATA_VERSION = 1

const TYPES = ['income', 'expense']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

function emptyData() {
  return { version: DATA_VERSION, transactions: [], categories: [], budgets: [] }
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ---------- low-level load / save ----------

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    const data = JSON.parse(raw)
    return { ...emptyData(), ...data }
  } catch (err) {
    console.error('Could not read saved data, starting empty.', err)
    return emptyData()
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function update(mutator) {
  const data = load()
  const result = mutator(data)
  save(data)
  return result
}

// ---------- validation ----------

function round2(n) {
  return Math.round(n * 100) / 100
}

function validateTransaction(t) {
  if (!TYPES.includes(t.type)) throw new Error('Type must be "income" or "expense".')
  if (typeof t.date !== 'string' || !DATE_RE.test(t.date)) throw new Error('Date must look like YYYY-MM-DD.')
  const amount = Number(t.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a number greater than 0.')
  return {
    type: t.type,
    date: t.date,
    amount: round2(amount),
    title: String(t.title ?? '').trim(),
    categoryId: t.categoryId ?? null,
  }
}

export const MAX_CATEGORY_NAME_LENGTH = 50

/** Length in visible symbols (an emoji counts as 1, not 2). */
const symbolCount = (s) => [...s].length

function validateCategory(c) {
  const name = String(c.name ?? '').trim()
  if (!name) throw new Error('Category name is required.')
  if (symbolCount(name) > MAX_CATEGORY_NAME_LENGTH) {
    throw new Error(`Category name cannot be longer than ${MAX_CATEGORY_NAME_LENGTH} symbols.`)
  }
  if (!TYPES.includes(c.type)) throw new Error('Category type must be "income" or "expense".')
  const cat = { name, emoji: String(c.emoji ?? '').trim(), type: c.type, color: c.color ?? '#888888' }
  if (c.excelName) cat.excelName = c.excelName
  return cat
}

/** Names must be unique within income or within expenses (case-insensitive). */
function assertUniqueName(categories, cat, ignoreId = null) {
  const clash = categories.find(
    (c) => c.id !== ignoreId && c.type === cat.type && c.name.toLowerCase() === cat.name.toLowerCase(),
  )
  if (clash) throw new Error(`A ${cat.type} category called "${cat.name}" already exists.`)
}

// ---------- transactions ----------

export function getTransactions() {
  return load().transactions
}

/** Transactions whose date falls in the given month ('YYYY-MM'). */
export function getTransactionsForMonth(month) {
  return getTransactions().filter((t) => t.date.startsWith(month))
}

export function addTransaction(input) {
  const tx = { id: newId(), ...validateTransaction(input) }
  update((d) => d.transactions.push(tx))
  return tx
}

export function updateTransaction(id, patch) {
  return update((d) => {
    const i = d.transactions.findIndex((t) => t.id === id)
    if (i === -1) throw new Error(`Transaction ${id} not found.`)
    d.transactions[i] = { id, ...validateTransaction({ ...d.transactions[i], ...patch }) }
    return d.transactions[i]
  })
}

export function deleteTransaction(id) {
  update((d) => {
    d.transactions = d.transactions.filter((t) => t.id !== id)
  })
}

// ---------- categories ----------

export function getCategories() {
  return load().categories
}

/**
 * On the very first run, fill in the default categories.
 * Runs only once – if you later delete categories, they are not re-created.
 */
export function ensureDefaultCategories(defaults) {
  update((d) => {
    if (d.categoriesSeeded) return
    if (d.categories.length === 0) {
      d.categories = defaults.map((c) => ({ id: newId(), ...validateCategory(c) }))
    }
    d.categoriesSeeded = true
  })
}

export function addCategory(input) {
  const cat = { id: newId(), ...validateCategory(input) }
  update((d) => {
    assertUniqueName(d.categories, cat)
    d.categories.push(cat)
  })
  return cat
}

export function updateCategory(id, patch) {
  return update((d) => {
    const i = d.categories.findIndex((c) => c.id === id)
    if (i === -1) throw new Error(`Category ${id} not found.`)
    const next = { id, ...validateCategory({ ...d.categories[i], ...patch }) }
    if (next.type !== d.categories[i].type) throw new Error('A category cannot change between income and expense.')
    assertUniqueName(d.categories, next, id)
    d.categories[i] = next
    return next
  })
}

/** Deleting a category keeps its transactions, they just become "uncategorized". */
export function deleteCategory(id) {
  update((d) => {
    d.categories = d.categories.filter((c) => c.id !== id)
    d.budgets = d.budgets.filter((b) => b.categoryId !== id)
    d.transactions.forEach((t) => {
      if (t.categoryId === id) t.categoryId = null
    })
  })
}

// ---------- budgets ----------

export function getBudgets(month) {
  const all = load().budgets
  return month ? all.filter((b) => b.month === month) : all
}

/** Set the planned amount for a category in a month. planned = 0 removes it. */
export function setBudget(categoryId, month, planned) {
  if (!MONTH_RE.test(month)) throw new Error('Month must look like YYYY-MM.')
  const value = Number(planned)
  if (!Number.isFinite(value) || value < 0) throw new Error('Planned amount must be 0 or more.')
  update((d) => {
    d.budgets = d.budgets.filter((b) => !(b.categoryId === categoryId && b.month === month))
    if (value > 0) d.budgets.push({ categoryId, month, planned: round2(value) })
  })
}

// ---------- backup / restore ----------

export function exportData() {
  return JSON.stringify(load(), null, 2)
}

export function importData(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
    throw new Error('This file does not look like an Expense Tracker backup.')
  }
  save({ ...emptyData(), ...data, version: DATA_VERSION })
}

export function clearAll() {
  localStorage.removeItem(STORAGE_KEY)
}
