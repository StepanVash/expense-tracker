import { createWorker } from 'tesseract.js'
import { suggestCategoryId, suggestCategoryIdFromDescription } from './suggest.js'
import { getLearnedRules, getCategories, getTransactions, MIN_DATE } from './storage.js'
import { extractCoreMerchantPattern } from './learnedRules.js'

export const DATE_REGEX = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/

export const UKR_MONTHS = {
  'січня': '01', 'лютого': '02', 'березня': '03', 'квітня': '04',
  'травня': '05', 'червня': '06', 'липня': '07', 'серпня': '08',
  'вересня': '09', 'жовтня': '10', 'листопада': '11', 'грудня': '12',
  'січень': '01', 'лютий': '02', 'березень': '03', 'квітень': '04',
  'травень': '05', 'червень': '06', 'липень': '07', 'серпень': '08',
  'вересень': '09', 'жовтень': '10', 'листопад': '11', 'грудень': '12',
}

export const UKR_DATE_REGEX = new RegExp(
  `(?:^|[\\s\\W])(\\d{1,2})\\s+(${Object.keys(UKR_MONTHS).join('|')})(?:\\s+(\\d{4}))?(?:$|[\\s\\W])`,
  'i'
)

// Matches amounts like: -70.00, 4 800.00, -12,00 PLN, -645.00 ₴
export const AMOUNT_REGEX = /([-−+]?\s*(?:\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)[,\.]\d{2})(?:\s*(?:PLN|zł|₴|\u20B4|грн|uah|[28z]\b))?/i

// Common UI chrome / navigation words in bank mobile apps to filter out
export const NOISE_REGEX = /^(historia konta|konto za zero|znajdź odbiorcę|uznania|obciążenia|wszystkie|sprawdź swoje finanse|szukaj|\d{1,2}:\d{2}|[xbus=|\.\[\]\{\}]+|visa|monobank)$/i

// Internal transfer signals across Polish and Ukrainian banking apps
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
  // Ukrainian bank transfer keywords
  'від:',
  'переказ на картку',
  'переказ',
  'поповнення',
  'скарбничка',
  'банка',
  'monobank',
]

/**
 * Checks if raw text from an image comes from a Ukrainian bank app.
 * @param {string} text
 * @returns {boolean}
 */
export function detectUkrainianBank(text) {
  if (!text || typeof text !== 'string') return false
  const t = text.toLowerCase()
  return (
    t.includes('monobank') ||
    t.includes('приват') ||
    t.includes('пумб') ||
    t.includes('ощад') ||
    t.includes('райф') ||
    t.includes('від:') ||
    t.includes('₴') ||
    t.includes('грн') ||
    t.includes('uah') ||
    /січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня/.test(t)
  )
}

/**
 * Parses raw text extracted from a bank app screenshot into transactions.
 * @param {string} text - Raw OCR text
 * @param {{ exchangeRate?: number, defaultYear?: number }} [options]
 * @returns {Array<{ date: string, title: string, amount: number, rawAmount: number, rawCurrency: string, type: 'income'|'expense', isTransfer: boolean }>}
 */
export function parseScreenshotText(text, options = {}) {
  if (!text || typeof text !== 'string') return []

  const defaultYear = options.defaultYear || 2026
  const exchangeRate = options.exchangeRate || 10.0 // default 1 PLN = 10.0 UAH
  const isUkrainian = detectUkrainianBank(text)

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let currentDate = null
  const results = []
  let buffer = []

  for (let line of lines) {
    // 1. Check Polish / numeric date header (e.g. 24.10.2026)
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

    // 2. Check Ukrainian date header (e.g. 29 жовтня)
    const ukrDateMatch = line.match(UKR_DATE_REGEX)
    if (ukrDateMatch) {
      const day = ukrDateMatch[1].padStart(2, '0')
      const monthStr = UKR_MONTHS[ukrDateMatch[2].toLowerCase()]
      const yr = ukrDateMatch[3] || defaultYear
      const isoDate = `${yr}-${monthStr}-${day}`
      if (isoDate >= MIN_DATE) {
        currentDate = isoDate
      }
      buffer = []
      continue
    }

    if (!currentDate) continue

    // Filter out phone numbers and common app chrome noise
    if (/^\+?\d{10,14}$/.test(line.replace(/[\s\(\)\-]/g, ''))) {
      continue
    }

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
      const rawAmount = Math.round(parseFloat(numStr) * 100) / 100

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

      // Clean single-letter avatar prefixes from title (e.g. "b ODBIORCA..." -> "ODBIORCA...", "o ОСББ..." -> "ОСББ...")
      title = title.replace(/^[a-zєo\W]{1,2}\s+/i, '').replace(/[\.]{2,}$/, '').trim()

      // Determine income vs expense (in Ukrainian apps, "Від:" or unsigned amounts are income)
      const isIncome = !isNegative && (line.includes('Від:') || !line.includes('-'))
      const type = isIncome ? 'income' : 'expense'

      const titleLower = title.toLowerCase()
      const descLower = descOnSameLine.toLowerCase()
      const isTransfer = TRANSFER_KEYWORDS.some(
        (kw) => titleLower.includes(kw) || descLower.includes(kw),
      )

      // Calculate amount in PLN
      const rawCurrency = isUkrainian ? 'UAH' : 'PLN'
      const amountInPln = isUkrainian
        ? Math.round((rawAmount / exchangeRate) * 100) / 100
        : rawAmount

      if (Number.isFinite(rawAmount) && rawAmount > 0) {
        results.push({
          date: currentDate,
          title,
          amount: amountInPln,
          rawAmount,
          rawCurrency,
          type,
          isTransfer,
        })
      }
      buffer = []
    } else {
      // Line is title/description text
      const item = cleanLine.replace(/^[a-zєo\W]{1,2}\s+/i, '').trim()
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
    const rawVal = tx.rawAmount !== undefined ? tx.rawAmount : tx.amount
    const curr = tx.rawCurrency || 'PLN'
    const key = `${tx.date}|${rawVal.toFixed(2)}|${curr}|${tx.type}|${tx.title.toLowerCase().trim()}`
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
 * @param {{ exchangeRate?: number, defaultYear?: number }} [options]
 * @returns {Promise<{ transactions: Array, totalImages: number, duplicatesRemoved: number, isUkrainian: boolean, detectedCurrency: string }>}
 */
export async function processScreenshotFiles(imageFiles, onProgress, options = {}) {
  if (!imageFiles || imageFiles.length === 0) {
    return { transactions: [], totalImages: 0, duplicatesRemoved: 0, isUkrainian: false, detectedCurrency: 'PLN' }
  }

  let worker = null
  const allParsed = []
  let isAnyUkrainian = false

  try {
    const total = imageFiles.length
    if (onProgress) {
      onProgress({ current: 0, total, progress: 0, status: 'Initializing OCR engine (Polish, English, Ukrainian)...' })
    }

    worker = await createWorker('pol+eng+ukr')

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
      const rawText = ret.data?.text || ''
      if (detectUkrainianBank(rawText)) {
        isAnyUkrainian = true
      }

      const parsed = parseScreenshotText(rawText, options)
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

    // Built-in intelligent defaults for common Ukrainian bank items if no category yet
    if (!categoryId && tx.type === 'expense') {
      const t = tx.title.toLowerCase()
      if (t.includes('київстар') || t.includes('vodafone') || t.includes('lifecell')) {
        const billsCat = categories.find((c) => /phone|bill|rachunki|telefon/i.test(c.name))
        if (billsCat) categoryId = billsCat.id
      } else if (t.includes('вода') || t.includes('опалення') || t.includes('газ') || t.includes('осбб')) {
        const homeCat = categories.find((c) => /home|mieszkanie|rachunki|utilities/i.test(c.name))
        if (homeCat) categoryId = homeCat.id
      }
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
    isUkrainian: isAnyUkrainian,
    detectedCurrency: isAnyUkrainian ? 'UAH' : 'PLN',
    defaultExchangeRate: options.exchangeRate || 10.0,
  }
}
