import { describe, it, expect } from 'vitest'
import { DEFAULT_CATEGORIES } from './defaultCategories.js'

describe('default categories', () => {
  it('have unique names within each type', () => {
    for (const type of ['income', 'expense']) {
      const names = DEFAULT_CATEGORIES.filter((c) => c.type === type).map((c) => c.name.toLowerCase())
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('have unique emojis', () => {
    const emojis = DEFAULT_CATEGORIES.map((c) => c.emoji)
    expect(new Set(emojis).size).toBe(emojis.length)
  })

  it('cover every category used in the Excel file', () => {
    const excelExpense = [
      'Rent', 'Grocery', 'Cafe + Entertainment', 'Transportation', 'Shopping', 'Banking',
      'Maks free time', 'Utility Lviv', 'Personal', 'Insurance', 'Phone', 'Gym', 'Dan education',
      'Travel', 'Home Good', 'Medical', 'Work', 'Free 3', 'Other', 'Maks education', 'custom',
    ]
    const mapped = DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').map((c) => c.excelName)
    excelExpense.forEach((name) => expect(mapped).toContain(name))
  })
})
