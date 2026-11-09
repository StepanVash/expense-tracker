import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  getCategories,
  getTransactions,
  addCategory,
  updateCategory,
  deleteCategory,
} from '../storage.js'
import { COLOR_PALETTE } from '../defaultCategories.js'
import EmojiPicker from '../components/EmojiPicker.jsx'

export default function Settings() {
  const [categories, setCategories] = useState(getCategories)
  const refresh = () => setCategories(getCategories())

  // how many transactions use each category (shown next to the name, and in the delete warning)
  const usage = getTransactions().reduce((acc, t) => {
    acc[t.categoryId] = (acc[t.categoryId] || 0) + 1
    return acc
  }, {})

  return (
    <div className="settings">
      <CategorySection
        title="Expense categories"
        type="expense"
        categories={categories.filter((c) => c.type === 'expense')}
        usage={usage}
        onChange={refresh}
      />
      <CategorySection
        title="Income categories"
        type="income"
        categories={categories.filter((c) => c.type === 'income')}
        usage={usage}
        onChange={refresh}
      />
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
        onChange={(e) => setName(e.target.value)}
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
