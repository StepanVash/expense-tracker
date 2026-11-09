/** Helpers for formatting money and months. */

const pln = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

export function formatMoney(amount) {
  return pln.format(amount || 0)
}

/** '2026-01' -> 'January 2026' */
export function formatMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** Current month as 'YYYY-MM'. */
export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Today as 'YYYY-MM-DD' (local time). */
export function todayISO(date = new Date()) {
  return `${currentMonth(date)}-${String(date.getDate()).padStart(2, '0')}`
}

/** '2026-01-09' -> '09.01.2026' */
export function formatDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** Move a 'YYYY-MM' month by `delta` months (e.g. -1 = previous month). */
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  return currentMonth(new Date(y, m - 1 + delta, 1))
}
