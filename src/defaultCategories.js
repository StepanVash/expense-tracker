/**
 * Default categories, cleaned up from 2026_Budget_Tracking.xlsx.
 *
 * Changes vs the Excel file:
 *  - placeholders renamed: "custom" -> Coffee, "Free 3" -> Money transfers
 *  - "Custom-2" / "Custom-3" removed (you can add your own in Settings)
 *  - income "Work" -> Salary, income "Other" -> Other income (no duplicate names with expenses)
 *  - every category has its own emoji and colour
 *
 * `excelName` remembers the original Excel name so the Excel import (Step 5)
 * can put each row into the right category.
 */

export const DEFAULT_CATEGORIES = [
  // ----- income -----
  { type: 'income', emoji: '💼', name: 'Salary', color: '#337a6b', excelName: 'Work' },
  { type: 'income', emoji: '💵', name: 'Other income', color: '#5aa469', excelName: 'Other' },

  // ----- expenses -----
  { type: 'expense', emoji: '🏠', name: 'Rent', color: '#b78055', excelName: 'Rent' },
  { type: 'expense', emoji: '🥝', name: 'Grocery', color: '#6a9c3a', excelName: 'Grocery' },
  { type: 'expense', emoji: '🍔', name: 'Cafe & Entertainment', color: '#e07a5f', excelName: 'Cafe + Entertainment' },
  { type: 'expense', emoji: '☕', name: 'Coffee', color: '#8d5b4c', excelName: 'custom' },
  { type: 'expense', emoji: '🚘', name: 'Transportation', color: '#3d5a80', excelName: 'Transportation' },
  { type: 'expense', emoji: '🛍️', name: 'Shopping', color: '#c06c84', excelName: 'Shopping' },
  { type: 'expense', emoji: '🏦', name: 'Banking', color: '#5c6b73', excelName: 'Banking' },
  { type: 'expense', emoji: '🐶', name: 'Maks free time', color: '#f2a541', excelName: 'Maks free time' },
  { type: 'expense', emoji: '⚡', name: 'Utilities Lviv', color: '#f4d35e', excelName: 'Utility Lviv' },
  { type: 'expense', emoji: '💫', name: 'Personal', color: '#9b5de5', excelName: 'Personal' },
  { type: 'expense', emoji: '🧷', name: 'Insurance', color: '#4d908e', excelName: 'Insurance' },
  { type: 'expense', emoji: '📞', name: 'Phone', color: '#277da1', excelName: 'Phone' },
  { type: 'expense', emoji: '💪', name: 'Gym', color: '#d62828', excelName: 'Gym' },
  { type: 'expense', emoji: '🧑‍🎓', name: 'Dan education', color: '#577590', excelName: 'Dan education' },
  { type: 'expense', emoji: '🎓', name: 'Maks education', color: '#43aa8b', excelName: 'Maks education' },
  { type: 'expense', emoji: '✈️', name: 'Travel', color: '#00a6fb', excelName: 'Travel' },
  { type: 'expense', emoji: '🛋️', name: 'Home goods', color: '#a68a64', excelName: 'Home Good' },
  { type: 'expense', emoji: '👩‍⚕️', name: 'Medical', color: '#ef476f', excelName: 'Medical' },
  { type: 'expense', emoji: '🗂️', name: 'Work expenses', color: '#6c757d', excelName: 'Work' },
  { type: 'expense', emoji: '💸', name: 'Money transfers', color: '#118ab2', excelName: 'Free 3' },
  { type: 'expense', emoji: '📦', name: 'Other', color: '#999999', excelName: 'Other' },
]

/** Colours offered when you create a new category. */
export const COLOR_PALETTE = [
  '#337a6b', '#5aa469', '#6a9c3a', '#b78055', '#e07a5f', '#8d5b4c', '#c06c84', '#ef476f',
  '#d62828', '#f2a541', '#f4d35e', '#43aa8b', '#4d908e', '#277da1', '#00a6fb', '#3d5a80',
  '#577590', '#9b5de5', '#5c6b73', '#999999',
]
