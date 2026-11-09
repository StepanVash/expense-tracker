import { useState, useMemo, useRef } from 'react'
import {
  X,
  Check,
  AlertTriangle,
  Camera,
  Image as ImageIcon,
  Layers,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Info,
  Plus,
} from 'lucide-react'
import { processScreenshotFiles, deduplicateTransactions } from '../screenshotImport.js'
import { addTransactions, saveLearnedRules } from '../storage.js'
import { formatMoney, formatDate } from '../format.js'
import { extractCoreMerchantPattern } from '../learnedRules.js'

export default function ScreenshotImportModal({
  isOpen,
  onClose,
  categories,
  onImportComplete,
}) {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(null)
  const [parsedResults, setParsedResults] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [editedCategories, setEditedCategories] = useState({})
  const [ignoredIds, setIgnoredIds] = useState(new Set())
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const fileInputRef = useRef(null)
  const addMoreInputRef = useRef(null)

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories],
  )
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income'),
    [categories],
  )

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]))
  }, [categories])

  function resetState() {
    setSelectedFiles([])
    setIsProcessing(false)
    setOcrProgress(null)
    setParsedResults(null)
    setErrorMsg('')
    setEditedCategories({})
    setIgnoredIds(new Set())
    setFeedbackMsg('')
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function handleFilesSelected(files) {
    const validImageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (validImageFiles.length === 0) {
      setErrorMsg('Please select at least one valid image file (.png, .jpg, .jpeg, .webp).')
      return
    }

    setSelectedFiles(validImageFiles)
    setErrorMsg('')
    setIsProcessing(true)

    try {
      const results = await processScreenshotFiles(validImageFiles, (progress) => {
        setOcrProgress(progress)
      })

      if (results.transactions.length === 0) {
        setErrorMsg('No transactions could be detected in the uploaded screenshot(s). Please check that dates and amounts are clearly visible.')
        setIsProcessing(false)
        return
      }

      setParsedResults(results)

      // Initialize ignored set for transfers
      const ignored = new Set()
      results.transactions.forEach((tx) => {
        if (tx.isTransfer) ignored.add(tx.id)
      })
      setIgnoredIds(ignored)
    } catch (err) {
      console.error('Screenshot OCR error:', err)
      setErrorMsg(`OCR processing failed: ${err.message || 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleAddMoreFiles(files) {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (validFiles.length === 0) return

    setIsProcessing(true)
    setErrorMsg('')

    try {
      const newResults = await processScreenshotFiles(validFiles, (progress) => {
        setOcrProgress(progress)
      })

      if (newResults.transactions.length === 0) {
        setFeedbackMsg(`No additional transactions detected in the ${validFiles.length} uploaded screenshot(s).`)
        setTimeout(() => setFeedbackMsg(''), 4000)
        return
      }

      // Combine existing transactions with new ones and deduplicate
      const currentList = parsedResults?.transactions || []
      const combined = [...currentList, ...newResults.transactions]
      const { deduplicated, duplicatesRemoved } = deduplicateTransactions(combined)

      const nextIgnored = new Set(ignoredIds)
      newResults.transactions.forEach((tx) => {
        if (tx.isTransfer) nextIgnored.add(tx.id)
      })

      const addedCount = deduplicated.length - currentList.length
      const mergedInBatch = newResults.transactions.length - addedCount

      setParsedResults({
        transactions: deduplicated,
        totalImages: (parsedResults?.totalImages || 0) + validFiles.length,
        duplicatesRemoved: (parsedResults?.duplicatesRemoved || 0) + mergedInBatch,
      })
      setSelectedFiles((prev) => [...prev, ...validFiles])
      setIgnoredIds(nextIgnored)

      setFeedbackMsg(
        `Added ${validFiles.length} screenshot(s): found ${addedCount} new transaction(s)${mergedInBatch > 0 ? ` (${mergedInBatch} overlapping duplicate(s) merged)` : ''}.`,
      )
      setTimeout(() => setFeedbackMsg(''), 5000)
    } catch (err) {
      console.error('OCR add more error:', err)
      setErrorMsg(`Failed adding screenshots: ${err.message || 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    if (e.dataTransfer?.files?.length) {
      handleFilesSelected(e.dataTransfer.files)
    }
  }

  // Handle changing category with auto-learning batch propagation
  function handleCategoryChange(rowId, categoryId) {
    const targetTx = parsedResults.transactions.find((t) => t.id === rowId)
    if (!targetTx) return

    const pattern = extractCoreMerchantPattern(targetTx.title)
    const nextEdited = { ...editedCategories, [rowId]: categoryId }

    // Propagate to all matching rows in batch
    let batchUpdated = 0
    parsedResults.transactions.forEach((tx) => {
      if (tx.type === targetTx.type) {
        const p = extractCoreMerchantPattern(tx.title)
        if (p.toLowerCase() === pattern.toLowerCase() && tx.id !== rowId) {
          nextEdited[tx.id] = categoryId
          batchUpdated++
        }
      }
    })

    setEditedCategories(nextEdited)

    // Save learned rule
    const cat = categoryMap.get(categoryId)
    if (cat && pattern) {
      saveLearnedRules([{ pattern, categoryId, type: targetTx.type }])
      setFeedbackMsg(
        `Learned "${pattern}" -> ${cat.emoji} ${cat.name}${batchUpdated > 0 ? ` (applied to ${batchUpdated + 1} rows)` : ''}`,
      )
      setTimeout(() => setFeedbackMsg(''), 4500)
    }
  }

  function toggleIgnore(rowId) {
    const next = new Set(ignoredIds)
    if (next.has(rowId)) next.delete(rowId)
    else next.add(rowId)
    setIgnoredIds(next)
  }

  // Calculate summary metrics
  const summary = useMemo(() => {
    if (!parsedResults) return { totalCount: 0, importCount: 0, ignoredCount: 0, totalExpense: 0, totalIncome: 0 }
    let importCount = 0
    let totalExpense = 0
    let totalIncome = 0

    parsedResults.transactions.forEach((tx) => {
      if (!ignoredIds.has(tx.id)) {
        importCount++
        if (tx.type === 'expense') totalExpense += tx.amount
        else totalIncome += tx.amount
      }
    })

    return {
      totalCount: parsedResults.transactions.length,
      importCount,
      ignoredCount: ignoredIds.size,
      totalExpense,
      totalIncome,
    }
  }, [parsedResults, ignoredIds])

  function handleConfirmImport() {
    if (!parsedResults || summary.importCount === 0) return

    const transactionsToAdd = parsedResults.transactions
      .filter((tx) => !ignoredIds.has(tx.id))
      .map((tx) => ({
        type: tx.type,
        date: tx.date,
        amount: tx.amount,
        title: tx.title,
        categoryId: editedCategories[tx.id] || tx.categoryId || null,
      }))

    addTransactions(transactionsToAdd)
    if (onImportComplete) onImportComplete(transactionsToAdd.length)
    handleClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-card modal-large" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <Camera size={22} className="modal-icon" />
            <div>
              <h2>Import Bank Screenshots</h2>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                Upload multiple bank mobile app screenshots simultaneously. Transactions are recognized 100% locally on your device.
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={handleClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {errorMsg && (
            <div className="notification-banner error">
              <AlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {feedbackMsg && (
            <div className="notification-banner success">
              <Sparkles size={18} />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* 1. Upload Screen (when no results yet) */}
          {!parsedResults && !isProcessing && (
            <div
              className="upload-dropzone screenshot-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*,.jpg,.jpeg,.png,.webp"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.length && handleFilesSelected(e.target.files)}
              />
              <div className="dropzone-icon-wrap">
                <Layers size={36} />
              </div>
              <h3>Select or Drop Bank App Screenshots</h3>
              <p className="muted small">
                You can upload <strong>multiple screenshots simultaneously</strong> (select several with Shift/Ctrl, or drag & drop a batch).
              </p>
              <div className="dropzone-multi-badge">
                <span className="file-badge multi-highlight">✨ Multi-screenshot batch parsing</span>
                <span className="file-badge">⚡ Automatic overlap deduplication</span>
              </div>
              <div className="dropzone-badges" style={{ marginTop: '14px' }}>
                <span className="file-badge">📸 PKO IKO</span>
                <span className="file-badge">📸 mBank</span>
                <span className="file-badge">📸 Santander</span>
                <span className="file-badge">📸 Revolut</span>
                <span className="file-badge">📸 ING</span>
                <span className="file-badge">📸 Millennium</span>
                <span className="file-badge">📸 Alior</span>
              </div>
            </div>
          )}

          {/* 2. OCR Processing Progress */}
          {isProcessing && (
            <div className="ocr-progress-box">
              <div className="spinner-wrap">
                <div className="spinner" />
              </div>
              <h3>Analyzing Screenshots with Local OCR...</h3>
              <p className="muted small">{ocrProgress?.status || 'Reading image data...'}</p>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${ocrProgress?.progress || 10}%` }}
                />
              </div>
              <span className="progress-percentage-label">{ocrProgress?.progress || 10}%</span>
              <p className="muted small privacy-notice">
                🔒 <strong>100% Private</strong>: Image processing happens locally in your browser. No financial data leaves your computer.
              </p>
            </div>
          )}

          {/* 3. Review & Categorization Table */}
          {parsedResults && !isProcessing && (
            <div className="screenshot-review-section">
              {/* Summary Toolbar */}
              <div className="import-summary-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div className="import-stats-pills" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="pill blue">
                    📸 {parsedResults.totalImages} screenshot{parsedResults.totalImages > 1 ? 's' : ''}
                  </span>
                  <span className="pill green">
                    Ready to import: {summary.importCount}
                  </span>
                  {summary.ignoredCount > 0 && (
                    <span className="pill gray">
                      Transfers ignored: {summary.ignoredCount}
                    </span>
                  )}
                  {parsedResults.duplicatesRemoved > 0 && (
                    <span className="pill purple">
                      Merged duplicates: {parsedResults.duplicatesRemoved}
                    </span>
                  )}
                </div>

                <div className="import-action-buttons">
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => addMoreInputRef.current?.click()}
                    title="Upload more screenshots to merge with this batch"
                  >
                    <Plus size={14} />
                    <span>Add more screenshots</span>
                  </button>
                  <input
                    type="file"
                    ref={addMoreInputRef}
                    multiple
                    accept="image/*,.jpg,.jpeg,.png,.webp"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files?.length && handleAddMoreFiles(e.target.files)}
                  />

                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      setParsedResults(null)
                      setSelectedFiles([])
                    }}
                    title="Clear and pick different screenshots"
                  >
                    <RotateCcw size={14} />
                    <span>Start over</span>
                  </button>
                </div>
              </div>

              {/* Transactions Review Table */}
              <div className="table-scroll" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="category-matrix-table preview-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Import</th>
                      <th style={{ width: '110px' }}>Date</th>
                      <th>Title / Merchant</th>
                      <th style={{ width: '100px' }}>Type</th>
                      <th style={{ width: '130px' }}>Amount</th>
                      <th style={{ width: '220px' }}>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedResults.transactions.map((tx) => {
                      const isIgnored = ignoredIds.has(tx.id)
                      const activeCatId = editedCategories[tx.id] || tx.categoryId
                      const categoryList = tx.type === 'expense' ? expenseCategories : incomeCategories

                      return (
                        <tr key={tx.id} className={`matrix-row ${isIgnored ? 'ignored-row' : ''}`}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!isIgnored}
                              onChange={() => toggleIgnore(tx.id)}
                              aria-label={`Import transaction ${tx.title}`}
                            />
                          </td>
                          <td className="date-cell">{formatDate(tx.date)}</td>
                          <td className="title-cell">
                            <strong>{tx.title}</strong>
                            {tx.isTransfer && (
                              <span className="transfer-tag" title="Detected as internal transfer">
                                transfer
                              </span>
                            )}
                          </td>
                          <td className="type-cell">
                            <span className={`type-pill ${tx.type}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className={`num-col amount-cell ${tx.type}`}>
                            {tx.type === 'expense' ? '−' : '+'}{formatMoney(tx.amount)}
                          </td>
                          <td className="category-cell">
                            <select
                              value={activeCatId || ''}
                              onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                              aria-label={`Category for ${tx.title}`}
                              disabled={isIgnored}
                            >
                              <option value="">❓ Uncategorized</option>
                              {categoryList.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.emoji} {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={handleClose}>
            Cancel
          </button>
          {parsedResults && (
            <button
              type="button"
              className="btn primary"
              disabled={summary.importCount === 0}
              onClick={handleConfirmImport}
            >
              <Check size={16} />
              <span>Import {summary.importCount} Transaction{summary.importCount === 1 ? '' : 's'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
