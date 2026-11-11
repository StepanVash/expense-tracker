import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  CloudSnow,
  Flower2,
  Sun,
  Leaf,
  Layers,
  ArrowRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatMoney } from '../format.js'
import { MIN_MONTH } from '../storage.js'

export const SEASONS = [
  { id: 'winter', name: 'Winter', emoji: '❄️', icon: CloudSnow, months: ['12', '01', '02'], monthsLabel: 'Jan, Feb, Dec', color: '#3b6fb6' },
  { id: 'spring', name: 'Spring', emoji: '🌸', icon: Flower2, months: ['03', '04', '05'], monthsLabel: 'Mar, Apr, May', color: '#6a9c3a' },
  { id: 'summer', name: 'Summer', emoji: '☀️', icon: Sun, months: ['06', '07', '08'], monthsLabel: 'Jun, Jul, Aug', color: '#e07a5f' },
  { id: 'autumn', name: 'Autumn', emoji: '🍂', icon: Leaf, months: ['09', '10', '11'], monthsLabel: 'Sep, Oct, Nov', color: '#b78055' },
]

export default function SeasonComparisonView({
  transactions,
  categories,
  categoryMap,
  expenseCategories,
  incomeCategories,
}) {
  const minYear = Number(MIN_MONTH.slice(0, 4)) // 2026
  const defaultYear = Math.max(minYear, new Date().getFullYear())
  const [year, setYear] = useState(defaultYear)
  const [subMode, setSubMode] = useState('all') // 'all' (4 seasons in year) | 'custom' (Season A vs Season B)
  const [categoryType, setCategoryType] = useState('expense') // 'expense' | 'income'

  // Custom comparison state
  const [seasonAYear, setSeasonAYear] = useState(defaultYear)
  const [seasonAId, setSeasonAId] = useState('summer')
  const [seasonBYear, setSeasonBYear] = useState(defaultYear)
  const [seasonBId, setSeasonBId] = useState('autumn')

  // Helper to compute stats for a specific season in a specific year
  function getSeasonStats(targetYear, seasonId) {
    const seasonDef = SEASONS.find((s) => s.id === seasonId) || SEASONS[0]
    const monthPrefixes = seasonDef.months.map((m) => `${targetYear}-${m}`)

    const seasonTxs = transactions.filter((t) =>
      monthPrefixes.some((prefix) => t.date.startsWith(prefix)),
    )

    const income = seasonTxs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)

    const expenses = seasonTxs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)

    const savings = income - expenses
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0
    const avgMonthlyExpenses = Math.round((expenses / 3) * 100) / 100
    const avgMonthlyIncome = Math.round((income / 3) * 100) / 100

    // Spending / income by category
    const categoryTotals = {}
    seasonTxs.forEach((t) => {
      categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + t.amount
    })

    return {
      season: seasonDef,
      year: targetYear,
      income,
      expenses,
      savings,
      savingsRate,
      avgMonthlyExpenses,
      avgMonthlyIncome,
      txCount: seasonTxs.length,
      categoryTotals,
    }
  }

  // 4 seasons data for the selected single year
  const allSeasonsData = useMemo(() => {
    return SEASONS.map((s) => getSeasonStats(year, s.id))
  }, [transactions, year])

  const annualTotalExpenses = useMemo(() => {
    return allSeasonsData.reduce((s, d) => s + d.expenses, 0)
  }, [allSeasonsData])

  const annualTotalIncome = useMemo(() => {
    return allSeasonsData.reduce((s, d) => s + d.income, 0)
  }, [allSeasonsData])

  // Chart data for 4 seasons
  const chartData = useMemo(() => {
    return allSeasonsData.map((d) => ({
      name: `${d.season.emoji} ${d.season.name}`,
      Income: d.income,
      Expenses: d.expenses,
      Savings: d.savings,
    }))
  }, [allSeasonsData])

  // Category matrix per season
  const activeCategories = categoryType === 'expense' ? expenseCategories : incomeCategories
  const seasonalCategoryMatrix = useMemo(() => {
    const rows = activeCategories.map((cat) => {
      const amounts = allSeasonsData.map((d) => d.categoryTotals[cat.id] || 0)
      const total = amounts.reduce((s, a) => s + a, 0)
      return {
        ...cat,
        amounts,
        total,
      }
    })
    return rows.sort((a, b) => b.total - a.total)
  }, [activeCategories, allSeasonsData])

  // Custom season A vs Season B stats
  const seasonAStats = useMemo(() => getSeasonStats(seasonAYear, seasonAId), [transactions, seasonAYear, seasonAId])
  const seasonBStats = useMemo(() => getSeasonStats(seasonBYear, seasonBId), [transactions, seasonBYear, seasonBId])

  const diffExpenses = seasonBStats.expenses - seasonAStats.expenses
  const pctExpenses = seasonAStats.expenses > 0 ? Math.round((diffExpenses / seasonAStats.expenses) * 100) : 0

  const diffIncome = seasonBStats.income - seasonAStats.income
  const pctIncome = seasonAStats.income > 0 ? Math.round((diffIncome / seasonAStats.income) * 100) : 0

  const diffSavings = seasonBStats.savings - seasonAStats.savings

  function exportSeasonCsv() {
    const lines = []
    if (subMode === 'all') {
      const header = ['Category', 'Type', '❄️ Winter', '🌸 Spring', '☀️ Summer', '🍂 Autumn', 'Annual Total']
      lines.push(header.join(';'))

      lines.push(
        ['Total Income', 'income', ...allSeasonsData.map((d) => d.income.toFixed(2)), annualTotalIncome.toFixed(2)].join(';'),
      )
      lines.push(
        ['Total Expenses', 'expense', ...allSeasonsData.map((d) => d.expenses.toFixed(2)), annualTotalExpenses.toFixed(2)].join(';'),
      )
      lines.push(
        ['Net Savings', 'savings', ...allSeasonsData.map((d) => d.savings.toFixed(2)), (annualTotalIncome - annualTotalExpenses).toFixed(2)].join(';'),
      )

      seasonalCategoryMatrix.forEach((c) => {
        lines.push(
          [
            `"${c.name}"`,
            categoryType,
            ...c.amounts.map((a) => a.toFixed(2)),
            c.total.toFixed(2),
          ].join(';'),
        )
      })

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Seasonal_Analytics_${year}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } else {
      const header = [
        'Category',
        'Type',
        `${seasonAStats.season.name} ${seasonAYear} (PLN)`,
        `${seasonBStats.season.name} ${seasonBYear} (PLN)`,
        'Difference (PLN)',
        'Change (%)',
      ]
      lines.push(header.join(';'))

      activeCategories.forEach((cat) => {
        const valA = seasonAStats.categoryTotals[cat.id] || 0
        const valB = seasonBStats.categoryTotals[cat.id] || 0
        const diff = valB - valA
        const pct = valA > 0 ? Math.round((diff / valA) * 100) : 0
        lines.push(
          [`"${cat.name}"`, categoryType, valA.toFixed(2), valB.toFixed(2), diff.toFixed(2), `${pct}%`].join(';'),
        )
      })

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Season_Comparison_${seasonAStats.season.name}_${seasonAYear}_vs_${seasonBStats.season.name}_${seasonBYear}.csv`
      link.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="season-comparison-view">
      {/* Top Controls Bar - Unified Single Row with Mode Toggle and Year Selector */}
      <div className="season-top-bar">
        <div className="season-mode-toggle" role="tablist" aria-label="Season comparison mode">
          <button
            type="button"
            className={`btn ${subMode === 'all' ? 'primary' : ''}`}
            onClick={() => setSubMode('all')}
          >
            <Layers size={16} />
            <span>All 4 Seasons</span>
          </button>
          <button
            type="button"
            className={`btn ${subMode === 'custom' ? 'primary' : ''}`}
            onClick={() => setSubMode('custom')}
          >
            <ArrowRight size={16} />
            <span>Compare Specific Seasons</span>
          </button>
        </div>

        {subMode === 'all' && (
          <div className="season-year-inline">
            <span className="picker-label">Year:</span>
            <div className="yoy-year-select">
              <button
                type="button"
                className="icon-btn"
                disabled={year <= minYear}
                onClick={() => setYear((y) => Math.max(minYear, y - 1))}
                aria-label="Previous year"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="year-display">{year}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setYear((y) => y + 1)}
                aria-label="Next year"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {subMode === 'all' ? (
        <>
          {/* 4 Season KPI Cards */}
          <div className="season-cards-grid">
            {allSeasonsData.map((d) => {
              const expShare = annualTotalExpenses > 0 ? Math.round((d.expenses / annualTotalExpenses) * 100) : 0
              return (
                <div key={d.season.id} className="season-card" style={{ borderTopColor: d.season.color }}>
                  <div className="season-card-header">
                    <div className="season-title-wrap">
                      <span className="season-emoji">{d.season.emoji}</span>
                      <span className="season-name">{d.season.name}</span>
                    </div>
                    <span className="season-months-tag">{d.season.monthsLabel}</span>
                  </div>

                  <div className="season-stats">
                    <div className="season-stat-item">
                      <span className="season-stat-label">Expenses</span>
                      <span className="season-stat-value expense">{formatMoney(d.expenses)}</span>
                      {annualTotalExpenses > 0 && (
                        <span className="season-stat-share">{expShare}% of year</span>
                      )}
                    </div>

                    <div className="season-stat-item">
                      <span className="season-stat-label">Income</span>
                      <span className="season-stat-value income">{formatMoney(d.income)}</span>
                    </div>

                    <div className="season-stat-item">
                      <span className="season-stat-label">Net Savings</span>
                      <span className={`season-stat-value ${d.savings >= 0 ? 'savings' : 'danger'}`}>
                        {formatMoney(d.savings)}
                      </span>
                      <span className="season-stat-share">{d.savingsRate}% saved</span>
                    </div>

                    <div className="season-stat-item muted-stat">
                      <span className="season-stat-label">Avg/Month (exp)</span>
                      <span className="season-stat-value small">{formatMoney(d.avgMonthlyExpenses)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Grouped Bar Chart */}
          <div className="panel chart-panel">
            <h2>Seasonal Breakdown: {year}</h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted)' }} />
                  <YAxis tick={{ fill: 'var(--muted)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => [formatMoney(value), '']}
                    cursor={{ fill: 'var(--chart-cursor, rgba(148, 163, 184, 0.14))' }}
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      borderRadius: '10px',
                      color: 'var(--text)',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                    }}
                    labelStyle={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Bar dataKey="Expenses" fill="#b78055" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Income" fill="#337a6b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Savings" fill="#3b6fb6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown Table by Season */}
          <div className="panel matrix-panel">
            <div className="matrix-header">
              <h2>Category Breakdown by Season</h2>
              <div className="matrix-header-actions">
                <div className="type-toggle" role="tablist">
                  <button
                    type="button"
                    className={`btn ${categoryType === 'expense' ? 'primary' : ''}`}
                    onClick={() => setCategoryType('expense')}
                  >
                    Expenses
                  </button>
                  <button
                    type="button"
                    className={`btn ${categoryType === 'income' ? 'primary' : ''}`}
                    onClick={() => setCategoryType('income')}
                  >
                    Income
                  </button>
                </div>

                <button
                  type="button"
                  className="btn secondary export-btn"
                  onClick={exportSeasonCsv}
                  title={`Export ${year} Seasonal Summary to CSV`}
                >
                  <Download size={15} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="table-scroll">
              <table className="category-matrix-table seasonal-matrix-table">
                <thead>
                  <tr>
                    <th className="sticky-col">Category</th>
                    {SEASONS.map((s) => (
                      <th key={s.id} className="num-col season-col">
                        <span>{s.emoji} {s.name}</span>
                        <span className="sub-hdr">{s.monthsLabel}</span>
                      </th>
                    ))}
                    <th className="num-col total-col">Annual Total</th>
                    <th className="num-col share-col">% Share</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonalCategoryMatrix.map((row) => {
                    const annualTotal = categoryType === 'expense' ? annualTotalExpenses : annualTotalIncome
                    const share = annualTotal > 0 ? Math.round((row.total / annualTotal) * 100) : 0
                    return (
                      <tr key={row.id} className="matrix-row">
                        <td className="sticky-col cat-name-cell">
                          <span className="swatch" style={{ background: row.color }} />
                          <span className="emoji">{row.emoji}</span>
                          <span className="name">{row.name}</span>
                        </td>
                        {row.amounts.map((amount, idx) => (
                          <td key={idx} className={`num-col ${amount > 0 ? 'active-cell' : 'zero-cell'}`}>
                            {amount > 0 ? formatMoney(amount) : '—'}
                          </td>
                        ))}
                        <td className="num-col total-cell">{formatMoney(row.total)}</td>
                        <td className="num-col share-cell">{share}%</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className={`matrix-total-row ${categoryType}`}>
                    <td className="sticky-col">
                      <strong>Total {categoryType === 'expense' ? 'Expenses' : 'Income'}</strong>
                    </td>
                    {allSeasonsData.map((d) => (
                      <td key={d.season.id} className="num-col">
                        <strong>{formatMoney(categoryType === 'expense' ? d.expenses : d.income)}</strong>
                      </td>
                    ))}
                    <td className="num-col total-cell">
                      <strong>{formatMoney(categoryType === 'expense' ? annualTotalExpenses : annualTotalIncome)}</strong>
                    </td>
                    <td className="num-col share-cell">
                      <strong>100%</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Custom Season A vs Season B View */
        <div className="custom-season-compare">
          <div className="season-selector-pair">
            {/* Season A Box */}
            <div className="season-pick-box">
              <h3>Season A</h3>
              <div className="season-pick-row">
                <select
                  value={seasonAId}
                  onChange={(e) => setSeasonAId(e.target.value)}
                  aria-label="Season A"
                >
                  {SEASONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name} ({s.monthsLabel})
                    </option>
                  ))}
                </select>
                <div className="yoy-year-select">
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={seasonAYear <= minYear}
                    onClick={() => setSeasonAYear((y) => Math.max(minYear, y - 1))}
                    aria-label="Season A previous year"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="year-display">{seasonAYear}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setSeasonAYear((y) => y + 1)}
                    aria-label="Season A next year"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="vs-badge">VS</div>

            {/* Season B Box */}
            <div className="season-pick-box">
              <h3>Season B</h3>
              <div className="season-pick-row">
                <select
                  value={seasonBId}
                  onChange={(e) => setSeasonBId(e.target.value)}
                  aria-label="Season B"
                >
                  {SEASONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name} ({s.monthsLabel})
                    </option>
                  ))}
                </select>
                <div className="yoy-year-select">
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={seasonBYear <= minYear}
                    onClick={() => setSeasonBYear((y) => Math.max(minYear, y - 1))}
                    aria-label="Season B previous year"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="year-display">{seasonBYear}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setSeasonBYear((y) => y + 1)}
                    aria-label="Season B next year"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* YoY-style Cards for Season A vs Season B */}
          <div className="yoy-cards-grid">
            <div className="card yoy-kpi-card">
              <div className="card-header">
                <span className="card-label">Expenses Comparison</span>
                <span className={`delta-badge ${diffExpenses <= 0 ? 'good' : 'warning'}`}>
                  {diffExpenses > 0 ? '+' : ''}{diffExpenses !== 0 ? formatMoney(diffExpenses) : '0 PLN'} ({diffExpenses > 0 ? '+' : ''}{pctExpenses}%)
                </span>
              </div>
              <div className="yoy-split-values">
                <div className="split-side">
                  <span className="side-label">{seasonAStats.season.name} {seasonAYear}</span>
                  <span className="side-val expense">{formatMoney(seasonAStats.expenses)}</span>
                </div>
                <div className="split-side">
                  <span className="side-label">{seasonBStats.season.name} {seasonBYear}</span>
                  <span className="side-val expense">{formatMoney(seasonBStats.expenses)}</span>
                </div>
              </div>
            </div>

            <div className="card yoy-kpi-card">
              <div className="card-header">
                <span className="card-label">Income Comparison</span>
                <span className={`delta-badge ${diffIncome >= 0 ? 'good' : 'warning'}`}>
                  {diffIncome > 0 ? '+' : ''}{diffIncome !== 0 ? formatMoney(diffIncome) : '0 PLN'} ({diffIncome > 0 ? '+' : ''}{pctIncome}%)
                </span>
              </div>
              <div className="yoy-split-values">
                <div className="split-side">
                  <span className="side-label">{seasonAStats.season.name} {seasonAYear}</span>
                  <span className="side-val income">{formatMoney(seasonAStats.income)}</span>
                </div>
                <div className="split-side">
                  <span className="side-label">{seasonBStats.season.name} {seasonBYear}</span>
                  <span className="side-val income">{formatMoney(seasonBStats.income)}</span>
                </div>
              </div>
            </div>

            <div className="card yoy-kpi-card">
              <div className="card-header">
                <span className="card-label">Net Savings Comparison</span>
                <span className={`delta-badge ${diffSavings >= 0 ? 'good' : 'warning'}`}>
                  {diffSavings > 0 ? '+' : ''}{formatMoney(diffSavings)}
                </span>
              </div>
              <div className="yoy-split-values">
                <div className="split-side">
                  <span className="side-label">{seasonAStats.season.name} {seasonAYear}</span>
                  <span className="side-val savings">{formatMoney(seasonAStats.savings)}</span>
                </div>
                <div className="split-side">
                  <span className="side-label">{seasonBStats.season.name} {seasonBYear}</span>
                  <span className="side-val savings">{formatMoney(seasonBStats.savings)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category breakdown table between Season A and Season B */}
          <div className="panel matrix-panel">
            <div className="matrix-header">
              <h2>Category Comparison: {seasonAStats.season.name} {seasonAYear} vs {seasonBStats.season.name} {seasonBYear}</h2>
              <div className="matrix-header-actions">
                <div className="type-toggle" role="tablist">
                  <button
                    type="button"
                    className={`btn ${categoryType === 'expense' ? 'primary' : ''}`}
                    onClick={() => setCategoryType('expense')}
                  >
                    Expenses
                  </button>
                  <button
                    type="button"
                    className={`btn ${categoryType === 'income' ? 'primary' : ''}`}
                    onClick={() => setCategoryType('income')}
                  >
                    Income
                  </button>
                </div>

                <button
                  type="button"
                  className="btn secondary export-btn"
                  onClick={exportSeasonCsv}
                  title="Export Season Comparison to CSV"
                >
                  <Download size={15} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="table-scroll">
              <table className="category-matrix-table yoy-table">
                <thead>
                  <tr>
                    <th className="sticky-col">Category</th>
                    <th className="num-col">{seasonAStats.season.name} {seasonAYear}</th>
                    <th className="num-col">{seasonBStats.season.name} {seasonBYear}</th>
                    <th className="num-col">Difference</th>
                    <th className="num-col">Change %</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCategories.map((cat) => {
                    const valA = seasonAStats.categoryTotals[cat.id] || 0
                    const valB = seasonBStats.categoryTotals[cat.id] || 0
                    const diff = valB - valA
                    const pct = valA > 0 ? Math.round((diff / valA) * 100) : 0
                    if (valA === 0 && valB === 0) return null

                    return (
                      <tr key={cat.id} className="matrix-row">
                        <td className="sticky-col cat-name-cell">
                          <span className="swatch" style={{ background: cat.color }} />
                          <span className="emoji">{cat.emoji}</span>
                          <span className="name">{cat.name}</span>
                        </td>
                        <td className="num-col">{formatMoney(valA)}</td>
                        <td className="num-col">{formatMoney(valB)}</td>
                        <td className={`num-col ${diff === 0 ? '' : categoryType === 'expense' ? (diff > 0 ? 'danger-val' : 'good-val') : (diff >= 0 ? 'good-val' : 'danger-val')}`}>
                          {diff > 0 ? '+' : ''}{formatMoney(diff)}
                        </td>
                        <td className="num-col">
                          <span className={`pill-badge ${pct === 0 ? 'neutral' : categoryType === 'expense' ? (pct > 0 ? 'danger-pill' : 'good-pill') : (pct >= 0 ? 'good-pill' : 'danger-pill')}`}>
                            {pct > 0 ? `+${pct}%` : `${pct}%`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
