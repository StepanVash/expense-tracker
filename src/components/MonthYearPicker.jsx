import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { formatMonth, shiftMonth, currentMonth } from '../format.js'
import { MIN_MONTH } from '../storage.js'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function MonthYearPicker({ month, onChange, minMonth = MIN_MONTH }) {
  const [open, setOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(() => Number(month.slice(0, 4)))
  const ref = useRef(null)

  const atStart = month <= minMonth
  const [minY, minM] = minMonth.split('-').map(Number)

  // Sync internal year when external month changes
  useEffect(() => {
    setSelectedYear(Number(month.slice(0, 4)))
  }, [month])

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function selectMonth(monthIndex) {
    const mStr = String(monthIndex + 1).padStart(2, '0')
    const next = `${selectedYear}-${mStr}`
    if (next < minMonth) return
    onChange(next)
    setOpen(false)
  }

  function handleCurrentMonth() {
    const now = currentMonth()
    const target = now < minMonth ? minMonth : now
    onChange(target)
    setSelectedYear(Number(target.slice(0, 4)))
    setOpen(false)
  }

  const currentSelectedMonthIndex = Number(month.slice(5, 7)) - 1
  const currentSelectedYear = Number(month.slice(0, 4))

  return (
    <div className="month-picker" ref={ref} aria-label="Selected month">
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(shiftMonth(month, -1))}
        disabled={atStart}
        aria-label="Previous month"
        title={atStart ? 'The tracker starts in January 2026' : undefined}
      >
        <ChevronLeft size={18} />
      </button>

      <button
        type="button"
        className="month-label-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Select month and year"
        title="Click to select month and year directly"
      >
        <Calendar size={15} className="cal-icon" />
        <span className="month-label month-label-text">{formatMonth(month)}</span>
      </button>

      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight size={18} />
      </button>

      {open && (
        <div className="month-popup" role="dialog" aria-label="Month and year picker">
          <div className="popup-year-header">
            <button
              type="button"
              className="icon-btn small"
              disabled={selectedYear <= minY}
              onClick={() => setSelectedYear((y) => Math.max(minY, y - 1))}
              aria-label="Previous year"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="popup-year-label">{selectedYear}</span>

            <button
              type="button"
              className="icon-btn small"
              onClick={() => setSelectedYear((y) => y + 1)}
              aria-label="Next year"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="popup-months-grid">
            {MONTH_NAMES.map((name, idx) => {
              const isDisabled = selectedYear === minY && idx + 1 < minM
              const isSelected =
                selectedYear === currentSelectedYear && idx === currentSelectedMonthIndex

              return (
                <button
                  key={name}
                  type="button"
                  disabled={isDisabled}
                  className={`popup-month-cell ${isSelected ? 'active' : ''}`}
                  onClick={() => selectMonth(idx)}
                  aria-label={`${name} ${selectedYear}`}
                >
                  {name}
                </button>
              )
            })}
          </div>

          <div className="popup-footer">
            <button
              type="button"
              className="btn text-btn"
              onClick={handleCurrentMonth}
            >
              Jump to This Month
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
