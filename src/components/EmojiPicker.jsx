import { useEffect, useRef, useState } from 'react'
import { EMOJI_GROUPS } from '../emojis.js'

/**
 * Emoji button + popup grid. Click the button, pick an emoji, popup closes.
 * You can also type/paste any emoji in the box at the top of the popup
 * (on Windows: press Win + . to open the system emoji panel).
 */
export default function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // close on click outside or Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (emoji) => {
    onChange(emoji)
    setOpen(false)
  }

  return (
    <div className="emoji-picker" ref={ref}>
      <button
        type="button"
        className="emoji-input"
        aria-label="Choose emoji"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {value || '🙂'}
      </button>

      {open && (
        <div className="emoji-popup" role="dialog" aria-label="Emoji picker">
          <div className="emoji-custom">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Type or paste any emoji"
              aria-label="Custom emoji"
              maxLength={8}
            />
            {value && (
              <button type="button" className="btn" onClick={() => pick('')}>
                Clear
              </button>
            )}
          </div>

          <div className="emoji-scroll">
            {EMOJI_GROUPS.map((g) => (
              <div key={g.name}>
                <div className="emoji-group-name">{g.name}</div>
                <div className="emoji-grid">
                  {g.emojis.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={`emoji-cell ${e === value ? 'selected' : ''}`}
                      onClick={() => pick(e)}
                      aria-label={`Emoji ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
