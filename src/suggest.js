/**
 * Suggest a category for a transaction title, learned from past transactions.
 * Example: after you filed "biedronka" under Grocery a few times, typing
 * "biedronka" (or "biedronka krakow") suggests Grocery.
 */

const normalize = (s) => String(s ?? '').trim().toLowerCase()

/** Most frequent category id among `list`; ties go to the most recent transaction. */
function mostCommonCategory(list) {
  const stats = new Map()
  for (const t of list) {
    const s = stats.get(t.categoryId) ?? { count: 0, latest: '' }
    s.count += 1
    if (t.date > s.latest) s.latest = t.date
    stats.set(t.categoryId, s)
  }
  let best = null
  for (const [id, s] of stats) {
    if (!best || s.count > best.count || (s.count === best.count && s.latest > best.latest)) {
      best = { id, ...s }
    }
  }
  return best?.id ?? null
}

/**
 * @returns the id of the suggested category, or null if there is no good guess.
 * Only categories that still exist and have the right type (income/expense) are suggested.
 */
export function suggestCategoryId(title, transactions, type, categories) {
  const q = normalize(title)
  if (q.length < 2) return null

  const valid = new Set(categories.filter((c) => c.type === type).map((c) => c.id))
  const past = transactions.filter(
    (t) => t.type === type && t.categoryId && valid.has(t.categoryId) && normalize(t.title),
  )

  // 1) the same title was used before
  const exact = past.filter((t) => normalize(t.title) === q)
  if (exact.length) return mostCommonCategory(exact)

  // 2) the typed text starts a known title, or a known title starts the typed text
  const similar = past.filter((t) => {
    const known = normalize(t.title)
    return known.startsWith(q) || (known.length >= 3 && q.startsWith(known))
  })
  return similar.length ? mostCommonCategory(similar) : null
}
