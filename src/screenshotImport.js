import { createWorker } from 'tesseract.js'
import { suggestCategoryId, suggestCategoryIdFromDescription } from './suggest.js'
import { getLearnedRules, getCategories, getTransactions, MIN_DATE } from './storage.js'
import { extractCoreMerchantPattern } from './learnedRules.js'

export const DATE_REGEX = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/
export const AMOUNT_REGEX = /([-−+]?\s*(?:\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)(?:[,\.]\d{2}))\s*(?:PLN|zł)?\b/i

// Common UI chrome / navigation words in bank mobile apps to filter out
export const NOISE_REGEX = /^(historia konta|konto za zero|znajdź odbiorcę|uznania|obciążenia|wszystkie|sprawdź swoje finanse|szukaj|\d{1,2}:\d{2}|[xbus=|\.\[\]\{\}]+)$/i

// Internal transfer signals
export const TRANSFER_KEYWORDS = [
  'przelew na telefon',
  'przelew własny',
  'przelew',
  'zlecenie stałe',
  'zlecenie stale',
  'oszczędności',
  'oszczednosci',
  'lokata',
  'zen.com',
  'revolut',
  'blik',
]

/**
 * Parses raw text extracted from a bank app screenshot into transactions.
 * @param {string} text - Raw OCR text
 * @returns {Array<{ date: string, title: string, amount: number, type: 'income'|'expense', isTransfer: boolean }>}
 */
export function parseScreenshotText(text) {
  if (!text || typeof text !== 'string') return []

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let currentDate = null
  const results = []
  let buffer = []

  for (let line of lines) {
    // Check if line contains a date header (e.g. 24.10.2026)
    const dateMatch = line.match(DATE_REGEX)
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0')
      const month = dateMatch[2].padStart(2, '0')
      const year = dateMatch[3]
      const isoDate = `${year}-${month}-${day}`
      if (isoDate >= MIN_DATE) {
        currentDate = isoDate
      }
      buffer = []
      continue
    }

    if (!currentDate) continue

    // Filter out common app chrome/header noise
    const cleanLine = line.replace(/^[=\|\.\s\-\+]+/, '').trim()
    if (!cleanLine || NOISE_REGEX.test(cleanLine.toLowerCase())) {
      continue
    }

    // Check for transaction amount
    const amountMatch = line.match(AMOUNT_REGEX)
    if (amountMatch) {
      const rawAmountStr = amountMatch[1].replace(/\s+/g, '').replace('−', '-')
      const isNegative = rawAmountStr.startsWith('-')
      const numStr = rawAmountStr.replace(/^[+-]/, '').replace(',', '.')
      const amount = Math.round(parseFloat(numStr) * 100) / 100

      // Description is either on this line before the amount, or from the buffer
      const descOnSameLine = line.replace(AMOUNT_REGEX, '').replace(/^[=\|\.\s\-\+]+/, '').trim()
      let title = ''
      if (buffer.length > 0) {
        title = buffer[0]
      } else if (descOnSameLine) {
        title = descOnSameLine
      } else {
        title = 'Bank transaction'
      }

      // Clean single-letter avatar prefixes from title (e.g. "b ODBIORCA..." -> "ODBIORCA...")
      title = title.replace(/^[a-z]\s+/i, '').replace(/[\.]{2,}$/, '').trim()

      const type = isNegative ? 'expense' : 'income'
      const titleLower = title.toLowerCase()
      const descLower = descOnSameLine.toLowerCase()
      const isTransfer = TRANSFER_KEYWORDS.some(
        (kw) => titleLower.includes(kw) || descLower.includes(kw),
      )

      if (Number.isFinite(amount) && amount > 0) {
        results.push({
          date: currentDate,
          title,
          amount,
          type,
          isTransfer,
        })
      }
      buffer = []
    } else {
      // Line is title/description text
      const item = cleanLine.replace(/^[a-z]\s+/i, '').trim()
      if (item.length > 1 && !NOISE_REGEX.test(item.toLowerCase())) {
        buffer.push(item)
      }
    }
  }

  return results
}

/**
 * Deduplicates transactions extracted across multiple screenshots.
 * When multiple overlapping screenshots are uploaded, identical transactions are merged.
 * @param {Array} transactions
 * @returns {{ deduplicated: Array, duplicatesRemoved: number }}
 */
export function deduplicateTransactions(transactions) {
  const seen = new Set()
  const deduplicated = []
  let duplicatesRemoved = 0

  for (const tx of transactions) {
    const key = `${tx.date}|${tx.amount.toFixed(2)}|${tx.type}|${tx.title.toLowerCase().trim()}`
    if (seen.has(key)) {
      duplicatesRemoved++
    } else {
      seen.add(key)
      deduplicated.push(tx)
    }
  }

  return { deduplicated, duplicatesRemoved }
}

/**
 * Runs client-side OCR on multiple image files using Tesseract.js.
 * @param {File[]} imageFiles - Array of image files from input/drop
 * @param {(progress: { current: number, total: number, progress: number, status: string }) => void} onProgress
 * @returns {Promise<{ transactions: Array, totalImages: number, duplicatesRemoved: number }>}
 */
export async function processScreenshotFiles(imageFiles, onProgress) {
  if (!imageFiles || imageFiles.length === 0) {
    return { transactions: [], totalImages: 0, duplicatesRemoved: 0 }
  }

  let worker = null
  const allParsed = []

  try {
    const total = imageFiles.length
    if (onProgress) {
      onProgress({ current: 0, total, progress: 0, status: 'Initializing OCR engine...' })
    }

    worker = await createWorker('pol+eng')

    for (let i = 0; i < total; i++) {
      const file = imageFiles[i]
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          progress: Math.round(((i + 0.2) / total) * 100),
          status: `Processing screenshot ${i + 1} of ${total}: ${file.name}...`,
        })
      }

      const ret = await worker.recognize(file)
      const parsed = parseScreenshotText(ret.data?.text || '')
      allParsed.push(...parsed)

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          progress: Math.round(((i + 1) / total) * 100),
          status: `Parsed ${parsed.length} transaction(s) from screenshot ${i + 1}...`,
        })
      }
    }
  } finally {
    if (worker) {
      await worker.terminate()
    }
  }

  // Deduplicate across all screenshots
  const { deduplicated, duplicatesRemoved } = deduplicateTransactions(allParsed)

  // Attach auto-suggested category and learned rules
  const learnedRules = getLearnedRules()
  const categories = getCategories()
  const allTx = getTransactions()

  const enriched = deduplicated.map((tx, idx) => {
    // Check learned rules first
    const pattern = extractCoreMerchantPattern(tx.title)
    const rule = learnedRules.find(
      (r) => r.type === tx.type && r.pattern.toLowerCase() === pattern.toLowerCase(),
    )

    let categoryId = rule ? rule.categoryId : null

    // If no learned rule, use suggestion engine
    if (!categoryId) {
      categoryId =
        suggestCategoryId(tx.title, allTx, tx.type, categories) ||
        suggestCategoryIdFromDescription(tx.title, allTx, tx.type, categories) ||
        null
    }

    return {
      id: `screenshot-row-${idx}-${Date.now()}`,
      ...tx,
      categoryId,
      ignored: tx.isTransfer, // Transfers default to ignored
    }
  })

  return {
    transactions: enriched,
    totalImages: imageFiles.length,
    duplicatesRemoved,
  }
}
