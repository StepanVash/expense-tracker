import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Calculator,
  Download,
  Calendar,
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
import { getTransactions, getCategories } from '../storage.js'
import { formatMoney, formatMonth } from '../format.js'
import { MIN_MONTH } from '../storage.js'
import YearComparisonView from '../components/YearComparisonView.jsx'
import SeasonComparisonView from '../components/SeasonComparisonView.jsx'

const MONTH_KEYS = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
]

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function YearView({ onSelectMonth }) {
  const [viewMode, setViewMode] = useState('single') // 'single' | 'compare'
  const [year, setYear] = useState(2026)
  const minYear = Number(MIN_MONTH.slice(0, 4)) // 2026

  const transactions = useMemo(() => getTransactions(), [])
  const categories = useMemo(() => getCategories(), [])

  // Filter transactions for this specific year
  const yearPrefix = `${year}-`
  const yearTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(yearPrefix))
  }, [transactions, yearPrefix])

  // Category maps
  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]))
  }, [categories])

  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'expense')
  }, [categories])

  const incomeCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'income')
  }, [categories])

  // Compute 12-month summary columns
  const monthlyTotals = useMemo(() => {
    return MONTH_KEYS.map((mKey, idx) => {
      const monthStr = `${year}-${mKey}`
      const txs = yearTransactions.filter((t) => t.date.startsWith(monthStr))
      const income = txs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)
      const expenses = txs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0)
      const savings = income - expenses
      return {
        key: mKey,
        label: MONTH_LABELS[idx],
        monthStr,
        income,
        expenses,
        savings,
        count: txs.length,
      }
    })
  }, [year, yearTransactions])

  // Year aggregates
  const yearSummary = useMemo(() => {
    const totalIncome = monthlyTotals.reduce((s, m) => s + m.income, 0)
    const totalExpenses = monthlyTotals.reduce((s, m) => s + m.expenses, 0)
    const netSavings = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0

    // Count active months (with at least 1 transaction) for realistic averages
    const activeMonths = monthlyTotals.filter((m) => m.count > 0).length || 1
    const avgMonthlyExpenses = Math.round((totalExpenses / activeMonths) * 100) / 100
    const avgMonthlyIncome = Math.round((totalIncome / activeMonths) * 100) / 100

    return {
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      activeMonths,
      avgMonthlyExpenses,
      avgMonthlyIncome,
    }
  }, [monthlyTotals])

  // Category matrix (Category x 12 months)
  const categoryMatrix = useMemo(() => {
    const buildRow = (cat) => {
      const byMonth = MONTH_KEYS.map((mKey) => {
        const monthStr = `${year}-${mKey}`
        return yearTransactions
          .filter((t) => t.categoryId === cat.id && t.date.startsWith(monthStr))
          .reduce((sum, t) => sum + t.amount, 0)
      })
      const total = byMonth.reduce((s, a) => s + a, 0)
      const activeCount = byMonth.filter((a) => a > 0).length || 1
      const avg = Math.round((total / (yearSummary.activeMonths || 1)) * 100) / 100

      return {
        ...cat,
        byMonth,
        total,
        avg,
      }
    }

    // Sort categories by total spending descending
    return {
      expenses: expenseCategories
        .map(buildRow)
        .sort((a, b) => b.total - a.total),
      income: incomeCategories
        .map(buildRow)
        .sort((a, b) => b.total - a.total),
    }
  }, [expenseCategories, incomeCategories, year, yearTransactions, yearSummary.activeMonths])

  // Monthly chart data
  const chartData = useMemo(() => {
    return monthlyTotals.map((m) => ({
      name: m.label,
      Income: m.income,
      Expenses: m.expenses,
      Savings: m.savings,
    }))
  }, [monthlyTotals])

  function exportYearCsv() {
    const header = ['Category', 'Type', ...MONTH_LABELS, 'Total (PLN)', 'Avg/Month']
    const lines = [header.join(';')]

    // Summary lines
    lines.push(
      ['Total Income', 'income', ...monthlyTotals.map((m) => m.income.toFixed(2)), yearSummary.totalIncome.toFixed(2), yearSummary.avgMonthlyIncome.toFixed(2)].join(';'),
    )
    lines.push(
      ['Total Expenses', 'expense', ...monthlyTotals.map((m) => m.expenses.toFixed(2)), yearSummary.totalExpenses.toFixed(2), yearSummary.avgMonthlyExpenses.toFixed(2)].join(';'),
    )
    lines.push(
      ['Net Savings', 'savings', ...monthlyTotals.map((m) => m.savings.toFixed(2)), yearSummary.netSavings.toFixed(2), '-'].join(';'),
    )

    // Expense categories
    categoryMatrix.expenses.forEach((c) => {
      lines.push(
        [
          `"${c.name}"`,
          'expense',
          ...c.byMonth.map((a) => a.toFixed(2)),
          c.total.toFixed(2),
          c.avg.toFixed(2),
        ].join(';'),
      )
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Expense_Tracker_${year}_Year_Summary.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="year-view-page">
      {/* View Mode Toggle: Single Year vs Compare Seasons vs Compare Years */}
      <div className="year-mode-bar">
        <div className="view-mode-toggle" role="tablist" aria-label="Analytics View Mode">
          <button
            type="button"
            className={`mode-btn ${viewMode === 'single' ? 'active' : ''}`}
            onClick={() => setViewMode('single')}
          >
            12-Month Matrix
          </button>
          <button
            type="button"
            className={`mode-btn ${viewMode === 'seasons' ? 'active' : ''}`}
            onClick={() => setViewMode('seasons')}
          >
            Compare Seasons
          </button>
          <button
            type="button"
            className={`mode-btn ${viewMode === 'compare' ? 'active' : ''}`}
            onClick={() => setViewMode('compare')}
          >
            Compare Years (YoY)
          </button>
        </div>
      </div>

      {viewMode === 'compare' ? (
        <YearComparisonView
          transactions={transactions}
          categories={categories}
          defaultYearA={year}
          defaultYearB={year + 1}
        />
      ) : viewMode === 'seasons' ? (
        <SeasonComparisonView
          transactions={transactions}
          categories={categories}
          categoryMap={categoryMap}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
        />
      ) : (
        <>
          {/* Year Selector Header */}
          <div className="year-header-panel panel">
        <div className="year-stepper">
          <button
            type="button"
            className="icon-btn"
            disabled={year <= minYear}
            onClick={() => setYear((y) => Math.max(minYear, y - 1))}
            aria-label="Previous year"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="year-title">{year} Year Overview</h1>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setYear((y) => y + 1)}
            aria-label="Next year"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <button
          type="button"
          className="btn"
          onClick={exportYearCsv}
          aria-label="Export Year Table to CSV"
        >
          <Download size={16} />
          <span>Export {year} CSV</span>
        </button>
      </div>

      {/* 4 Annual Metric Cards */}
      <section className="cards">
        <div className="card income">
          <div className="card-head">
            <TrendingUp size={18} />
            <span>Annual Income</span>
          </div>
          <div className="card-value">{formatMoney(yearSummary.totalIncome)}</div>
          <div className="card-subtext muted small">
            Avg {formatMoney(yearSummary.avgMonthlyIncome)} / month
          </div>
        </div>

        <div className="card expense">
          <div className="card-head">
            <TrendingDown size={18} />
            <span>Annual Expenses</span>
          </div>
          <div className="card-value">{formatMoney(yearSummary.totalExpenses)}</div>
          <div className="card-subtext muted small">
            Avg {formatMoney(yearSummary.avgMonthlyExpenses)} / month
          </div>
        </div>

        <div className="card savings">
          <div className="card-head">
            <PiggyBank size={18} />
            <span>Net Savings</span>
          </div>
          <div className="card-value">{formatMoney(yearSummary.netSavings)}</div>
          <div className="card-subtext muted small">
            {yearSummary.savingsRate}% annual savings rate
          </div>
        </div>

        <div className="card neutral">
          <div className="card-head">
            <Calculator size={18} />
            <span>Active Months</span>
          </div>
          <div className="card-value">
            {yearSummary.activeMonths} / 12
          </div>
          <div className="card-subtext muted small">
            Months with recorded data
          </div>
        </div>
      </section>

      {/* Annual Monthly Trend Chart */}
      <div className="panel chart-panel">
        <div className="panel-title-row">
          <h2>Monthly Income vs. Expenses ({year})</h2>
          <span className="muted small">All 12 months</span>
        </div>

        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <Bar dataKey="Income" fill="#337a6b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#b78055" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full Month x Category Matrix Table */}
      <section className="panel year-matrix-panel">
        <div className="panel-title-row">
          <div>
            <h2>Category Breakdown by Month</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              Complete matrix of spending per category across {year}. Click any month name to view that month's dashboard.
            </p>
          </div>
        </div>

        <div className="year-matrix-wrapper">
          <table className="year-matrix-table">
            <thead>
              <tr>
                <th className="sticky-col">Category</th>
                {monthlyTotals.map((m) => (
                  <th key={m.key} className="month-col-header">
                    <button
                      type="button"
                      className="month-jump-btn"
                      onClick={() => onSelectMonth && onSelectMonth(m.monthStr)}
                      title={`Jump to ${m.label} ${year}`}
                    >
                      <span>{m.label}</span>
                    </button>
                  </th>
                ))}
                <th className="total-col-header">Total ({year})</th>
                <th className="avg-col-header">Avg / Mo</th>
              </tr>
            </thead>
            <tbody>
              {/* Summary Rows at the Top */}
              <tr className="matrix-summary-row income">
                <td className="sticky-col">
                  <strong>📈 Total Income</strong>
                </td>
                {monthlyTotals.map((m) => (
                  <td key={m.key} className="amount-cell income">
                    {m.income > 0 ? formatMoney(m.income) : '—'}
                  </td>
                ))}
                <td className="total-cell income">
                  <strong>{formatMoney(yearSummary.totalIncome)}</strong>
                </td>
                <td className="avg-cell income">
                  <strong>{formatMoney(yearSummary.avgMonthlyIncome)}</strong>
                </td>
              </tr>

              <tr className="matrix-summary-row expense">
                <td className="sticky-col">
                  <strong>📉 Total Expenses</strong>
                </td>
                {monthlyTotals.map((m) => (
                  <td key={m.key} className="amount-cell expense">
                    {m.expenses > 0 ? formatMoney(m.expenses) : '—'}
                  </td>
                ))}
                <td className="total-cell expense">
                  <strong>{formatMoney(yearSummary.totalExpenses)}</strong>
                </td>
                <td className="avg-cell expense">
                  <strong>{formatMoney(yearSummary.avgMonthlyExpenses)}</strong>
                </td>
              </tr>

              <tr className="matrix-summary-row savings">
                <td className="sticky-col">
                  <strong>💰 Net Savings</strong>
                </td>
                {monthlyTotals.map((m) => (
                  <td key={m.key} className={`amount-cell ${m.savings >= 0 ? 'income' : 'expense'}`}>
                    {m.count > 0 ? formatMoney(m.savings) : '—'}
                  </td>
                ))}
                <td className={`total-cell ${yearSummary.netSavings >= 0 ? 'income' : 'expense'}`}>
                  <strong>{formatMoney(yearSummary.netSavings)}</strong>
                </td>
                <td className="avg-cell muted">—</td>
              </tr>

              {/* Separator */}
              <tr className="matrix-divider-row">
                <td colSpan={15}>
                  <span className="divider-label">Expense Categories</span>
                </td>
              </tr>

              {/* Individual Expense Categories */}
              {categoryMatrix.expenses.map((cat) => (
                <tr key={cat.id} className="matrix-category-row">
                  <td className="sticky-col cat-cell">
                    <span className="swatch" style={{ background: cat.color }} />
                    <span className="cat-emoji">{cat.emoji}</span>
                    <span className="cat-name">{cat.name}</span>
                  </td>
                  {cat.byMonth.map((amount, idx) => (
                    <td key={idx} className="amount-cell">
                      {amount > 0 ? formatMoney(amount) : '—'}
                    </td>
                  ))}
                  <td className="total-cell">
                    <strong>{cat.total > 0 ? formatMoney(cat.total) : '—'}</strong>
                  </td>
                  <td className="avg-cell muted">
                    {cat.total > 0 ? formatMoney(cat.avg) : '—'}
                  </td>
                </tr>
              ))}

              {categoryMatrix.expenses.length === 0 && (
                <tr>
                  <td colSpan={15} className="empty-list muted">
                    No expense categories recorded for {year}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}
    </div>
  )
}
