import { useMemo, useState } from 'react'
import { Pencil, Trash2, Search } from 'lucide-react'
import {
  getTransactions,
  getCategories,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '../storage.js'
import { formatDate, formatMoney, formatMonth, todayISO } from '../format.js'
import TransactionForm from '../components/TransactionForm.jsx'

export default function Transactions({ month }) {
  const [transactions, setTransactions] = useState(getTransactions)
  const [categories] = useState(getCategories)
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // all | income | expense
  const [categoryFilter, setCategoryFilter] = useState('all') // all | none | <category id>

  const refresh = () => setTransactions(getTransactions())
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // Date proposed in the "add" form: today if it is in the selected month, else the 1st of it.
  const today = todayISO()
  const defaultDate = today.startsWith(month) ? today : `${month}-01`

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions
      .filter((t) => t.date.startsWith(month))
      .filter((t) => typeFilter === 'all' || t.type === typeFilter)
      .filter((t) => {
        if (categoryFilter === 'all') return true
        if (categoryFilter === 'none') return !t.categoryId || !categoryById.has(t.categoryId)
        return t.categoryId === categoryFilter
      })
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [transactions, month, typeFilter, categoryFilter, search, categoryById])

  const totals = shown.reduce(
    (acc, t) => {
      acc[t.type] += t.amount
      return acc
    },
    { income: 0, expense: 0 },
  )
  const monthCount = transactions.filter((t) => t.date.startsWith(month)).length
  const filtering = search.trim() || typeFilter !== 'all' || categoryFilter !== 'all'

  function handleAdd(values) {
    const tx = addTransaction(values)
    refresh()
    setNotice(
      tx.date.startsWith(month)
        ? 'Added ✓'
        : `Added ✓ to ${formatMonth(tx.date.slice(0, 7))} (not the month you are viewing)`,
    )
  }

  function handleDelete(t) {
    const label = t.title || 'this transaction'
    if (window.confirm(`Delete "${label}" (${formatMoney(t.amount)}, ${formatDate(t.date)})?`)) {
      deleteTransaction(t.id)
      refresh()
    }
  }

  return (
    <div className="transactions">
      <section className="panel">
        <h2>Add transaction</h2>
        <TransactionForm
          key={month}
          categories={categories}
          transactions={transactions}
          initial={{ type: 'expense', date: defaultDate, amount: '', title: '', categoryId: '' }}
          submitLabel="Add"
          resetAfterSubmit
          onSubmit={handleAdd}
        />
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>
          {formatMonth(month)} <span className="count">{monthCount}</span>
        </h2>

        <div className="filters">
          <label className="search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title…"
              aria-label="Search"
            />
          </label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type">
            <option value="all">Income & expenses</option>
            <option value="expense">Expenses only</option>
            <option value="income">Income only</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            <optgroup label="Expenses">
              {categories
                .filter((c) => c.type === 'expense')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Income">
              {categories
                .filter((c) => c.type === 'income')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
            </optgroup>
            <option value="none">Uncategorized</option>
          </select>
        </div>

        {shown.length === 0 ? (
          <p className="muted empty-list">
            {filtering ? 'No transactions match your filters.' : `No transactions in ${formatMonth(month)} yet.`}
          </p>
        ) : (
          <>
            <ul className="tx-list">
              {shown.map((t) =>
                editingId === t.id ? (
                  <li key={t.id}>
                    <TransactionForm
                      categories={categories}
                      transactions={transactions}
                      initial={{
                        type: t.type,
                        date: t.date,
                        amount: String(t.amount),
                        title: t.title,
                        categoryId: t.categoryId ?? '',
                      }}
                      submitLabel="Save"
                      onSubmit={(values) => {
                        updateTransaction(t.id, values)
                        setEditingId(null)
                        refresh()
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <TransactionRow
                    key={t.id}
                    t={t}
                    category={categoryById.get(t.categoryId)}
                    onEdit={() => setEditingId(t.id)}
                    onDelete={() => handleDelete(t)}
                  />
                ),
              )}
            </ul>
            <p className="tx-summary muted">
              {shown.length} shown · Income <strong>{formatMoney(totals.income)}</strong> · Expenses{' '}
              <strong>{formatMoney(totals.expense)}</strong>
            </p>
          </>
        )}
      </section>
    </div>
  )
}

function TransactionRow({ t, category, onEdit, onDelete }) {
  return (
    <li className="tx-row">
      <span className="tx-date">{formatDate(t.date)}</span>
      <span className="tx-cat" title={category?.name ?? 'Uncategorized'}>
        <span className="swatch" style={{ background: category?.color ?? '#cccccc' }} />
        {category ? `${category.emoji} ${category.name}` : 'Uncategorized'}
      </span>
      <span className="tx-title">{t.title || <span className="muted">(no title)</span>}</span>
      <span className={`tx-amount ${t.type}`}>
        {t.type === 'income' ? '+' : '−'}
        {formatMoney(t.amount)}
      </span>
      <span className="row-actions">
        <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${t.title || 'transaction'}`}>
          <Pencil size={16} />
        </button>
        <button className="icon-btn danger" onClick={onDelete} aria-label={`Delete ${t.title || 'transaction'}`}>
          <Trash2 size={16} />
        </button>
      </span>
    </li>
  )
}
