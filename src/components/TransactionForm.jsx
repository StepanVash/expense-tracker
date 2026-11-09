import { useState } from 'react'
import { Plus, Check, X } from 'lucide-react'
import { MIN_DATE } from '../storage.js'
import { suggestCategoryId } from '../suggest.js'

/** Form used both for adding a new transaction and for editing an existing one. */
export default function TransactionForm({
  categories,
  transactions,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  resetAfterSubmit = false,
}) {
  const editing = !!onCancel
  const [type, setType] = useState(initial.type)
  const [date, setDate] = useState(initial.date)
  const [amount, setAmount] = useState(initial.amount)
  const [title, setTitle] = useState(initial.title)
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? '')
  const [categoryTouched, setCategoryTouched] = useState(editing) // don't override a manual choice
  const [suggested, setSuggested] = useState(false)
  const [error, setError] = useState('')

  const options = categories.filter((c) => c.type === type)

  function applySuggestion(nextTitle, nextType) {
    if (categoryTouched) return
    const id = suggestCategoryId(nextTitle, transactions, nextType, categories)
    setCategoryId(id ?? '')
    setSuggested(!!id)
  }

  function handleTitle(e) {
    setTitle(e.target.value)
    applySuggestion(e.target.value, type)
  }

  function handleType(nextType) {
    setType(nextType)
    setCategoryId('')
    setSuggested(false)
    if (!categoryTouched) {
      const id = suggestCategoryId(title, transactions, nextType, categories)
      setCategoryId(id ?? '')
      setSuggested(!!id)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    try {
      // allow "24,35" as well as "24.35"
      const parsed = String(amount).replace(/\s/g, '').replace(',', '.')
      onSubmit({ type, date, amount: parsed, title, categoryId: categoryId || null })
      setError('')
      if (resetAfterSubmit) {
        setAmount('')
        setTitle('')
        setCategoryId('')
        setCategoryTouched(false)
        setSuggested(false)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="tx-form" onSubmit={handleSubmit}>
      <div className="type-toggle" role="group" aria-label="Type">
        {['expense', 'income'].map((t) => (
          <button
            key={t}
            type="button"
            className={`${t} ${type === t ? 'active' : ''}`}
            aria-pressed={type === t}
            onClick={() => handleType(t)}
          >
            {t === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>

      <input
        type="date"
        value={date}
        min={MIN_DATE}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Date"
        required
      />
      <input
        className="amount-input"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount (PLN)"
        inputMode="decimal"
        aria-label="Amount"
      />
      <input
        className="title-input"
        value={title}
        onChange={handleTitle}
        placeholder="Title, e.g. biedronka"
        aria-label="Title"
        maxLength={100}
      />
      <select
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value)
          setCategoryTouched(true)
          setSuggested(false)
        }}
        aria-label="Category"
      >
        <option value="">— Uncategorized —</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji} {c.name}
          </option>
        ))}
      </select>

      <button type="submit" className="btn primary">
        {editing ? <Check size={16} /> : <Plus size={16} />}
        <span>{submitLabel}</span>
      </button>
      {editing && (
        <button type="button" className="btn" onClick={onCancel}>
          <X size={16} />
          <span>Cancel</span>
        </button>
      )}

      {suggested && <p className="hint">✨ Category suggested from your earlier transactions</p>}
      {error && <p className="error">{error}</p>}
    </form>
  )
}
