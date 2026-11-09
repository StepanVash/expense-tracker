/**
 * CSV import: reading a bank/Excel CSV and turning it into transactions.
 *
 * Pipeline:  file bytes -> decodeCsvBuffer -> parseCsv -> findHeaderRow -> detectColumns
 *            -> buildPreview (checks every row) -> applyImport (saves)
 *
 * Everything except applyImport/undoImport is pure (nothing is saved), so it is easy to test.
 * Written with real bank statements in mind: text before the table, "1 Oct 2026" dates,
 * signed amounts, messy descriptions, transfers between your own accounts.
 */
import {
  MIN_DATE,
  addCategory,
  addTransactions,
  deleteCategory,
  deleteTransactions,
  getCategories,
  getTransactions,
} from './storage.js'
import { searchable, suggestCategoryId, suggestCategoryIdFromDescription } from './suggest.js'
import { MERCHANT_RULES, INCOME_RULES } from './merchantRules.js'
import { COLOR_PALETTE } from './defaultCategories.js'

const MAX_TITLE = 100
const MAX_CATEGORY_NAME = 50

/** Example file offered for download so you can see a simple supported layout. */
export const TEMPLATE_CSV =
  'date;amount;title;category;type\n' +
  '2026-01-09;19502,52;salary;Salary;income\n' +
  '2026-01-02;24,35;biedronka;Grocery;expense\n' +
  '2026-01-04;13;parking;Transportation;expense\n'

// ---------------------------------------------------------------- reading the file

/** Polish bank exports are sometimes Windows-1250, not UTF-8: try UTF-8 first, then fall back. */
export function decodeCsvBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let text
  let encoding
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    encoding = 'UTF-8'
  } catch {
    text = new TextDecoder('windows-1250').decode(bytes)
    encoding = 'Windows-1250'
  }
  return { text: text.replace(/^\uFEFF/, ''), encoding }
}

const DELIMITERS = [',', ';', '\t', '|']

/** Count a delimiter in one line, ignoring those inside "quotes". */
function countOutsideQuotes(line, delimiter) {
  let inQuotes = false
  let count = 0
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === delimiter && !inQuotes) count += 1
  }
  return count
}

/**
 * Pick the delimiter that splits the most lines into the same number (2+) of columns.
 * Looks at many lines, so text before the table (which has few commas) doesn't confuse it.
 */
export function detectDelimiter(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim()).slice(0, 80)
  let best = ','
  let bestScore = 0
  for (const d of DELIMITERS) {
    const freq = new Map()
    for (const l of lines) {
      const c = countOutsideQuotes(l, d)
      if (c >= 2 || (c === 1 && lines.length <= 3)) freq.set(c, (freq.get(c) ?? 0) + 1)
    }
    for (const [count, lineCount] of freq) {
      const score = lineCount * 1000 + count
      if (score > bestScore) {
        best = d
        bestScore = score
      }
    }
  }
  return best
}

/** Parse CSV text (handles "quoted, fields", "" escapes, line breaks inside quotes). */
export function parseCsv(text, delimiter = detectDelimiter(text)) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  return {
    delimiter,
    rows: rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== '')),
  }
}

// ---------------------------------------------------------------- cell parsers

const pad = (n) => String(n).padStart(2, '0')

function normalizeText(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
}

/** For comparing category names: "🥝 Grocery", "grocery" and "GROCERY!" are all the same. */
function normalizeName(s) {
  return normalizeText(s).replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()
}

// first three letters of English and Polish month names
const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  sty: 1, lut: 2, kwi: 4, maj: 5, cze: 6, lip: 7, sie: 8, wrz: 9, paz: 10, lis: 11, gru: 12,
}
const monthFromName = (word) => MONTHS[normalizeText(word).replace(/[^a-z]/g, '').slice(0, 3)] ?? null

/**
 * Understands 2026-01-09, 09.01.2026, 9/1/2026, 09-01-26, 1 Oct 2026, 1 października 2026,
 * Oct 1, 2026 (a time part is ignored). Day-first is assumed for dd/mm/yyyy.
 * @returns 'YYYY-MM-DD' or null
 */
export function parseDate(input) {
  const s = String(input ?? '').trim()
  if (!s) return null
  let y, m, d
  let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/)
  if (match) {
    y = match[1]
    m = match[2]
    d = match[3]
  } else if ((match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:[T\s].*)?$/))) {
    d = match[1]
    m = match[2]
    y = match[3].length === 2 ? `20${match[3]}` : match[3]
  } else if ((match = s.match(/^(\d{1,2})[\s./-]+([^\d\s./,-]+)\.?[\s./,-]+(\d{4})(?:\D.*)?$/u))) {
    d = match[1]
    m = monthFromName(match[2])
    y = match[3]
  } else if ((match = s.match(/^([^\d\s./,-]+)\.?\s+(\d{1,2}),?\s+(\d{4})(?:\D.*)?$/u))) {
    m = monthFromName(match[1])
    d = match[2]
    y = match[3]
  } else {
    return null
  }
  if (!m) return null
  y = Number(y)
  m = Number(m)
  d = Number(d)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

/**
 * Understands 24.35, 24,35, 1 234,56, 1,234.56, -24.35, (24.35), 24,35 PLN, 24.35zł.
 * @returns a number (negative for minus / brackets) or null if it is not an amount
 */
export function parseAmount(input) {
  let s = String(input ?? '').trim()
  if (!s) return null

  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[\s\u00a0]/g, '').replace(/pln|zł|zl|eur|usd|gbp|€|\$|£/gi, '')
  if (/^[-\u2212]/.test(s)) {
    negative = true
    s = s.slice(1)
  } else if (/[-\u2212]$/.test(s)) {
    negative = true
    s = s.slice(0, -1)
  }
  s = s.replace(/^\+/, '')
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null

  const commas = (s.match(/,/g) || []).length
  const dots = (s.match(/\./g) || []).length
  const thousands = /^\d{1,3}([.,]\d{3})+$/

  if (commas && dots) {
    // the separator that comes last is the decimal one
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (commas > 1) {
    if (!thousands.test(s)) return null
    s = s.replace(/,/g, '')
  } else if (commas === 1) {
    s = s.replace(',', '.')
  } else if (dots > 1) {
    if (!thousands.test(s)) return null // e.g. 09.01.2026 is a date, not an amount
    s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n * 100) / 100
  return negative ? -rounded : rounded
}

function parseTypeCell(value) {
  const s = normalizeText(value).trim()
  if (!s) return null
  if (/income|incoming|przych|wplyw|wplat|credit|uznanie|^in$|^\+$/.test(s)) return 'income'
  if (/expense|outgoing|wydat|koszt|debit|obciazenie|zakup|^out$|^-$/.test(s)) return 'expense'
  return null
}

/**
 * Tidy a bank description for use as a title:
 * "JMP S.A. BIEDRONKA 151 KRAKOW,POL CARD: MASTERCARD *6408" -> "JMP S.A. BIEDRONKA 151 KRAKOW"
 */
export function cleanDescription(text) {
  return String(text ?? '')
    .replace(/,?\s*CARD:\s*\S+\s*\*\d+/gi, '') // card number tail
    .replace(/\b[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, '') // reference ids
    .replace(/\b\d{10,}\b/g, '') // long numbers (account numbers)
    .replace(/[,\s]+(?:PL|POL|PLN)\s*$/i, '') // trailing country code
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
}

// ---------------------------------------------------------------- finding the table

/** Which column title looks like which field? */
const SYNONYMS = {
  date: ['date', 'data', 'dzien', 'day', 'booking', 'posted', 'data operacji', 'data ksiegowania', 'data transakcji'],
  amount: ['settlement amount', 'amount', 'kwota', 'value', 'wartosc', 'suma', 'sum', 'total', 'price', 'cena'],
  currency: ['settlement currency', 'currency', 'waluta'],
  category: ['category', 'kategoria', 'cat'],
  type: ['transaction type', 'type', 'typ', 'rodzaj', 'kind'],
  title: [
    'description', 'title', 'desc', 'opis', 'tytul', 'name', 'nazwa', 'details', 'szczegoly',
    'merchant', 'payee', 'odbiorca', 'kontrahent', 'memo', 'note', 'notes',
  ],
}
// category/type before title, so that "Category name" is not mistaken for the title
const FIELD_ORDER = ['date', 'amount', 'currency', 'category', 'type', 'title']
// columns that contain "amount" but are not the amount of the transaction
const NOT_THE_AMOUNT = /\b(fee|balance|saldo|original|rate|kurs|currency|waluta|prowizja|commission)\b/

function headerScore(header, field) {
  const h = ` ${normalizeText(header).replace(/[^a-z0-9]+/g, ' ').trim()} `
  if (field === 'amount' && NOT_THE_AMOUNT.test(h) && !h.includes(' settlement ')) return 0
  let best = 0
  for (const syn of SYNONYMS[field]) {
    if (h === ` ${syn} `) best = Math.max(best, 3)
    else if (h.includes(` ${syn} `)) best = Math.max(best, 2)
  }
  return best
}

/** True when a row of cells looks like column titles (no dates or numbers in it). */
export function looksLikeHeader(row) {
  return !row.some((c) => parseDate(c) || (/\d/.test(c) && parseAmount(c) !== null))
}

/**
 * Bank statements often have text (owner, balances...) before the table.
 * @returns index of the row holding the column titles (needs a date AND an amount column),
 *          or -1 if the file has no header row
 */
export function findHeaderRow(rows) {
  const limit = Math.min(rows.length, 80)
  for (let i = 0; i < limit; i++) {
    const row = rows[i]
    if (row.length < 3) continue
    const hasDate = row.some((c) => headerScore(c, 'date') > 0)
    const hasAmount = row.some((c) => headerScore(c, 'amount') > 0)
    if (hasDate && hasAmount) return i
  }
  return rows.length && looksLikeHeader(rows[0]) && rows[0].length >= 2 ? 0 : -1
}

/** Name of the account owner, if the text before the table says so (used to spot own transfers). */
export function extractOwnerName(preambleRows) {
  const labels = ['account owner', 'account holder', 'owner', 'wlasciciel rachunku', 'wlasciciel']
  for (let i = 0; i < preambleRows.length - 1; i++) {
    const label = normalizeText(preambleRows[i][0]).replace(/[^a-z ]/g, '').trim()
    if (labels.includes(label)) {
      const name = (preambleRows[i + 1][0] ?? '').trim()
      if (name.length >= 3) return name
    }
  }
  return ''
}

/** Rows after the header, without footers and other lines that aren't table rows. */
export function tableRows(rows, headerIndex) {
  return rows.slice(headerIndex + 1).filter((r) => r.filter((c) => c !== '').length >= 2)
}

const sample = (dataRows, idx) =>
  dataRows.slice(0, 30).map((r) => r[idx] ?? '').filter((v) => v.trim() !== '')
const ratio = (values, test) => (values.length ? values.filter(test).length / values.length : 0)

/**
 * Guess which column is which: first by the column titles (English/Polish), then by the values.
 * @returns { date, amount, currency, title, category, type } – column indexes, -1 = none
 */
export function detectColumns(headers, dataRows) {
  const mapping = { date: -1, amount: -1, currency: -1, title: -1, category: -1, type: -1 }
  const used = new Set()

  for (const field of FIELD_ORDER) {
    let best = -1
    let bestScore = 0
    headers.forEach((h, i) => {
      if (used.has(i)) return
      const score = headerScore(h, field)
      if (score > bestScore) {
        best = i
        bestScore = score
      }
    })
    if (best !== -1) {
      mapping[field] = best
      used.add(best)
    }
  }

  const free = () => headers.map((_, i) => i).filter((i) => !used.has(i))

  if (mapping.date === -1) {
    const i = free().find((c) => ratio(sample(dataRows, c), (v) => parseDate(v)) >= 0.6)
    if (i !== undefined) {
      mapping.date = i
      used.add(i)
    }
  }
  if (mapping.amount === -1) {
    const i = free().find(
      (c) =>
        ratio(sample(dataRows, c), (v) => parseDate(v)) < 0.6 &&
        ratio(sample(dataRows, c), (v) => parseAmount(v) !== null) >= 0.6,
    )
    if (i !== undefined) {
      mapping.amount = i
      used.add(i)
    }
  }
  if (mapping.title === -1) {
    let best = -1
    let bestLen = 0
    for (const c of free()) {
      const values = sample(dataRows, c)
      const texty = ratio(values, (v) => parseDate(v) === null && parseAmount(v) === null)
      const avg = values.length ? values.reduce((s, v) => s + v.length, 0) / values.length : 0
      if (texty >= 0.6 && avg > bestLen) {
        best = c
        bestLen = avg
      }
    }
    if (best !== -1) mapping.title = best
  }
  return mapping
}

/** 'sign' if the file has negative amounts (− = expense, + = income), otherwise 'expense'. */
export function guessAmountMode(dataRows, amountIdx) {
  if (amountIdx < 0) return 'expense'
  return dataRows.some((r) => (parseAmount(r[amountIdx]) ?? 0) < 0) ? 'sign' : 'expense'
}

// ---------------------------------------------------------------- checking every row

/** Merchant-name guess ("biedronka" -> Grocery). The longest matching word wins. */
function categoryFromRules(text, type, categories) {
  const hay = ` ${searchable(text)} `
  let best = null
  for (const rule of type === 'income' ? INCOME_RULES : MERCHANT_RULES) {
    for (const w of rule.words) {
      const word = searchable(w)
      if (!word) continue
      // short words must be whole words ("pub" must not match "public")
      const hit = word.length <= 4 ? hay.includes(` ${word} `) : hay.includes(` ${word}`)
      if (hit && (!best || word.length > best.len)) best = { len: word.length, category: rule.category }
    }
  }
  if (!best) return null
  const wanted = normalizeName(best.category)
  return categories.find((c) => c.type === type && normalizeName(c.name) === wanted)?.id ?? null
}

/** Is this line a movement between your own accounts rather than income or spending? */
function looksLikeOwnTransfer({ type, text, ownerName }) {
  const s = searchable(text)
  if (/\b(exchange|currency exchange|wymiana walut|own account|between accounts|przelew wlasny)\b/.test(s)) return true
  if (type === 'income' && /\b(top ?up|topup|doladowanie)\b/.test(s)) return true
  const owner = searchable(ownerName)
  return owner.length >= 5 && ` ${s} `.includes(` ${owner} `)
}

/**
 * Turn rows into import items and decide what happens to each one.
 *
 * item.status: 'ok'        will be imported
 *              'duplicate' the same transaction is already in the app
 *              'transfer'  looks like a move between your own accounts (off by default)
 *              'error'     cannot be imported (reason says why)
 *
 * @param {object}     p
 * @param {string[][]} p.rows         table rows (header already removed)
 * @param {object}     p.mapping      from detectColumns
 * @param {object}     p.options      { amountMode: 'sign'|'expense'|'income', createCategories: boolean }
 * @param {object[]}   p.categories   existing categories
 * @param {object[]}   p.transactions existing transactions (duplicates, suggestions)
 * @param {number}     p.firstRowNumber  number shown for the first row
 * @param {string}     p.ownerName    account owner, if known
 */
export function buildPreview({
  rows,
  mapping,
  options,
  categories,
  transactions,
  firstRowNumber = 1,
  ownerName = '',
}) {
  const { amountMode = 'sign', createCategories = true } = options

  // how many identical transactions already exist (a file may legitimately repeat a row)
  const existing = new Map()
  const keyOf = (type, date, amount, title) => `${type}|${date}|${amount.toFixed(2)}|${title.toLowerCase()}`
  for (const t of transactions) {
    const k = keyOf(t.type, t.date, t.amount, t.title ?? '')
    existing.set(k, (existing.get(k) ?? 0) + 1)
  }

  return rows.map((row, i) => {
    const cell = (col) => (col >= 0 ? (row[col] ?? '') : '')
    const rawTitle = cell(mapping.title)
    const item = {
      rowNumber: firstRowNumber + i,
      date: null,
      amount: null,
      type: null,
      title: cleanDescription(rawTitle).slice(0, MAX_TITLE),
      rawTitle,
      categoryId: null,
      newCategoryName: null,
      categoryNote: '',
      status: 'ok',
      reason: '',
    }
    const fail = (reason) => ({ ...item, status: 'error', reason })

    // --- date
    const rawDate = cell(mapping.date)
    item.date = parseDate(rawDate)
    if (!item.date) return fail(rawDate ? `Unreadable date "${rawDate}"` : 'Missing date')
    if (item.date < MIN_DATE) return fail('Date is earlier than January 2026')

    // --- amount (and currency: the app is PLN only)
    const rawAmount = cell(mapping.amount)
    const signed = parseAmount(rawAmount)
    if (signed === null) return fail(rawAmount ? `Unreadable amount "${rawAmount}"` : 'Missing amount')
    if (signed === 0) return fail('Amount is 0')
    const currency = cell(mapping.currency).trim().toUpperCase()
    if (currency && currency !== 'PLN') return fail(`Currency ${currency} is not supported (PLN only)`)
    item.amount = Math.abs(signed)

    // --- income or expense
    const typeCell = cell(mapping.type)
    const typeFromColumn = mapping.type >= 0 ? parseTypeCell(typeCell) : null
    if (typeFromColumn) item.type = typeFromColumn
    else if (amountMode === 'income') item.type = 'income'
    else if (amountMode === 'expense') item.type = 'expense'
    else item.type = signed < 0 ? 'expense' : 'income'

    // --- category: from the file, else learned from your history, else merchant rules
    const rawCategory = cell(mapping.category).trim()
    if (rawCategory) {
      const n = normalizeName(rawCategory)
      const pool = categories.filter((c) => c.type === item.type)
      const found =
        pool.find((c) => normalizeName(c.name) === n) ??
        pool.find((c) => c.excelName && normalizeName(c.excelName) === n)
      if (found) item.categoryId = found.id
      else if (createCategories) item.newCategoryName = rawCategory.slice(0, MAX_CATEGORY_NAME)
      else item.categoryNote = `Unknown category "${rawCategory}"`
    } else {
      item.categoryId =
        suggestCategoryId(item.title, transactions, item.type, categories) ??
        suggestCategoryIdFromDescription(rawTitle, transactions, item.type, categories) ??
        categoryFromRules(rawTitle, item.type, categories)
    }

    // --- transfers between your own accounts
    if (looksLikeOwnTransfer({ type: item.type, text: `${typeCell} ${rawTitle}`, ownerName })) {
      return { ...item, status: 'transfer', reason: 'Looks like a transfer between your own accounts' }
    }

    // --- duplicates
    const key = keyOf(item.type, item.date, item.amount, item.title)
    const left = existing.get(key) ?? 0
    if (left > 0) {
      existing.set(key, left - 1)
      return { ...item, status: 'duplicate', reason: 'Already in the app' }
    }
    return item
  })
}

/** Row numbers that are ticked by default: everything that is simply 'ok'. */
export function defaultSelection(items) {
  return new Set(items.filter((i) => i.status === 'ok').map((i) => i.rowNumber))
}

/** Totals for the preview header. `selected` is a Set of row numbers. */
export function summarize(items, selected) {
  const chosen = items.filter((i) => selected.has(i.rowNumber) && i.status !== 'error')
  const byMonth = new Map()
  for (const i of chosen) {
    const m = i.date.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1)
  }
  const newCats = new Set(chosen.filter((i) => i.newCategoryName).map((i) => `${i.type}:${i.newCategoryName.toLowerCase()}`))
  return {
    toImport: chosen.length,
    duplicates: items.filter((i) => i.status === 'duplicate').length,
    transfers: items.filter((i) => i.status === 'transfer').length,
    errors: items.filter((i) => i.status === 'error').length,
    income: chosen.filter((i) => i.type === 'income').reduce((s, i) => s + i.amount, 0),
    expenses: chosen.filter((i) => i.type === 'expense').reduce((s, i) => s + i.amount, 0),
    uncategorized: chosen.filter((i) => !i.categoryId && !i.newCategoryName).length,
    newCategories: newCats.size,
    byMonth: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
  }
}

// ---------------------------------------------------------------- saving (and undoing)

/**
 * Save the selected items. Categories that don't exist yet are created first.
 * @returns what was created, so it can be undone: { transactionIds, categoryIds, summary }
 */
export function applyImport(items, selected) {
  const chosen = items.filter((i) => selected.has(i.rowNumber) && i.status !== 'error')
  const summary = summarize(items, selected)

  const categoryIds = []
  const idByNew = new Map()
  const known = getCategories()
  const newKey = (i) => `${i.type}|${i.newCategoryName.toLowerCase()}`

  for (const item of chosen) {
    if (!item.newCategoryName || idByNew.has(newKey(item))) continue
    const same = known.find(
      (c) => c.type === item.type && c.name.toLowerCase() === item.newCategoryName.toLowerCase(),
    )
    if (same) {
      idByNew.set(newKey(item), same.id)
      continue
    }
    const created = addCategory({
      name: item.newCategoryName,
      type: item.type,
      emoji: '',
      color: COLOR_PALETTE[(known.length + categoryIds.length) % COLOR_PALETTE.length],
    })
    categoryIds.push(created.id)
    idByNew.set(newKey(item), created.id)
  }

  const created = addTransactions(
    chosen.map((i) => ({
      type: i.type,
      date: i.date,
      amount: i.amount,
      title: i.title,
      categoryId: i.newCategoryName ? idByNew.get(newKey(i)) : i.categoryId,
    })),
  )
  return { transactionIds: created.map((t) => t.id), categoryIds, summary }
}

/** Remove what an import added. Categories it created are kept if something else uses them now. */
export function undoImport({ transactionIds, categoryIds }) {
  deleteTransactions(transactionIds)
  const stillUsed = new Set(getTransactions().map((t) => t.categoryId))
  categoryIds.filter((id) => !stillUsed.has(id)).forEach((id) => deleteCategory(id))
}
