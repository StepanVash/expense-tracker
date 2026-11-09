import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseDate,
  parseAmount,
  cleanDescription,
  detectDelimiter,
  parseCsv,
  findHeaderRow,
  detectColumns,
  extractOwnerName,
  tableRows,
  buildPreview,
  summarize,
  applyImport,
  undoImport,
} from './csvImport.js'
import * as storage from './storage.js'
import { DEFAULT_CATEGORIES } from './defaultCategories.js'

describe('csvImport unit helpers', () => {
  it('parses diverse date formats', () => {
    expect(parseDate('2026-01-09')).toBe('2026-01-09')
    expect(parseDate('09.01.2026')).toBe('2026-01-09')
    expect(parseDate('1 Oct 2026')).toBe('2026-10-01')
    expect(parseDate('15 Oct 2026 12:34:56')).toBe('2026-10-15')
    expect(parseDate('31 paź 2026')).toBe('2026-10-31')
    expect(parseDate('invalid-date')).toBeNull()
  })

  it('parses diverse amounts and signs', () => {
    expect(parseAmount('500.00')).toBe(500)
    expect(parseAmount('-75.72')).toBe(-75.72)
    expect(parseAmount('1 234,56 PLN')).toBe(1234.56)
    expect(parseAmount('(45.50)')).toBe(-45.5)
    expect(parseAmount('-45,00 zł')).toBe(-45)
    expect(parseAmount('0.00')).toBe(0)
    expect(parseAmount('abc')).toBeNull()
  })

  it('cleans bank card payment descriptions', () => {
    const raw = 'JMP S.A. BIEDRONKA 000 WARSZAWA,POL CARD: MASTERCARD *0000'
    expect(cleanDescription(raw)).toBe('JMP S.A. BIEDRONKA 000 WARSZAWA')
  })

  it('detects delimiter correctly', () => {
    expect(detectDelimiter('a,b,c\n1,2,3\n4,5,6')).toBe(',')
    expect(detectDelimiter('a;b;c\n1;2;3\n4;5;6')).toBe(';')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
  })
})

describe('Bank statement CSV parsing with synthetic test data', () => {
  const sampleBankCsv = `PLN – Account Statement
Generated: 1 Nov 2026
Date: 1 Oct 2026 to 31 Oct 2026

Account owner
JAN KOWALSKI
Ulica Przykładowa 10
00-001 Warszawa
Poland

Total income:,1000.00,PLN
Opening balance:,100.00,PLN
Total outcome:,-500.00,PLN
Closing balance:,600.00,PLN

Transactions:
Date,Transaction type,Description,Settlement amount,Settlement currency,Original amount,Original currency,Currency rate,Fee description,Fee amount,Fee currency,Balance
1 Oct 2026,Incoming transfer,"FINTECH BANK,   Account top-up ",100.00,PLN,100.00,PLN,1.000000,,,,200.00
1 Oct 2026,Incoming transfer,"JAN KOWALSKI, ULICA PRZYKLADOWA 10 WARSZAWA PL PERSONAL NEEDS PL00000000000000000000000000",200.00,PLN,200.00,PLN,,,,,400.00
2 Oct 2026,Card payment,"PODWAWELSKA SKLEP NR 1 Warszawa,POL CARD: MASTERCARD *0000",-5.00,PLN,-5.00,PLN,1.000000,,,,395.00
2 Oct 2026,Incoming transfer,"REWARD ZONE,   Cashback Moneyback ",10.00,PLN,10.00,PLN,1.000000,,,,405.00
3 Oct 2026,Card payment,"JMP S.A. BIEDRONKA 000 WARSZAWA,POL CARD: MASTERCARD *0000",-100.00,PLN,-100.00,PLN,1.000000,,,,305.00
6 Oct 2026,Card payment,"HYPEROIL WARSZAWA,POL CARD: MASTERCARD *0000",-80.00,PLN,-80.00,PLN,1.000000,,,,225.00
27 Oct 2026,Exchange money,Currency exchange from PLN to EUR,-50.00,PLN,-10.00,EUR,0.200000,,,,175.00
28 Oct 2026,Card payment,"McDonalds 00000000 Warszawa,POL CARD: MASTERCARD *0000",-40.00,PLN,-40.00,PLN,1.000000,,,,135.00
`

  beforeEach(() => {
    storage.clearAll()
    storage.ensureDefaultCategories(DEFAULT_CATEGORIES)
  })

  it('detects header and columns from bank CSV format', () => {
    const { rows } = parseCsv(sampleBankCsv, ',')
    const headerIdx = findHeaderRow(rows)
    expect(headerIdx).toBeGreaterThan(0)
    expect(rows[headerIdx][0]).toBe('Date')

    const owner = extractOwnerName(rows.slice(0, headerIdx))
    expect(owner).toContain('JAN KOWALSKI')

    const data = tableRows(rows, headerIdx)
    const mapping = detectColumns(rows[headerIdx], data)
    expect(mapping.date).toBe(0)
    expect(mapping.type).toBe(1)
    expect(mapping.title).toBe(2)
    expect(mapping.amount).toBe(3)
  })

  it('builds preview with smart categorisation, transfers detection, and auto-mapping', () => {
    const { rows } = parseCsv(sampleBankCsv, ',')
    const headerIdx = findHeaderRow(rows)
    const owner = extractOwnerName(rows.slice(0, headerIdx))
    const data = tableRows(rows, headerIdx)
    const mapping = detectColumns(rows[headerIdx], data)
    const categories = storage.getCategories()
    const transactions = storage.getTransactions()

    const preview = buildPreview({
      rows: data,
      mapping,
      options: { amountMode: 'sign', createCategories: true },
      categories,
      transactions,
      firstRowNumber: headerIdx + 2,
      ownerName: owner,
    })

    expect(preview).toHaveLength(8)

    // Biedronka -> Grocery
    const biedronka = preview.find((p) => p.title.includes('BIEDRONKA'))
    expect(biedronka.status).toBe('ok')
    expect(biedronka.type).toBe('expense')
    expect(biedronka.amount).toBe(100.00)
    const groceryCat = categories.find((c) => c.name === 'Grocery')
    expect(biedronka.categoryId).toBe(groceryCat.id)

    // McDonalds -> Cafe & Entertainment
    const mcdonalds = preview.find((p) => p.title.toLowerCase().includes('mcdonald'))
    const cafeCat = categories.find((c) => c.name.includes('Cafe'))
    expect(mcdonalds.categoryId).toBe(cafeCat.id)

    // Hyperoil -> Transportation
    const hyperoil = preview.find((p) => p.title.includes('HYPEROIL'))
    const transportCat = categories.find((c) => c.name === 'Transportation')
    expect(hyperoil.categoryId).toBe(transportCat.id)

    // Account top-up and exchange money -> detected as transfer
    const topup = preview.find((p) => p.title.includes('top-up'))
    expect(topup.status).toBe('transfer')

    const exchange = preview.find((p) => p.title.includes('Currency exchange'))
    expect(exchange.status).toBe('transfer')

    // Reward moneyback -> income (Other income)
    const moneyback = preview.find((p) => p.title.includes('Moneyback'))
    expect(moneyback.type).toBe('income')
    const otherIncomeCat = categories.find((c) => c.name === 'Other income')
    expect(moneyback.categoryId).toBe(otherIncomeCat.id)
  })

  it('applies import and allows undoing it', () => {
    const { rows } = parseCsv(sampleBankCsv, ',')
    const headerIdx = findHeaderRow(rows)
    const data = tableRows(rows, headerIdx)
    const mapping = detectColumns(rows[headerIdx], data)
    const categories = storage.getCategories()

    const preview = buildPreview({
      rows: data,
      mapping,
      options: { amountMode: 'sign', createCategories: true },
      categories,
      transactions: [],
      firstRowNumber: headerIdx + 2,
    })

    // Import only 'ok' items (excluding transfers by default)
    const selected = new Set(preview.filter((p) => p.status === 'ok').map((p) => p.rowNumber))
    const summary = summarize(preview, selected)
    expect(summary.toImport).toBeGreaterThan(0)

    const result = applyImport(preview, selected)
    expect(storage.getTransactions().length).toBe(summary.toImport)

    // Undo import
    undoImport(result)
    expect(storage.getTransactions()).toHaveLength(0)
  })

  it('remembers user selected category for a merchant and automatically parses next CSVs with it', () => {
    const categories = storage.getCategories()
    const cafeCat = categories.find((c) => c.name.includes('Cafe'))

    // 1st CSV has an unknown custom merchant
    const firstCsv = `Date,Description,Amount\n01.10.2026,MY SPECIAL ARTISAN BAKERY 01,-25.00`
    const { rows: firstRows } = parseCsv(firstCsv, ',')
    const firstMapping = detectColumns(firstRows[0], firstRows.slice(1))

    const firstPreview = buildPreview({
      rows: firstRows.slice(1),
      mapping: firstMapping,
      options: { amountMode: 'sign', createCategories: true },
      categories,
      transactions: [],
    })

    // Initially uncategorized
    expect(firstPreview[0].categoryId).toBeNull()

    // User chooses "Cafe & Entertainment" for this record
    firstPreview[0].categoryId = cafeCat.id

    // User imports it
    applyImport(firstPreview, new Set([firstPreview[0].rowNumber]))

    // Check that learned rule was saved
    const learned = storage.getLearnedRules()
    expect(learned.length).toBeGreaterThan(0)

    // 2nd CSV later has the same merchant with a different branch or date
    const secondCsv = `Date,Description,Amount\n15.11.2026,MY SPECIAL ARTISAN BAKERY 02 BRANCH B,-30.00`
    const { rows: secondRows } = parseCsv(secondCsv, ',')
    const secondMapping = detectColumns(secondRows[0], secondRows.slice(1))

    const secondPreview = buildPreview({
      rows: secondRows.slice(1),
      mapping: secondMapping,
      options: { amountMode: 'sign', createCategories: true },
      categories,
      transactions: storage.getTransactions(),
    })

    // Automatically categorized using the remembered rule!
    expect(secondPreview[0].categoryId).toBe(cafeCat.id)
  })
})
