import { useEffect, useState } from 'react'
import {
  Wallet,
  LayoutDashboard,
  ListOrdered,
  BarChart3,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react'
import { MIN_MONTH } from './storage.js'
import { currentMonth } from './format.js'
import Settings from './pages/Settings.jsx'
import Transactions from './pages/Transactions.jsx'
import Dashboard from './pages/Dashboard.jsx'
import YearView from './pages/YearView.jsx'
import MonthYearPicker from './components/MonthYearPicker.jsx'
import { getStoredTheme, applyTheme, initTheme } from './theme.js'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ListOrdered },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [selectedMonth, setMonth] = useState(currentMonth)
  const [dataVersion, setDataVersion] = useState(0)
  const [theme, setTheme] = useState(getStoredTheme)

  // Never show a month before the tracker's start, whatever the saved state is
  const month = selectedMonth < MIN_MONTH ? MIN_MONTH : selectedMonth

  useEffect(() => {
    const cleanup = initTheme()
    return cleanup
  }, [])

  function cycleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }

  function handleDataChanged() {
    setDataVersion((v) => v + 1)
  }

  return (
    <div className="app" key={dataVersion}>
      <header className="header">
        <div className="brand">
          <Wallet size={26} />
          <span>Expense Tracker</span>
        </div>

        <div className="header-controls">
          <button
            type="button"
            className="theme-quick-btn"
            title={`Current theme: ${theme}. Click to change.`}
            aria-label={`Current theme: ${theme}. Click to change.`}
            onClick={cycleTheme}
          >
            {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Laptop size={18} />}
          </button>

          <MonthYearPicker month={month} onChange={setMonth} />
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
        {tab === 'dashboard' && <Dashboard month={month} onNavigateTab={setTab} />}
        {tab === 'transactions' && <Transactions month={month} />}
        {tab === 'analytics' && (
          <YearView
            onSelectMonth={(selected) => {
              setMonth(selected)
              setTab('dashboard')
            }}
          />
        )}
        {tab === 'settings' && <Settings onDataChanged={handleDataChanged} />}
      </main>
    </div>
  )
}
