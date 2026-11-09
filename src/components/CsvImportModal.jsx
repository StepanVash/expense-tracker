import { useState, useMemo } from 'react'
import {
  Upload,
  X,
  Check,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  HelpCircle,
  RotateCcw,
} from 'lucide-react'
import {
  decodeCsvBuffer,
  parseCsv,
  findHeaderRow,
  extractOwnerName,
  tableRows,
  detectColumns,
  guessAmountMode,
  buildPreview,
  summarize,
  defaultSelection,
  applyImport,
  TEMPLATE_CSV,
} from '../csvImport.js'
import { formatDate, formatMoney, formatMonth } from '../format.js'
import { extractCoreMerchantPattern } from '../learnedRules.js'

export default function CsvImportModal({
  isOpen,
  onClose,
  categories,
  transactions,
  onImportComplete,
}) {
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [mapping, setMapping] = useState(null)
  const [amountMode, setAmountMode] = useState('sign')
  const [createCategories, setCreateCategories] = useState(true)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [editedCategories, setEditedCategories] = useState({}) // rowNumber -> categoryId
  const [statusFilter, setStatusFilter] = useState('all') // all | ok | transfer | duplicate | error
  const [errorMsg, setErrorMsg] = useState('')

  function resetState() {
    setFile(null)
    setParsedData(null)
    setMapping(null)
    setSelectedRows(new Set())
    setEditedCategories({})
    setStatusFilter('all')
    setErrorMsg('')
  }

  function handleClose() {
    resetState()
    onClose()
  }

  function handleFileSelected(selectedFile) {
    if (!selectedFile) return
    setErrorMsg('')
    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer = e.target.result
        const { text, encoding } = decodeCsvBuffer(buffer)
        const parsed = parseCsv(text)
        if (!parsed.rows || parsed.rows.length === 0) {
          setErrorMsg('The selected CSV file appears to be empty.')
          return
        }

        const headerIdx = findHeaderRow(parsed.rows)
        if (headerIdx === -1) {
          setErrorMsg('Could not find header or transaction rows in this CSV file.')
          return
        }

        const headers = parsed.rows[headerIdx]
        const data = tableRows(parsed.rows, headerIdx)
        if (data.length === 0) {
          setErrorMsg('No data rows found below the header in this CSV.')
          return
        }

        const owner = extractOwnerName(parsed.rows.slice(0, headerIdx))
        const detected = detectColumns(headers, data)
        const mode = guessAmountMode(data, detected.amount)

        setParsedData({
          headers,
          dataRows: data,
          owner,
          headerIdx,
          encoding,
          delimiter: parsed.delimiter,
        })
        setMapping(detected)
        setAmountMode(mode)

        // Generate initial preview
        const preview = buildPreview({
          rows: data,
          mapping: detected,
          options: { amountMode: mode, createCategories: true },
          categories,
          transactions,
          firstRowNumber: headerIdx + 2,
          ownerName: owner,
        })
        setSelectedRows(defaultSelection(preview))
      } catch (err) {
        setErrorMsg(`Failed to parse CSV: ${err.message}`)
      }
    }
    reader.onerror = () => setErrorMsg('Failed to read file from disk.')
    reader.readAsArrayBuffer(selectedFile)
  }

  // Active items computed with user overrides
  const previewItems = useMemo(() => {
    if (!parsedData || !mapping) return []
    const raw = buildPreview({
      rows: parsedData.dataRows,
      mapping,
      options: { amountMode, createCategories },
      categories,
      transactions,
      firstRowNumber: parsedData.headerIdx + 2,
      ownerName: parsedData.owner,
    })
    // Apply user category overrides if any
    return raw.map((item) => {
      if (editedCategories[item.rowNumber] !== undefined) {
        return {
          ...item,
          categoryId: editedCategories[item.rowNumber] || null,
          newCategoryName: null,
        }
      }
      return item
    })
  }, [parsedData, mapping, amountMode, createCategories, categories, transactions, editedCategories])

  const summary = useMemo(() => {
    return summarize(previewItems, selectedRows)
  }, [previewItems, selectedRows])

  function toggleRow(rowNumber) {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowNumber)) next.delete(rowNumber)
      else next.add(rowNumber)
      return next
    })
  }

  function selectAll() {
    const selectable = previewItems.filter((i) => i.status !== 'error').map((i) => i.rowNumber)
    setSelectedRows(new Set(selectable))
  }

  function selectRecommended() {
    setSelectedRows(defaultSelection(previewItems))
  }

  function deselectAll() {
    setSelectedRows(new Set())
  }

  function handleCategoryChange(rowNumber, catId) {
    const changedItem = previewItems.find((i) => i.rowNumber === rowNumber)
    if (!changedItem) return

    const core = extractCoreMerchantPattern(changedItem.rawTitle || changedItem.title)
    const titleNorm = changedItem.title.toLowerCase()

    setEditedCategories((prev) => {
      const next = { ...prev, [rowNumber]: catId }
      // Auto-assign to any other item in this import that shares the same merchant
      previewItems.forEach((other) => {
        if (other.rowNumber === rowNumber || other.type !== changedItem.type) return
        if (prev[other.rowNumber] !== undefined) return // already manually overridden

        const otherCore = extractCoreMerchantPattern(other.rawTitle || other.title)
        const otherTitle = other.title.toLowerCase()

        if (otherTitle === titleNorm || (core && core.length >= 3 && otherCore === core)) {
          next[other.rowNumber] = catId
        }
      })
      return next
    })
  }

  function handleImport() {
    if (summary.toImport === 0) return
    try {
      const result = applyImport(previewItems, selectedRows)
      onImportComplete(result)
      handleClose()
    } catch (err) {
      setErrorMsg(`Import failed: ${err.message}`)
    }
  }

  const filteredPreview = useMemo(() => {
    if (statusFilter === 'all') return previewItems
    return previewItems.filter((i) => i.status === statusFilter)
  }, [previewItems, statusFilter])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-card import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Upload size={22} /> Upload CSV Statement
          </h2>
          <button className="icon-btn" onClick={handleClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {!parsedData ? (
          <div className="file-drop-area">
            <input
              type="file"
              id="csv-file-input"
              accept=".csv,text/csv,text/plain"
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />
            <label htmlFor="csv-file-input" className="file-drop-box">
              <Upload size={38} className="upload-icon" />
              <p className="file-prompt">
                <strong>Click to choose a CSV file</strong> or drag & drop here
              </p>
              <p className="muted small">
                Supports bank statements (ZEN, mBank, PKO, ING, etc.) and Excel CSV exports.
              </p>
            </label>

            <div className="template-box">
              <p className="muted small">
                Want a clean CSV template?{' '}
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`}
                  download="expenses_template.csv"
                  className="link"
                >
                  Download sample CSV
                </a>
              </p>
            </div>
          </div>
        ) : (
          <div className="preview-container">
            {/* File & Detection Info */}
            <div className="import-controls-bar">
              <div className="file-info-pill">
                📄 <strong>{file?.name}</strong> ({parsedData.encoding}, delimiter:{' '}
                <code>{parsedData.delimiter === '\t' ? 'tab' : parsedData.delimiter}</code>)
              </div>

              <div className="options-group">
                <label className="toggle-label">
                  Amount type:
                  <select
                    value={amountMode}
                    onChange={(e) => setAmountMode(e.target.value)}
                    aria-label="Amount sign mode"
                  >
                    <option value="sign">Auto (+ income, − expense)</option>
                    <option value="expense">All expenses</option>
                    <option value="income">All income</option>
                  </select>
                </label>

                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={createCategories}
                    onChange={(e) => setCreateCategories(e.target.checked)}
                  />
                  Auto-create new categories
                </label>

                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    setParsedData(null)
                    setFile(null)
                  }}
                >
                  Change file
                </button>
              </div>
            </div>

            {/* Column Mapping Review */}
            <details className="mapping-accordion">
              <summary>
                ⚙️ Column mapping ({mapping.date >= 0 ? '✓ Date' : '❌ Date'},{' '}
                {mapping.amount >= 0 ? '✓ Amount' : '❌ Amount'},{' '}
                {mapping.title >= 0 ? '✓ Description' : 'Title'})
              </summary>
              <div className="mapping-grid">
                <label>
                  Date:
                  <select
                    value={mapping.date}
                    onChange={(e) => setMapping({ ...mapping, date: Number(e.target.value) })}
                  >
                    <option value={-1}>— None —</option>
                    {parsedData.headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {h || `Column ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Amount:
                  <select
                    value={mapping.amount}
                    onChange={(e) => setMapping({ ...mapping, amount: Number(e.target.value) })}
                  >
                    <option value={-1}>— None —</option>
                    {parsedData.headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {h || `Column ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Description / Title:
                  <select
                    value={mapping.title}
                    onChange={(e) => setMapping({ ...mapping, title: Number(e.target.value) })}
                  >
                    <option value={-1}>— None —</option>
                    {parsedData.headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {h || `Column ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Category (if in CSV):
                  <select
                    value={mapping.category}
                    onChange={(e) => setMapping({ ...mapping, category: Number(e.target.value) })}
                  >
                    <option value={-1}>— None (auto-detect) —</option>
                    {parsedData.headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {h || `Column ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>

            {/* Summary statistics bar */}
            <div className="import-summary-bar">
              <div className="stat-badges">
                <span className="badge ready">Ready to import: {summary.toImport}</span>
                {summary.transfers > 0 && (
                  <span className="badge transfer">Transfers: {summary.transfers}</span>
                )}
                {summary.duplicates > 0 && (
                  <span className="badge duplicate">Duplicates: {summary.duplicates}</span>
                )}
                {summary.errors > 0 && <span className="badge error">Errors: {summary.errors}</span>}
              </div>

              <div className="totals-highlight">
                <span>
                  Income: <strong>+{formatMoney(summary.income)}</strong>
                </span>
                <span>
                  Expenses: <strong>−{formatMoney(summary.expenses)}</strong>
                </span>
                {summary.byMonth.length > 0 && (
                  <span className="month-tags">
                    Months:{' '}
                    {summary.byMonth.map((m) => `${formatMonth(m.month)} (${m.count})`).join(', ')}
                  </span>
                )}
              </div>
            </div>

            {/* Filter & Batch selection buttons */}
            <div className="selection-toolbar">
              <div className="btn-group">
                <button type="button" className="btn small" onClick={selectRecommended}>
                  Select Recommended
                </button>
                <button type="button" className="btn small" onClick={selectAll}>
                  Select All
                </button>
                <button type="button" className="btn small" onClick={deselectAll}>
                  Deselect All
                </button>
              </div>

              <div className="filter-group">
                <label>Show: </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All items ({previewItems.length})</option>
                  <option value="ok">Ready to import</option>
                  <option value="transfer">Transfers</option>
                  <option value="duplicate">Duplicates</option>
                  <option value="error">Errors</option>
                </select>
              </div>
            </div>

            {/* Transactions Preview Table */}
            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th style={{ width: '38px' }}></th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Amount</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreview.map((item) => {
                    const isSelected = selectedRows.has(item.rowNumber)
                    const isError = item.status === 'error'

                    return (
                      <tr
                        key={item.rowNumber}
                        className={`preview-row ${item.status} ${isSelected ? 'selected' : ''}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isError}
                            onChange={() => toggleRow(item.rowNumber)}
                            aria-label={`Select row ${item.rowNumber}`}
                          />
                        </td>
                        <td>
                          {item.status === 'ok' && <span className="pill green">Ready</span>}
                          {item.status === 'transfer' && (
                            <span className="pill yellow" title={item.reason}>
                              Transfer
                            </span>
                          )}
                          {item.status === 'duplicate' && (
                            <span className="pill gray" title={item.reason}>
                              Duplicate
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="pill red" title={item.reason}>
                              Error: {item.reason}
                            </span>
                          )}
                        </td>
                        <td className="date-cell">{item.date ? formatDate(item.date) : '—'}</td>
                        <td className="title-cell" title={item.rawTitle}>
                          <strong>{item.title}</strong>
                          {item.status === 'transfer' && (
                            <div className="reason-hint">ℹ️ {item.reason}</div>
                          )}
                        </td>
                        <td className={`amount-cell ${item.type}`}>
                          {item.amount !== null
                            ? `${item.type === 'income' ? '+' : '−'}${formatMoney(item.amount)}`
                            : '—'}
                        </td>
                        <td className="category-cell">
                          {isError ? (
                            '—'
                          ) : (
                            <select
                              value={item.categoryId || ''}
                              onChange={(e) =>
                                handleCategoryChange(item.rowNumber, e.target.value)
                              }
                              aria-label={`Category for ${item.title}`}
                            >
                              <option value="">
                                {item.newCategoryName
                                  ? `✨ Auto-create "${item.newCategoryName}"`
                                  : '— Uncategorized —'}
                              </option>
                              {categories
                                .filter((c) => c.type === item.type)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.emoji} {c.name}
                                  </option>
                                ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Bottom Actions */}
            <div className="modal-footer">
              <button type="button" className="btn" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={summary.toImport === 0}
                onClick={handleImport}
              >
                <Check size={18} />
                Import {summary.toImport} Transaction{summary.toImport === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
