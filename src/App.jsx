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
import Transactions from './pages/Transactions.jsx'
import Dashboard from './pages/Dashboard.jsx'
import YearView from './pages/YearView.jsx'
import MonthYearPicker from './components/MonthYearPicker.jsx'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ListOrdered },
  { id: 'year', label: 'Year', icon: CalendarRange },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [selectedMonth, setMonth] = useState(currentMonth)
  // Never show a month before the tracker's start, whatever the saved state is
  const month = selectedMonth < MIN_MONTH ? MIN_MONTH : selectedMonth
  const atStart = month <= MIN_MONTH

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <Wallet size={26} />
          <span>Expense Tracker</span>
        </div>

        <MonthYearPicker month={month} onChange={setMonth} />
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
        {tab === 'dashboard' && <Dashboard month={month} onNavigateTab={setTab} />}
        {tab === 'transactions' && <Transactions month={month} />}
        {tab === 'year' && (
          <YearView
            onSelectMonth={(selected) => {
              setMonth(selected)
              setTab('dashboard')
            }}
          />
        )}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
