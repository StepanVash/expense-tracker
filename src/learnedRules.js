import { searchable } from './suggest.js'

/** Words that are corporate/legal forms or generic payment noise, not the merchant identity. */
const NOISE_WORDS = new Set([
  'sa', 'sp', 'zo', 'zoo', 'spolka', 'uab', 'fhu', 'pphu', 'phu', 'sc', 'gmbh', 'llc', 'ltd', 'jmp',
  'pol', 'pl', 'krakow', 'warszawa', 'wroclaw', 'poznan', 'gdansk', 'lodz',
  'sklep', 'nr', 'market', 'salon', 'punkt', 'oddzial', 'card', 'karta', 'payment', 'platnosc',
  'zakup', 'pos', 'terminal', 'transakcja', 'transfer', 'przelew', 'topup', 'top', 'up',
  // Ukrainian corporate forms and payment noise
  'тов', 'фоп', 'пат', 'прат', 'пп', 'від', 'до', 'платіж', 'оплата', 'переказ', 'карта', 'термінал',
])

/**
 * Extract significant core keyword from a description.
 * E.g.: "JMP S.A. BIEDRONKA 151 KRAKOW" -> "biedronka"
 *       "PODWAWELSKA SKLEP NR 9 Krakow" -> "podwawelska"
 *       "McDonalds 61600331 Nowy Targ" -> "mcdonalds"
 */
export function extractCoreMerchantPattern(text) {
  const norm = searchable(text)
  const tokens = norm.split(' ').filter((t) => t.length >= 2 && !NOISE_WORDS.has(t))
  if (!tokens.length) return norm.slice(0, 30)

  // If there's a token with length >= 4, prioritize the first meaningful long token
  const mainToken = tokens.find((t) => t.length >= 4)
  if (mainToken) return mainToken

  if (tokens.length >= 2) return `${tokens[0]} ${tokens[1]}`
  return tokens[0]
}

/**
 * Matches a transaction description against user-learned category rules.
 * @param {string} text - Transaction description/title
 * @param {Array} learnedRules - Array of { pattern, categoryId, type }
 * @param {string} type - 'expense' | 'income'
 * @param {Array} categories - Available categories list
 * @returns {string|null} categoryId or null
 */
export function matchLearnedRule(text, learnedRules, type, categories) {
  if (!text || !Array.isArray(learnedRules) || !learnedRules.length) return null

  const validCatIds = new Set(categories.filter((c) => c.type === type).map((c) => c.id))
  const pool = learnedRules.filter((r) => r.type === type && validCatIds.has(r.categoryId))
  if (!pool.length) return null

  const target = ` ${searchable(text)} `
  const coreTarget = extractCoreMerchantPattern(text)

  let bestRule = null
  let bestScore = 0

  for (const rule of pool) {
    const pat = searchable(rule.pattern)
    if (!pat) continue

    let score = 0
    if (pat === searchable(text)) {
      score = 2000 + pat.length
    } else if (target.includes(` ${pat} `)) {
      score = 1000 + pat.length
    } else if (pat.length >= 4 && target.includes(pat)) {
      score = 500 + pat.length
    } else if (coreTarget && pat === coreTarget) {
      score = 800 + pat.length
    } else if (coreTarget && (pat.includes(coreTarget) || coreTarget.includes(pat))) {
      score = 300 + Math.min(pat.length, coreTarget.length)
    }

    if (score > bestScore) {
      bestScore = score
      bestRule = rule
    }
  }

  return bestRule ? bestRule.categoryId : null
}
