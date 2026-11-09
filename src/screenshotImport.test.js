import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseScreenshotText,
  deduplicateTransactions,
} from './screenshotImport.js'
import * as storage from './storage.js'
import { DEFAULT_CATEGORIES } from './defaultCategories.js'

describe('Screenshot Transaction Parser', () => {
  beforeEach(() => {
    storage.clearAll()
    storage.ensureDefaultCategories(DEFAULT_CATEGORIES)
  })

  it('parses standard mobile bank statement transactions with dates, merchants, and signed amounts', () => {
    // Synthetic test snippet modeling Polish mobile bank apps (zero real personal data)
    const ocrText = `
Historia konta
KONTO ZA ZERO 12 (...) 9999
Wszystkie Uznania Obciążenia

24.10.2026
b ODBIORCA PRZELEWU NA TELEFON
PRZELEW NA TELEFON -12,00 PLN

17.10.2026
Zen.com
www.zen.com -1 000,00 PLN

13.10.2026
Zen.com
www.zen.com -2 000,00 PLN

12.10.2026
u TOWARZYSTWO UBEZPIECZENIOWE ABC
NR SZKODY 1234567.0. 1302,94 PLN

= JAN KOWALSKI
= Zlecenie stale -2 000,00 PLN
`
    const parsed = parseScreenshotText(ocrText)
    expect(parsed).toHaveLength(5)

    // 1. Phone transfer expense
    expect(parsed[0].date).toBe('2026-10-24')
    expect(parsed[0].title).toBe('ODBIORCA PRZELEWU NA TELEFON')
    expect(parsed[0].amount).toBe(12)
    expect(parsed[0].type).toBe('expense')
    expect(parsed[0].isTransfer).toBe(true)

    // 2. Zen.com expense 1000
    expect(parsed[1].date).toBe('2026-10-17')
    expect(parsed[1].title).toBe('Zen.com')
    expect(parsed[1].amount).toBe(1000)
    expect(parsed[1].type).toBe('expense')
    expect(parsed[1].isTransfer).toBe(true)

    // 3. Zen.com expense 2000
    expect(parsed[2].date).toBe('2026-10-13')
    expect(parsed[2].amount).toBe(2000)
    expect(parsed[2].type).toBe('expense')

    // 4. Insurance payout (income, positive amount with thousands)
    expect(parsed[3].date).toBe('2026-10-12')
    expect(parsed[3].title).toContain('TOWARZYSTWO UBEZPIECZENIOWE ABC')
    expect(parsed[3].amount).toBe(1302.94)
    expect(parsed[3].type).toBe('income')
    expect(parsed[3].isTransfer).toBe(false)

    // 5. Standing order expense 2000
    expect(parsed[4].date).toBe('2026-10-12')
    expect(parsed[4].title).toBe('JAN KOWALSKI')
    expect(parsed[4].amount).toBe(2000)
    expect(parsed[4].type).toBe('expense')
    expect(parsed[4].isTransfer).toBe(true)
  })

  it('filters out app chrome, status bars, and UI noise', () => {
    const text = `
02:52
Historia konta
Wszystkie Uznania Obciążenia
Znajdź odbiorcę, nadawcę, tytu...
Sprawdź swoje finanse
`
    const parsed = parseScreenshotText(text)
    expect(parsed).toEqual([])
  })

  it('enforces the minimum January 2026 date safeguard', () => {
    const text = `
15.11.2025
STARY SKLEP
-50,00 PLN

10.01.2026
NOWY SKLEP
-75,00 PLN
`
    const parsed = parseScreenshotText(text)
    // 2025 transaction is ignored; 2026 is parsed
    expect(parsed).toHaveLength(1)
    expect(parsed[0].date).toBe('2026-01-10')
    expect(parsed[0].amount).toBe(75)
  })

  it('deduplicates overlapping transactions across multiple screenshots', () => {
    const listA = [
      { date: '2026-10-24', title: 'Coffee Shop', amount: 18.5, type: 'expense' },
      { date: '2026-10-20', title: 'Biedronka', amount: 120.4, type: 'expense' },
    ]

    const listB = [
      { date: '2026-10-20', title: 'Biedronka', amount: 120.4, type: 'expense' }, // duplicate
      { date: '2026-10-15', title: 'Gas Station', amount: 250, type: 'expense' },
    ]

    const { deduplicated, duplicatesRemoved } = deduplicateTransactions([...listA, ...listB])
    expect(deduplicated).toHaveLength(3)
    expect(duplicatesRemoved).toBe(1)
    expect(deduplicated.map((t) => t.title)).toEqual(['Coffee Shop', 'Biedronka', 'Gas Station'])
  })
})
