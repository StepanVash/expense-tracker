import { useState, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Download,
  Percent,
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

const MONTH_KEYS = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
]

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function YearComparisonView({
  transactions,
  categories,
  defaultYearA = 2026,
  defaultYearB = 2027,
}) {
  const minYear = Number(MIN_MONTH.slice(0, 4))
  const [yearA, setYearA] = useState(defaultYearA)
  const [yearB, setYearB] = useState(defaultYearB)
  const [metricMode, setMetricMode] = useState('expense') // 'expense' | 'income'

  // Generate selectable years: minYear up to currentYear + 4
  const currentYearNum = new Date().getFullYear()
  const availableYears = useMemo(() => {
    const maxYear = Math.max(2030, currentYearNum + 2)
    const list = []
    for (let y = minYear; y <= maxYear; y++) list.push(y)
    return list
  }, [minYear, currentYearNum])

  // Filter transactions for both years
  const txsA = useMemo(() => transactions.filter((t) => t.date.startsWith(`${yearA}-`)), [transactions, yearA])
  const txsB = useMemo(() => transactions.filter((t) => t.date.startsWith(`${yearB}-`)), [transactions, yearB])

  // Annual Totals
  const summaryA = useMemo(() => computeYearSummary(txsA), [txsA])
  const summaryB = useMemo(() => computeYearSummary(txsB), [txsB])

  // Category maps
  const expenseCategories = useMemo(() => categories.filter((c) => c.type === 'expense'), [categories])
  const incomeCategories = useMemo(() => categories.filter((c) => c.type === 'income'), [categories])

  // Monthly breakdown for chart
  const monthlyChartData = useMemo(() => {
    return MONTH_KEYS.map((mKey, idx) => {
      const monthA = `${yearA}-${mKey}`
      const monthB = `${yearB}-${mKey}`

      const valA = txsA
        .filter((t) => t.type === metricMode && t.date.startsWith(monthA))
        .reduce((sum, t) => sum + t.amount, 0)
      const valB = txsB
        .filter((t) => t.type === metricMode && t.date.startsWith(monthB))
        .reduce((sum, t) => sum + t.amount, 0)

      return {
        name: MONTH_LABELS[idx],
        [String(yearA)]: valA,
        [String(yearB)]: valB,
      }
    })
  }, [yearA, yearB, txsA, txsB, metricMode])

  // Category-by-category comparison
  const categoryComparison = useMemo(() => {
    const buildRow = (cat) => {
      const totalA = txsA
        .filter((t) => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0)
      const totalB = txsB
        .filter((t) => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0)
      const diff = totalB - totalA
      const pct = totalA > 0 ? Math.round(((totalB - totalA) / totalA) * 100) : null

      return {
        ...cat,
        totalA: Math.round(totalA * 100) / 100,
        totalB: Math.round(totalB * 100) / 100,
        diff: Math.round(diff * 100) / 100,
        pct,
      }
    }

    return {
      expenses: expenseCategories
        .map(buildRow)
        .filter((r) => r.totalA > 0 || r.totalB > 0)
        .sort((a, b) => b.totalB - a.totalB || b.totalA - a.totalA),
      income: incomeCategories
        .map(buildRow)
        .filter((r) => r.totalA > 0 || r.totalB > 0)
        .sort((a, b) => b.totalB - a.totalB),
    }
  }, [expenseCategories, incomeCategories, txsA, txsB])

  function swapYears() {
    setYearA(yearB)
    setYearB(yearA)
  }

  function exportComparisonCsv() {
    const lines = [
      `Category;Type;${yearA} (PLN);${yearB} (PLN);Difference (PLN);Change (%)`,
      `"Total Income";income;${summaryA.income.toFixed(2)};${summaryB.income.toFixed(2)};${(summaryB.income - summaryA.income).toFixed(2)};${calcPctString(summaryA.income, summaryB.income)}`,
      `"Total Expenses";expense;${summaryA.expenses.toFixed(2)};${summaryB.expenses.toFixed(2)};${(summaryB.expenses - summaryA.expenses).toFixed(2)};${calcPctString(summaryA.expenses, summaryB.expenses)}`,
      `"Net Savings";savings;${summaryA.savings.toFixed(2)};${summaryB.savings.toFixed(2)};${(summaryB.savings - summaryA.savings).toFixed(2)};-`,
    ]

    categoryComparison.expenses.forEach((c) => {
      lines.push(
        `"${c.name}";expense;${c.totalA.toFixed(2)};${c.totalB.toFixed(2)};${c.diff.toFixed(2)};${c.pct !== null ? `${c.pct}%` : '-'}`,
      )
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Year_Comparison_${yearA}_vs_${yearB}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const incomeDiff = summaryB.income - summaryA.income
  const expenseDiff = summaryB.expenses - summaryA.expenses
  const savingsDiff = summaryB.savings - summaryA.savings

  return (
    <div className="year-comparison-view">
      {/* Selector & Controls Bar */}
      <div className="panel comparison-controls-panel">
        <div className="years-selector-group">
          <label className="year-select-label">
            <span>Base Year:</span>
            <select
              value={yearA}
              onChange={(e) => setYearA(Number(e.target.value))}
              aria-label="Select base year"
            >
              {availableYears.map((y) => (
                <option key={`a-${y}`} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="icon-btn swap-btn"
            onClick={swapYears}
            aria-label="Swap comparison years"
            title="Swap years"
          >
            <ArrowLeftRight size={18} />
          </button>

          <label className="year-select-label">
            <span>Compare With:</span>
            <select
              value={yearB}
              onChange={(e) => setYearB(Number(e.target.value))}
              aria-label="Select comparison year"
            >
              {availableYears.map((y) => (
                <option key={`b-${y}`} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          className="btn"
          onClick={exportComparisonCsv}
          aria-label="Export Year Comparison CSV"
        >
          <Download size={16} />
          <span>Export Comparison CSV</span>
        </button>
      </div>

      {/* 4 Comparative KPI Cards */}
      <section className="cards">
        <CompareCard
          label="Total Income"
          valA={summaryA.income}
          valB={summaryB.income}
          diff={incomeDiff}
          yearA={yearA}
          yearB={yearB}
          type="income"
          icon={TrendingUp}
        />
        <CompareCard
          label="Total Expenses"
          valA={summaryA.expenses}
          valB={summaryB.expenses}
          diff={expenseDiff}
          yearA={yearA}
          yearB={yearB}
          type="expense"
          icon={TrendingDown}
        />
        <CompareCard
          label="Net Savings"
          valA={summaryA.savings}
          valB={summaryB.savings}
          diff={savingsDiff}
          yearA={yearA}
          yearB={yearB}
          type="savings"
          icon={PiggyBank}
        />
        <div className="card neutral">
          <div className="card-head">
            <Percent size={18} />
            <span>Savings Rate Comparison</span>
          </div>
          <div className="compare-values-row">
            <div>
              <span className="muted small">{yearA}:</span>{' '}
              <strong>{summaryA.savingsRate}%</strong>
            </div>
            <div>
              <span className="muted small">{yearB}:</span>{' '}
              <strong>{summaryB.savingsRate}%</strong>
            </div>
          </div>
          <div className="card-subtext small">
            Difference:{' '}
            <strong className={summaryB.savingsRate >= summaryA.savingsRate ? 'income' : 'expense'}>
              {summaryB.savingsRate >= summaryA.savingsRate ? '+' : ''}
              {summaryB.savingsRate - summaryA.savingsRate}% points
            </strong>
          </div>
        </div>
      </section>

      {/* Monthly YoY Bar Chart */}
      <div className="panel chart-panel">
        <div className="panel-title-row">
          <div>
            <h2>Monthly Comparison: {yearA} vs. {yearB}</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              Compare monthly trends side-by-side across all 12 months.
            </p>
          </div>
          <div className="metric-toggle" role="group" aria-label="Comparison Metric">
            <button
              type="button"
              className={metricMode === 'expense' ? 'active' : ''}
              onClick={() => setMetricMode('expense')}
            >
              Expenses
            </button>
            <button
              type="button"
              className={metricMode === 'income' ? 'active' : ''}
              onClick={() => setMetricMode('income')}
            >
              Income
            </button>
          </div>
        </div>

        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--muted)' }}
                tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k` : val)}
              />
              <Tooltip
                formatter={(val) => [formatMoney(val)]}
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
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey={String(yearA)} fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey={String(yearB)}
                fill={metricMode === 'income' ? '#337a6b' : '#b78055'}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category-by-Category Comparison Table */}
      <section className="panel year-matrix-panel">
        <div className="panel-title-row">
          <div>
            <h2>Category-by-Category YoY Comparison</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              How spending changed in {yearB} compared to {yearA}.
            </p>
          </div>
        </div>

        <div className="year-matrix-wrapper">
          <table className="year-matrix-table compare-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Category</th>
                <th>{yearA} (PLN)</th>
                <th>{yearB} (PLN)</th>
                <th>Difference</th>
                <th>Change (%)</th>
              </tr>
            </thead>
            <tbody>
              {categoryComparison.expenses.map((cat) => {
                const isSaved = cat.diff < 0 // spent less = good!
                const isOver = cat.diff > 0 // spent more

                return (
                  <tr key={cat.id} className="matrix-category-row">
                    <td className="cat-cell" style={{ textAlign: 'left' }}>
                      <span className="swatch" style={{ background: cat.color }} />
                      <span className="cat-emoji">{cat.emoji}</span>
                      <span className="cat-name">{cat.name}</span>
                    </td>
                    <td>{formatMoney(cat.totalA)}</td>
                    <td>{formatMoney(cat.totalB)}</td>
                    <td className={isSaved ? 'income' : isOver ? 'expense' : ''}>
                      <strong>
                        {cat.diff > 0 ? '+' : ''}
                        {formatMoney(cat.diff)}
                      </strong>
                    </td>
                    <td>
                      {cat.pct !== null ? (
                        <span className={`diff-pill ${isSaved ? 'success' : isOver ? 'danger' : ''}`}>
                          {cat.pct > 0 ? `+${cat.pct}%` : `${cat.pct}%`}
                        </span>
                      ) : cat.totalB > 0 ? (
                        <span className="diff-pill danger">New</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {categoryComparison.expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-list muted">
                    No matching categories found between {yearA} and {yearB}.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="budget-totals-row">
                <td style={{ textAlign: 'left' }}>
                  <strong>Total Expenses</strong>
                </td>
                <td>
                  <strong>{formatMoney(summaryA.expenses)}</strong>
                </td>
                <td>
                  <strong>{formatMoney(summaryB.expenses)}</strong>
                </td>
                <td className={expenseDiff > 0 ? 'expense' : 'income'}>
                  <strong>
                    {expenseDiff > 0 ? '+' : ''}
                    {formatMoney(expenseDiff)}
                  </strong>
                </td>
                <td>
                  {summaryA.expenses > 0 ? (
                    <span className={`diff-pill ${expenseDiff <= 0 ? 'success' : 'danger'}`}>
                      {expenseDiff > 0 ? '+' : ''}
                      {Math.round((expenseDiff / summaryA.expenses) * 100)}%
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}

function CompareCard({ label, valA, valB, diff, yearA, yearB, type, icon: Icon }) {
  const pct = valA > 0 ? Math.round(((valB - valA) / valA) * 100) : null
  const isPositiveChange = diff > 0
  const isGood = type === 'income' || type === 'savings' ? isPositiveChange : !isPositiveChange

  return (
    <div className={`card ${type}`}>
      <div className="card-head">
        <Icon size={18} />
        <span>{label}</span>
      </div>

      <div className="compare-card-values">
        <div className="compare-year-item">
          <span className="muted small">{yearA}</span>
          <span className="card-value-small">{formatMoney(valA)}</span>
        </div>
        <ArrowRight size={16} className="compare-arrow" />
        <div className="compare-year-item">
          <span className="muted small">{yearB}</span>
          <span className="card-value-small bold">{formatMoney(valB)}</span>
        </div>
      </div>

      <div className="card-subtext small">
        <span className={isGood ? 'income' : 'expense'}>
          {diff > 0 ? '+' : ''}
          {formatMoney(diff)}
          {pct !== null && ` (${pct > 0 ? '+' : ''}${pct}%)`}
        </span>
      </div>
    </div>
  )
}

function computeYearSummary(txs) {
  const income = txs
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const expenses = txs
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  const savings = income - expenses
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0
  return { income, expenses, savings, savingsRate }
}

function calcPctString(a, b) {
  if (a <= 0) return '-'
  const pct = Math.round(((b - a) / a) * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}
