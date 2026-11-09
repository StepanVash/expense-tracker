import { describe, it, expect } from 'vitest'
import { suggestCategoryId } from './suggest.js'

const categories = [
  { id: 'grocery', type: 'expense', name: 'Grocery' },
  { id: 'coffee', type: 'expense', name: 'Coffee' },
  { id: 'salary', type: 'income', name: 'Salary' },
]
const tx = (title, categoryId, date = '2026-01-10', type = 'expense') => ({
  id: title + date + categoryId, type, date, amount: 1, title, categoryId,
})

describe('suggestCategoryId', () => {
  it('returns null when there is no history or the text is too short', () => {
    expect(suggestCategoryId('biedronka', [], 'expense', categories)).toBeNull()
    expect(suggestCategoryId('b', [tx('biedronka', 'grocery')], 'expense', categories)).toBeNull()
    expect(suggestCategoryId('', [tx('biedronka', 'grocery')], 'expense', categories)).toBeNull()
  })

  it('suggests the category used before for the same title (case-insensitive)', () => {
    const past = [tx('biedronka', 'grocery')]
    expect(suggestCategoryId('Biedronka', past, 'expense', categories)).toBe('grocery')
    expect(suggestCategoryId('  biedronka ', past, 'expense', categories)).toBe('grocery')
  })

  it('picks the most frequent category for a title', () => {
    const past = [tx('coffe', 'coffee'), tx('coffe', 'coffee'), tx('coffe', 'grocery')]
    expect(suggestCategoryId('coffe', past, 'expense', categories)).toBe('coffee')
  })

  it('on a tie picks the most recent one', () => {
    const past = [tx('shop', 'grocery', '2026-01-01'), tx('shop', 'coffee', '2026-01-20')]
    expect(suggestCategoryId('shop', past, 'expense', categories)).toBe('coffee')
  })

  it('matches while typing (prefix) and longer titles that start with a known one', () => {
    const past = [tx('biedronka', 'grocery')]
    expect(suggestCategoryId('bied', past, 'expense', categories)).toBe('grocery')
    expect(suggestCategoryId('biedronka krakow', past, 'expense', categories)).toBe('grocery')
    expect(suggestCategoryId('lidl', past, 'expense', categories)).toBeNull()
  })

  it('only looks at transactions of the same type', () => {
    const past = [tx('salary', 'salary', '2026-01-09', 'income')]
    expect(suggestCategoryId('salary', past, 'expense', categories)).toBeNull()
    expect(suggestCategoryId('salary', past, 'income', categories)).toBe('salary')
  })

  it('ignores categories that no longer exist', () => {
    const past = [tx('old shop', 'deleted-category')]
    expect(suggestCategoryId('old shop', past, 'expense', categories)).toBeNull()
  })
})
