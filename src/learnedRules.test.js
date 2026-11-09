import { describe, it, expect } from 'vitest'
import { extractCoreMerchantPattern, matchLearnedRule } from './learnedRules.js'

describe('extractCoreMerchantPattern', () => {
  it('extracts core merchant name ignoring legal company noise and store numbers', () => {
    expect(extractCoreMerchantPattern('JMP S.A. BIEDRONKA 151 KRAKOW')).toBe('biedronka')
    expect(extractCoreMerchantPattern('PODWAWELSKA SKLEP NR 9 Krakow')).toBe('podwawelska')
    expect(extractCoreMerchantPattern('PPHU MARKAM 09 KRAKOW')).toBe('markam')
    expect(extractCoreMerchantPattern('AWITEKS SPOLKA Z O.O.S KRAKOW')).toBe('awiteks')
    expect(extractCoreMerchantPattern('F. H. U. ANGEL KRAKOW')).toBe('angel')
  })
})

describe('matchLearnedRule', () => {
  const categories = [
    { id: 'cat-grocery', name: 'Grocery', type: 'expense' },
    { id: 'cat-cafe', name: 'Cafe & Entertainment', type: 'expense' },
    { id: 'cat-salary', name: 'Salary', type: 'income' },
  ]

  it('matches exact pattern', () => {
    const rules = [{ pattern: 'custom merchant store', categoryId: 'cat-cafe', type: 'expense' }]
    expect(matchLearnedRule('custom merchant store', rules, 'expense', categories)).toBe('cat-cafe')
  })

  it('matches substring or core merchant even with different store number or location', () => {
    const rules = [{ pattern: 'podwawelska', categoryId: 'cat-grocery', type: 'expense' }]
    expect(matchLearnedRule('PODWAWELSKA SKLEP NR 9 Krakow', rules, 'expense', categories)).toBe('cat-grocery')
    expect(matchLearnedRule('PODWAWELSKA SKLEP NR 12 Warszawa', rules, 'expense', categories)).toBe('cat-grocery')
  })

  it('respects transaction type (income vs expense)', () => {
    const rules = [{ pattern: 'bonus', categoryId: 'cat-salary', type: 'income' }]
    expect(matchLearnedRule('company bonus payment', rules, 'expense', categories)).toBeNull()
    expect(matchLearnedRule('company bonus payment', rules, 'income', categories)).toBe('cat-salary')
  })

  it('ignores rules whose category was deleted or does not exist', () => {
    const rules = [{ pattern: 'ghost store', categoryId: 'cat-deleted', type: 'expense' }]
    expect(matchLearnedRule('ghost store', rules, 'expense', categories)).toBeNull()
  })
})
