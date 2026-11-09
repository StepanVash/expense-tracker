import { useState, useRef } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  AlertTriangle,
  FileText,
  ShieldAlert,
} from 'lucide-react'
import {
  getCategories,
  getTransactions,
  getBudgets,
  getLearnedRules,
  deleteLearnedRule,
  addCategory,
  updateCategory,
  deleteCategory,
  exportData,
  importData,
  clearAll,
  ensureDefaultCategories,
  MAX_CATEGORY_NAME_LENGTH,
} from '../storage.js'
import { DEFAULT_CATEGORIES, COLOR_PALETTE } from '../defaultCategories.js'
import EmojiPicker from '../components/EmojiPicker.jsx'
import { getStoredTheme, applyTheme } from '../theme.js'

export default function Settings({ onDataChanged }) {
  const [categories, setCategories] = useState(getCategories)
  const [learnedRules, setLearnedRules] = useState(getLearnedRules)
  const [theme, setTheme] = useState(getStoredTheme)
  const [notification, setNotification] = useState(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const fileInputRef = useRef(null)

  const transactions = getTransactions()
  const budgets = getBudgets()

  const refresh = () => {
    setCategories(getCategories())
    setLearnedRules(getLearnedRules())
    if (onDataChanged) onDataChanged()
  }

  // how many transactions use each category
  const usage = transactions.reduce((acc, t) => {
    acc[t.categoryId] = (acc[t.categoryId] || 0) + 1
    return acc
  }, {})

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  function notify(msg, type = 'success') {
    setNotification({ message: msg, type })
    setTimeout(() => {
      setNotification((curr) => (curr?.message === msg ? null : curr))
    }, 4000)
  }

  function handleThemeChange(newTheme) {
    setTheme(newTheme)
    applyTheme(newTheme)
  }

  function handleExportBackup() {
    try {
      const dataStr = exportData()
      const today = new Date().toISOString().slice(0, 10)
      const filename = `expense_tracker_backup_${today}.json`

      const blob = new Blob([dataStr], { type: 'application/json' })
      if (typeof window !== 'undefined' && window.URL && window.URL.createObjectURL) {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
      notify(`Backup exported (${transactions.length} transactions, ${categories.length} categories).`)
    } catch (err) {
      notify(`Export failed: ${err.message}`, 'error')
    }
  }

  function handleRestoreFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result
        if (typeof content !== 'string') throw new Error('Could not read backup file.')
        const parsed = JSON.parse(content)

        const txCount = parsed.transactions?.length ?? 0
        const catCount = parsed.categories?.length ?? 0

        const confirmMsg = `Restore this backup containing ${txCount} transactions and ${catCount} categories?\n\nThis will replace your current data.`
        if (!window.confirm(confirmMsg)) {
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }

        importData(parsed)
        refresh()
        notify(`Backup successfully restored (${txCount} transactions, ${catCount} categories).`)
      } catch (err) {
        notify(`Restore failed: ${err.message}`, 'error')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  function handleResetAll() {
    try {
      clearAll()
      ensureDefaultCategories(DEFAULT_CATEGORIES)
      setResetConfirmOpen(false)
      refresh()
      notify('All data has been reset to defaults.')
    } catch (err) {
      notify(`Reset failed: ${err.message}`, 'error')
    }
  }

  function handleDeleteRule(ruleId, pattern) {
    if (window.confirm(`Forget learned rule for "${pattern}"?`)) {
      deleteLearnedRule(ruleId)
      setLearnedRules(getLearnedRules())
      notify(`Forgot learned rule for "${pattern}".`)
    }
  }

  return (
    <div className="settings">
      {notification && (
        <div className={`notification-banner ${notification.type === 'error' ? 'error' : 'success'}`}>
          {notification.type === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Theme / Appearance Panel */}
      <section className="panel">
        <h2>Appearance & Theme</h2>
        <p className="muted small">Choose your preferred interface theme.</p>
        <div className="theme-toggle-group">
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => handleThemeChange('light')}
          >
            <Sun size={18} />
            <span>Light</span>
          </button>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => handleThemeChange('dark')}
          >
            <Moon size={18} />
            <span>Dark</span>
          </button>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'system' ? 'active' : ''}`}
            onClick={() => handleThemeChange('system')}
          >
            <Laptop size={18} />
            <span>System</span>
          </button>
        </div>
      </section>

      {/* Expense Categories */}
      <CategorySection
        title="Expense categories"
        type="expense"
        categories={categories.filter((c) => c.type === 'expense')}
        usage={usage}
        onChange={refresh}
      />

      {/* Income Categories */}
      <CategorySection
        title="Income categories"
        type="income"
        categories={categories.filter((c) => c.type === 'income')}
        usage={usage}
        onChange={refresh}
      />

      {/* Auto-learning Rules */}
      <section className="panel">
        <div className="panel-header-with-badge">
          <h2>
            Learned Merchant Rules <span className="count">{learnedRules.length}</span>
          </h2>
        </div>
        <p className="muted small">
          When you categorize transactions during bank CSV imports, the tracker remembers the merchant pattern so future
          statements are categorized automatically.
        </p>

        {learnedRules.length === 0 ? (
          <p className="empty-state-text">No learned merchant rules yet. Rules are created automatically when you categorize items during CSV import.</p>
        ) : (
          <ul className="learned-rules-list">
            {learnedRules.map((rule) => {
              const cat = categoryMap.get(rule.categoryId)
              return (
                <li key={rule.id} className="learned-rule-row">
                  <div className="rule-pattern">
                    <Sparkles size={15} className="rule-icon" />
                    <code>"{rule.pattern}"</code>
                  </div>
                  <div className="rule-target">
                    {cat ? (
                      <span className="category-pill" style={{ borderColor: cat.color }}>
                        <span>{cat.emoji}</span>
                        <span>{cat.name}</span>
                      </span>
                    ) : (
                      <span className="muted small">Uncategorized</span>
                    )}
                    <span className="rule-type-badge">{rule.type}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title={`Delete rule for "${rule.pattern}"`}
                    aria-label={`Delete rule for "${rule.pattern}"`}
                    onClick={() => handleDeleteRule(rule.id, rule.pattern)}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Data Management & Backups */}
      <section className="panel">
        <h2>Data & Backups</h2>
        <p className="muted small">
          Export your entire tracking history to a single backup file or restore previously saved data.
        </p>

        <div className="backup-stats-row">
          <div className="stat-pill">
            <span className="stat-val">{transactions.length}</span>
            <span className="stat-lbl">Transactions</span>
          </div>
          <div className="stat-pill">
            <span className="stat-val">{categories.length}</span>
            <span className="stat-lbl">Categories</span>
          </div>
          <div className="stat-pill">
            <span className="stat-val">{budgets.length}</span>
            <span className="stat-lbl">Budgets</span>
          </div>
          <div className="stat-pill">
            <span className="stat-val">{learnedRules.length}</span>
            <span className="stat-lbl">Learned Rules</span>
          </div>
        </div>

        <div className="backup-actions">
          <button type="button" className="btn primary" onClick={handleExportBackup}>
            <Download size={16} />
            <span>Download Backup (.json)</span>
          </button>

          <label className="btn secondary file-upload-btn">
            <Upload size={16} />
            <span>Restore from Backup</span>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleRestoreFile}
            />
          </label>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="panel danger-panel">
        <div className="danger-panel-header">
          <ShieldAlert size={20} className="danger-icon" />
          <h2>Danger Zone</h2>
        </div>
        <p className="muted small">
          Permanently erase all transactions, planned budgets, and custom learned rules. Default categories will be re-seeded.
        </p>

        {!resetConfirmOpen ? (
          <button type="button" className="btn danger-btn" onClick={() => setResetConfirmOpen(true)}>
            <RotateCcw size={16} />
            <span>Reset All Data</span>
          </button>
        ) : (
          <div className="reset-confirm-box">
            <p className="confirm-warning">
              ⚠️ Are you sure you want to reset all data? This action cannot be undone.
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn danger-btn" onClick={handleResetAll}>
                Yes, reset everything
              </button>
              <button type="button" className="btn" onClick={() => setResetConfirmOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function CategorySection({ title, type, categories, usage, onChange }) {
  const [editingId, setEditingId] = useState(null)

  return (
    <section className="panel">
      <h2>
        {title} <span className="count">{categories.length}</span>
      </h2>

      <ul className="category-list">
        {categories.map((cat) =>
          editingId === cat.id ? (
            <li key={cat.id}>
              <CategoryForm
                initial={cat}
                submitLabel="Save"
                onSubmit={(values) => {
                  updateCategory(cat.id, values)
                  setEditingId(null)
                  onChange()
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={cat.id} className="category-row">
              <span className="swatch" style={{ background: cat.color }} />
              <span className="emoji">{cat.emoji}</span>
              <span className="name">{cat.name}</span>
              {usage[cat.id] > 0 && <span className="muted small">{usage[cat.id]} transactions</span>}
              <div className="row-actions">
                <button className="icon-btn" onClick={() => setEditingId(cat.id)} aria-label={`Edit ${cat.name}`}>
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn danger"
                  aria-label={`Delete ${cat.name}`}
                  onClick={() => {
                    const n = usage[cat.id] || 0
                    const msg =
                      n > 0
                        ? `Delete "${cat.name}"? Its ${n} transactions will stay but become "Uncategorized".`
                        : `Delete "${cat.name}"?`
                    if (window.confirm(msg)) {
                      deleteCategory(cat.id)
                      onChange()
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      <div className="add-category">
        <CategoryForm
          initial={{ type, emoji: '', name: '', color: COLOR_PALETTE[categories.length % COLOR_PALETTE.length] }}
          submitLabel="Add"
          resetAfterSubmit
          onSubmit={(values) => {
            addCategory({ ...values, type })
            onChange()
          }}
        />
      </div>
    </section>
  )
}

/** Small inline form used both for adding and for editing a category. */
function CategoryForm({ initial, submitLabel, onSubmit, onCancel, resetAfterSubmit = false }) {
  const [emoji, setEmoji] = useState(initial.emoji)
  const [name, setName] = useState(initial.name)
  const [color, setColor] = useState(initial.color)
  const [error, setError] = useState('')

  function handleNameChange(e) {
    const symbols = [...e.target.value]
    if (symbols.length > MAX_CATEGORY_NAME_LENGTH) {
      setName(symbols.slice(0, MAX_CATEGORY_NAME_LENGTH).join(''))
      setError(`Category name cannot be longer than ${MAX_CATEGORY_NAME_LENGTH} symbols.`)
    } else {
      setName(e.target.value)
      setError('')
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    try {
      onSubmit({ emoji, name, color })
      setError('')
      if (resetAfterSubmit) {
        setEmoji('')
        setName('')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="category-form" onSubmit={handleSubmit}>
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <input
        className="name-input"
        value={name}
        onChange={handleNameChange}
        placeholder={submitLabel === 'Add' ? 'New category name' : 'Name'}
        aria-label="Category name"
        autoFocus={!!onCancel}
      />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Colour" />
      <button type="submit" className="btn primary">
        {submitLabel === 'Add' ? <Plus size={16} /> : <Check size={16} />}
        <span>{submitLabel}</span>
      </button>
      {onCancel && (
        <button type="button" className="btn" onClick={onCancel}>
          <X size={16} />
          <span>Cancel</span>
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  )
}
