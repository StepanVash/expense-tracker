import { describe, it, expect } from 'vitest'
import { formatMoney, formatMonth, currentMonth, shiftMonth } from './format.js'

describe('formatMonth', () => {
  it('formats YYYY-MM as a readable month', () => {
    expect(formatMonth('2026-01')).toBe('January 2026')
    expect(formatMonth('2026-12')).toBe('December 2026')
  })
})

describe('currentMonth', () => {
  it('returns YYYY-MM with a zero-padded month', () => {
    expect(currentMonth(new Date(2026, 0, 15))).toBe('2026-01')
    expect(currentMonth(new Date(2026, 10, 9))).toBe('2026-11')
  })
})

describe('shiftMonth', () => {
  it('moves forward and back', () => {
    expect(shiftMonth('2026-05', 1)).toBe('2026-06')
    expect(shiftMonth('2026-05', -1)).toBe('2026-04')
  })

  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-01', -13)).toBe('2024-12')
  })
})

describe('formatMoney', () => {
  it('formats amounts in PLN', () => {
    expect(formatMoney(1234.5).replace(/\s/g, ' ')).toBe('1234,50 zł')
  })

  it('groups thousands from 5 digits up (Polish convention)', () => {
    expect(formatMoney(30867.52).replace(/\s/g, ' ')).toBe('30 867,52 zł')
  })

  it('treats missing values as zero', () => {
    expect(formatMoney(undefined)).toContain('0,00')
  })
})
