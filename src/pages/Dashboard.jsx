import { useState, useMemo, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Target,
  Sparkles,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  Pencil,
  Check,
} from 'lucide-react'
import {
  getTransactions,
  getTransactionsForMonth,
  getCategories,
  getBudgets,
  setBudget,
} from '../storage.js'
import { formatMoney, formatMonth, formatDate } from '../format.js'
import CategoryPieChart from '../components/CategoryPieChart.jsx'

export default function Dashboard({ month, onNavigateTab }) {
  const [dataVersion, setDataVersion] = useState(0)
  const refresh = () => setDataVersion((v) => v + 1)

  const allTransactions = useMemo(() => getTransactions(), [dataVersion])
  const transactions = useMemo(() => getTransactionsForMonth(month), [month, dataVersion])
  const categories = useMemo(() => getCategories(), [dataVersion])
  const budgets = useMemo(() => getBudgets(month), [month, dataVersion])

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]))
  }, [categories])

  const budgetMap = useMemo(() => {
    return new Map(budgets.map((b) => [b.categoryId, b.planned]))
  }, [budgets])

  // Average monthly spending per category from active months (matching Avg/Mo from Analytics matrix)
  const avgMap = useMemo(() => {
    const yearPrefix = `${month.slice(0, 4)}-`
    const yearTxs = allTransactions.filter((t) => t.date.startsWith(yearPrefix))
    const targetTxs = yearTxs.length > 0 ? yearTxs : allTransactions

    const activeMonths = new Set(targetTxs.map((t) => t.date.slice(0, 7)))
    const activeCount = activeMonths.size || 1

    const map = new Map()
    for (const cat of categories) {
      const total = targetTxs
        .filter((t) => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0)
      map.set(cat.id, Math.round((total / activeCount) * 100) / 100)
    }
    return map
  }, [allTransactions, categories, month])

  // --- Summary metrics for the 4 top cards (100% original behavior)
  const totals = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    const savings = income - expenses
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0

    const plannedIncome = categories
      .filter((c) => c.type === 'income')
      .reduce((sum, c) => sum + (budgetMap.get(c.id) || 0), 0)

    return {
      income,
      expenses,
      savings,
      savingsRate,
      plannedIncome,
      count: transactions.length,
    }
  }, [transactions, categories, budgetMap])

  // --- Category breakdown for expenses
  const expenseCategories = useMemo(() => {
    const groups = new Map()

    for (const t of transactions) {
      if (t.type !== 'expense') continue
      const cat = categoryMap.get(t.categoryId)
      const key = cat ? cat.id : 'uncategorized'
      const existing = groups.get(key) || {
        id: key,
        name: cat ? cat.name : 'Uncategorized',
        emoji: cat ? cat.emoji : '❓',
        color: cat ? cat.color : '#94a3b8',
        actual: 0,
        count: 0,
      }
      existing.actual += t.amount
      existing.count += 1
      groups.set(key, existing)
    }

    const list = Array.from(groups.values()).map((item) => ({
      ...item,
      value: Math.round(item.actual * 100) / 100,
      percentage: totals.expenses > 0 ? Math.round((item.actual / totals.expenses) * 100) : 0,
    }))

    return list.sort((a, b) => b.actual - a.actual)
  }, [transactions, categoryMap, totals.expenses])

  // --- Top 5 largest single expenses
  const topExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [transactions])

  // --- Planned vs Actual rows for all categories
  const budgetRows = useMemo(() => {
    const expenseList = categories.filter((c) => c.type === 'expense')
    const incomeList = categories.filter((c) => c.type === 'income')

    const calcRow = (cat) => {
      // Precalculated based on Avg/Mo column unless user set an explicit custom budget
      const planned = budgetMap.has(cat.id) ? (budgetMap.get(cat.id) || 0) : (avgMap.get(cat.id) || 0)
      const actual = transactions
        .filter((t) => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0)
      const diff = cat.type === 'expense' ? actual - planned : actual - planned
      const isOver = cat.type === 'expense' ? planned > 0 && actual > planned : false
      const percentUsed = planned > 0 ? Math.round((actual / planned) * 100) : null

      return {
        ...cat,
        planned,
        actual: Math.round(actual * 100) / 100,
        diff: Math.round(diff * 100) / 100,
        isOver,
        percentUsed,
      }
    }

    return {
      expenses: expenseList.map(calcRow).sort((a, b) => b.actual - a.actual || b.planned - a.planned),
      income: incomeList.map(calcRow).sort((a, b) => b.actual - a.actual),
    }
  }, [categories, budgetMap, avgMap, transactions])

  const tablePlannedExpenses = useMemo(() => {
    return budgetRows.expenses.reduce((sum, r) => sum + r.planned, 0)
  }, [budgetRows.expenses])

  return (
    <div className="dashboard-page">
      {/* Motivational / Status Banner (reproducing Excel logic) */}
      <div className={`insight-banner ${totals.savings >= 0 && totals.count > 0 ? 'positive' : totals.expenses > totals.income ? 'warning' : 'neutral'}`}>
        <div className="insight-icon">
          {totals.count === 0 ? (
            <Sparkles size={22} />
          ) : totals.savings >= 0 ? (
            <Flame size={22} className="flame-icon" />
          ) : (
            <AlertTriangle size={22} className="alert-icon" />
          )}
        </div>
        <div className="insight-text">
          {totals.count === 0 ? (
            <span>No transactions in {formatMonth(month)} yet. Log transactions or import a CSV statement to unlock insights!</span>
          ) : totals.savings >= 0 ? (
            <span>
              <strong>Woohoo!</strong> Your income was greater than your expenses in {formatMonth(month)}. You saved{' '}
              <strong>{formatMoney(totals.savings)}</strong> ({totals.savingsRate}% savings rate)!
            </span>
          ) : (
            <span>
              <strong>Heads up:</strong> You spent <strong>{formatMoney(Math.abs(totals.savings))}</strong> more than you earned in {formatMonth(month)}. Review your biggest expense categories below to find areas to save.
            </span>
          )}
        </div>
      </div>

      {/* 4 Summary Metric Cards (exact original cards and structure) */}
      <section className="cards">
        <SummaryCard
          label="Income"
          value={totals.income}
          subtext={totals.plannedIncome > 0 ? `Budget: ${formatMoney(totals.plannedIncome)}` : undefined}
          icon={TrendingUp}
          tone="income"
        />
        <SummaryCard
          label="Expenses"
          value={totals.expenses}
          subtext={tablePlannedExpenses > 0 ? `Budget: ${formatMoney(tablePlannedExpenses)}` : undefined}
          icon={TrendingDown}
          tone="expense"
        />
        <SummaryCard
          label="Net Savings"
          value={totals.savings}
          subtext={totals.income > 0 ? `${totals.savingsRate}% of income saved` : undefined}
          icon={PiggyBank}
          tone="savings"
        />
        <SummaryCard
          label="Budget Status"
          value={
            tablePlannedExpenses > 0
              ? Math.abs(tablePlannedExpenses - totals.expenses)
              : 0
          }
          isCustomDisplay
          customDisplay={
            tablePlannedExpenses > 0
              ? tablePlannedExpenses > totals.expenses
                ? `${formatMoney(tablePlannedExpenses - totals.expenses)} under`
                : tablePlannedExpenses < totals.expenses
                  ? `${formatMoney(totals.expenses - tablePlannedExpenses)} over`
                  : 'On budget'
              : 'No budget set'
          }
          subtext={
            tablePlannedExpenses > 0
              ? `${Math.round((totals.expenses / tablePlannedExpenses) * 100)}% of plan spent`
              : 'Set monthly budgets below'
          }
          icon={Target}
          tone={
            tablePlannedExpenses > 0
              ? totals.expenses <= tablePlannedExpenses
                ? 'income'
                : 'expense'
              : 'neutral'
          }
        />
      </section>

      {/* Middle Grid: Expense Breakdown Donut & Top 5 Largest Expenses */}
      <div className="dashboard-grid">
        {/* Left Column: Category Chart & Legend */}
        <div className="panel chart-panel">
          <div className="panel-title-row">
            <h2>Expense Breakdown</h2>
            <span className="count">{expenseCategories.length} categories</span>
          </div>

          <CategoryPieChart data={expenseCategories} />

          <div className="category-legend-list">
            {expenseCategories.map((cat) => (
              <div key={cat.id} className="legend-row">
                <span className="swatch" style={{ background: cat.color }} />
                <span className="legend-emoji">{cat.emoji}</span>
                <span className="legend-name" title={cat.name}>
                  {cat.name}
                </span>
                <span className="legend-pct muted small">{cat.percentage}%</span>
                <span className="legend-amount">
                  <strong>{formatMoney(cat.actual)}</strong>
                </span>
              </div>
            ))}
            {expenseCategories.length === 0 && (
              <p className="muted small text-center">No expense categories to show</p>
            )}
          </div>
        </div>

        {/* Right Column: Top 5 Single Expenses */}
        <div className="panel top-expenses-panel">
          <div className="panel-title-row">
            <h2>Top 5 Biggest Expenses</h2>
            <span className="count">{topExpenses.length} items</span>
          </div>

          {topExpenses.length > 0 ? (
            <ul className="top-expense-list">
              {topExpenses.map((tx, idx) => {
                const cat = categoryMap.get(tx.categoryId)
                return (
                  <li key={tx.id} className="top-expense-item">
                    <div className="rank-badge">#{idx + 1}</div>
                    <div className="top-expense-details">
                      <div className="top-expense-title" title={tx.title}>
                        <strong>{tx.title || 'Untitled expense'}</strong>
                      </div>
                      <div className="top-expense-meta muted small">
                        <span>{formatDate(tx.date)}</span>
                        {cat && (
                          <span className="cat-pill" style={{ background: `${cat.color}15`, color: cat.color }}>
                            {cat.emoji} {cat.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="top-expense-amount">
                      <strong>{formatMoney(tx.amount)}</strong>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="empty-subpanel">
              <p className="muted">No expenses recorded for this month.</p>
            </div>
          )}
        </div>
      </div>

      {/* Planned vs Actual Budget Tracker (Replicating Excel Insights Sheet) */}
      <section className="panel budget-panel">
        <div className="panel-title-row">
          <div>
            <h2>Planned vs. Actual Budget</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              Set your planned limits in the <strong>Planned</strong> column. Budgets save automatically for {formatMonth(month)}.
            </p>
          </div>
          <div className="budget-summary-pills">
            <span className="pill green">
              Planned: {formatMoney(tablePlannedExpenses)}
            </span>
            <span className="pill gray">
              Actual: {formatMoney(totals.expenses)}
            </span>
          </div>
        </div>

        <div className="budget-table-wrapper">
          <table className="budget-table">
            <thead>
              <tr>
                <th>Category</th>
                <th style={{ width: '140px' }}>Planned (PLN)</th>
                <th style={{ width: '130px' }}>Actual</th>
                <th style={{ width: '140px' }}>Difference</th>
                <th style={{ width: '200px' }}>Budget Progress</th>
              </tr>
            </thead>
            <tbody>
              {budgetRows.expenses.map((row) => (
                <BudgetRow
                  key={row.id}
                  row={row}
                  month={month}
                  onBudgetChanged={refresh}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="budget-totals-row">
                <td>
                  <strong>Total Expenses</strong>
                </td>
                <td>
                  <strong>{formatMoney(tablePlannedExpenses)}</strong>
                </td>
                <td>
                  <strong>{formatMoney(totals.expenses)}</strong>
                </td>
                <td className={totals.expenses > tablePlannedExpenses && tablePlannedExpenses > 0 ? 'over' : ''}>
                  <strong>
                    {tablePlannedExpenses > 0
                      ? tablePlannedExpenses >= totals.expenses
                        ? `+${formatMoney(tablePlannedExpenses - totals.expenses)} left`
                        : `−${formatMoney(totals.expenses - tablePlannedExpenses)} over`
                      : '—'}
                  </strong>
                </td>
                <td>
                  {tablePlannedExpenses > 0 ? (
                    <div className="progress-container">
                      <div
                        className={`progress-fill ${totals.expenses > tablePlannedExpenses ? 'danger' : 'normal'}`}
                        style={{
                          width: `${Math.min(100, Math.round((totals.expenses / tablePlannedExpenses) * 100))}%`,
                        }}
                      />
                      <span className="progress-text small">
                        {Math.round((totals.expenses / tablePlannedExpenses) * 100)}%
                      </span>
                    </div>
                  ) : (
                    <span className="muted small">—</span>
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

function SummaryCard({ label, value, subtext, icon: Icon, tone, isCustomDisplay, customDisplay }) {
  return (
    <div className={`card ${tone}`}>
      <div className="card-head">
        <Icon size={18} />
        <span>{label}</span>
      </div>
      <div className="card-value">
        {isCustomDisplay ? customDisplay : formatMoney(value)}
      </div>
      {subtext && <div className="card-subtext muted small">{subtext}</div>}
    </div>
  )
}

function BudgetRow({ row, month, onBudgetChanged }) {
  const [val, setVal] = useState(row.planned ? String(row.planned) : '')
  const [isEditing, setIsEditing] = useState(false)

  // Keep input in sync with row.planned when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setVal(row.planned ? String(row.planned) : '')
    }
  }, [row.planned, isEditing])

  function save() {
    const num = Number(val.replace(',', '.'))
    if (!Number.isFinite(num) || num < 0) {
      setVal(row.planned ? String(row.planned) : '')
    } else {
      setBudget(row.id, month, num)
      onBudgetChanged()
    }
    setIsEditing(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') save()
    else if (e.key === 'Escape') {
      setVal(row.planned ? String(row.planned) : '')
      setIsEditing(false)
    }
  }

  return (
    <tr className="budget-row">
      <td className="cat-cell">
        <div className="cat-cell-inner">
          <span className="swatch" style={{ background: row.color }} />
          <span className="cat-emoji">{row.emoji}</span>
          <span className="cat-name">{row.name}</span>
        </div>
      </td>

      <td className="planned-cell">
        {isEditing ? (
          <div className="inline-edit-box">
            <input
              type="text"
              className="inline-input"
              value={val}
              autoFocus
              onChange={(e) => setVal(e.target.value)}
              onBlur={save}
              onKeyDown={handleKeyDown}
              placeholder="0"
              aria-label={`Planned budget for ${row.name}`}
            />
            <button type="button" className="icon-btn small save-btn" onClick={save}>
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="editable-budget-btn"
            onClick={() => setIsEditing(true)}
            title="Click to edit planned budget"
            aria-label={`Edit planned budget for ${row.name}`}
          >
            <span>{row.planned > 0 ? formatMoney(row.planned) : '0,00 zł'}</span>
            <Pencil size={13} className="pencil-icon" />
          </button>
        )}
      </td>

      <td className="actual-cell">
        <strong>{formatMoney(row.actual)}</strong>
      </td>

      <td className={`diff-cell ${row.isOver ? 'over' : row.planned > 0 ? 'under' : ''}`}>
        {row.planned > 0 ? (
          row.isOver ? (
            <span className="diff-pill danger">−{formatMoney(row.actual - row.planned)} over</span>
          ) : (
            <span className="diff-pill success">+{formatMoney(row.planned - row.actual)} left</span>
          )
        ) : (
          <span className="muted">—</span>
        )}
      </td>

      <td className="progress-cell">
        {row.planned > 0 ? (
          <div className="progress-container">
            <div
              className={`progress-fill ${row.isOver ? 'danger' : 'normal'}`}
              style={{
                width: `${Math.min(100, row.percentUsed)}%`,
                backgroundColor: row.isOver ? '#ef4444' : row.color,
              }}
            />
            <span className="progress-text small">{row.percentUsed}%</span>
          </div>
        ) : (
          <span className="muted small">—</span>
        )}
      </td>
    </tr>
  )
}
