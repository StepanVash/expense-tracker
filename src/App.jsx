import { useMemo, useState } from 'react'
import {
  Wallet,
  LayoutDashboard,
  ListOrdered,
  CalendarRange,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
} from 'lucide-react'
import { getTransactionsForMonth, MIN_MONTH } from './storage.js'
import { formatMoney, formatMonth, currentMonth, shiftMonth } from './format.js'
import Settings from './pages/Settings.jsx'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ListOrdered },
  { id: 'year', label: 'Year', icon: CalendarRange },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

const COMING_SOON = {
  transactions: { step: 3, text: 'Add, edit, search and filter your income and expenses.' },
  year: { step: 6, text: 'Month × category table and yearly trends (replaces the "2026" sheet).' },
}

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [month, setMonth] = useState(() => {
    const now = currentMonth()
    return now < MIN_MONTH ? MIN_MONTH : now
  })
  const atStart = month <= MIN_MONTH

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <Wallet size={26} />
          <span>Expense Tracker</span>
        </div>

        <div className="month-picker" aria-label="Selected month">
          <button
            className="icon-btn"
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={atStart}
            aria-label="Previous month"
            title={atStart ? 'The tracker starts in January 2026' : undefined}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="month-label">{formatMonth(month)}</span>
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'dashboard' && <Dashboard month={month} />}
        {tab === 'settings' && <Settings />}
        {COMING_SOON[tab] && <ComingSoon {...COMING_SOON[tab]} />}
      </main>
    </div>
  )
}

function Dashboard({ month }) {
  const totals = useMemo(() => {
    const txs = getTransactionsForMonth(month)
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expenses, savings: income - expenses, count: txs.length }
  }, [month])

  return (
    <>
      <section className="cards">
        <SummaryCard label="Income" value={totals.income} icon={TrendingUp} tone="income" />
        <SummaryCard label="Expenses" value={totals.expenses} icon={TrendingDown} tone="expense" />
        <SummaryCard label="Savings" value={totals.savings} icon={PiggyBank} tone="savings" />
      </section>

      {totals.count === 0 && (
        <div className="empty">
          <p>No transactions in {formatMonth(month)} yet.</p>
          <p className="muted">Adding transactions comes in Step 3, and importing your Excel file in Step 5.</p>
        </div>
      )}
    </>
  )
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  return (
    <div className={`card ${tone}`}>
      <div className="card-head">
        <Icon size={18} />
        <span>{label}</span>
      </div>
      <div className="card-value">{formatMoney(value)}</div>
    </div>
  )
}

function ComingSoon({ step, text }) {
  return (
    <div className="empty">
      <p>🚧 Coming in Step {step}</p>
      <p className="muted">{text}</p>
    </div>
  )
}
