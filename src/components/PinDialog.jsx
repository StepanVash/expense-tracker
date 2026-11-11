import { useState } from 'react'
import { Lock, ShieldCheck, Eye, EyeOff, AlertTriangle, RotateCcw } from 'lucide-react'
import { setPin, verifyPin, clearPin, PIN_MIN_LENGTH, PIN_MAX_LENGTH } from '../pin.js'
import { clearAll, ensureDefaultCategories } from '../storage.js'
import { DEFAULT_CATEGORIES } from '../defaultCategories.js'

/**
 * Modal dialog displayed on app launch (or when locked) to secure access with a PIN.
 * - mode === 'unlock': asks the user to enter their existing PIN.
 * - mode === 'setup': asks a first-time user to create and confirm a PIN.
 */
export default function PinDialog({ initialMode, onUnlock, onResetApp }) {
  const [mode, setMode] = useState(initialMode)
  const [pin, setPinInput] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [forgotOpen, setForgotOpen] = useState(false)

  function handleDigitsChange(setter) {
    return (e) => {
      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH)
      setter(digitsOnly)
      if (error) setError('')
    }
  }

  function handleUnlockSubmit(e) {
    e.preventDefault()
    if (!pin) {
      setError('Please enter your PIN.')
      return
    }
    if (verifyPin(pin)) {
      setError('')
      setPinInput('')
      onUnlock()
    } else {
      setAttempts((a) => a + 1)
      setPinInput('')
      setError('Incorrect PIN. Please try again.')
    }
  }

  function handleSetupSubmit(e) {
    e.preventDefault()
    if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
      setError(`PIN must be ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits.`)
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.')
      return
    }
    try {
      setPin(pin)
      setError('')
      setPinInput('')
      setConfirmPin('')
      onUnlock()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleForgotReset() {
    clearAll()
    clearPin()
    ensureDefaultCategories(DEFAULT_CATEGORIES)
    setForgotOpen(false)
    setPinInput('')
    setConfirmPin('')
    setError('')
    setAttempts(0)
    setMode('setup')
    if (onResetApp) onResetApp()
  }

  const isSetup = mode === 'setup'

  return (
    <div className="modal-backdrop pin-backdrop" role="dialog" aria-modal="true" aria-labelledby="pin-dialog-title">
      <div className="modal-card pin-dialog-card">
        <div className="pin-dialog-header">
          <div className="pin-badge">
            {isSetup ? <ShieldCheck size={28} /> : <Lock size={28} />}
          </div>
          <h2 id="pin-dialog-title">{isSetup ? 'Set Up Access PIN' : 'Enter Your PIN'}</h2>
          <p className="muted small">
            {isSetup
              ? `Create a ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digit PIN to protect your Expense Tracker.`
              : 'Expense Tracker is locked. Enter your PIN to view your finances.'}
          </p>
        </div>

        <form className="pin-dialog-form" onSubmit={isSetup ? handleSetupSubmit : handleUnlockSubmit}>
          <div className="pin-field-group">
            <label htmlFor="pin-input">{isSetup ? 'New PIN' : 'PIN'}</label>
            <div className="pin-input-wrap">
              <input
                id="pin-input"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                maxLength={PIN_MAX_LENGTH}
                placeholder="••••"
                value={pin}
                onChange={handleDigitsChange(setPinInput)}
                aria-label={isSetup ? 'New PIN' : 'PIN'}
                autoFocus
              />
              <button
                type="button"
                className="icon-btn pin-eye-btn"
                onClick={() => setShowPin((s) => !s)}
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isSetup && (
            <div className="pin-field-group">
              <label htmlFor="pin-confirm-input">Confirm PIN</label>
              <div className="pin-input-wrap">
                <input
                  id="pin-confirm-input"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  maxLength={PIN_MAX_LENGTH}
                  placeholder="••••"
                  value={confirmPin}
                  onChange={handleDigitsChange(setConfirmPin)}
                  aria-label="Confirm PIN"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="error pin-error" role="alert">
              {error}
              {!isSetup && attempts > 1 ? ` (${attempts} failed attempts)` : ''}
            </p>
          )}

          <button type="submit" className="btn primary pin-submit-btn">
            {isSetup ? 'Set PIN & Unlock' : 'Unlock'}
          </button>
        </form>

        {!isSetup && (
          <div className="pin-forgot-section">
            {!forgotOpen ? (
              <button type="button" className="pin-forgot-link" onClick={() => setForgotOpen(true)}>
                Forgot PIN?
              </button>
            ) : (
              <div className="pin-forgot-box">
                <p className="confirm-warning">
                  <AlertTriangle size={16} />
                  <span>
                    For your privacy, your PIN cannot be recovered. Resetting clears all local transactions, budgets, and your PIN.
                  </span>
                </p>
                <div className="confirm-actions">
                  <button type="button" className="btn danger-btn" onClick={handleForgotReset}>
                    <RotateCcw size={15} />
                    <span>Reset App &amp; Clear PIN</span>
                  </button>
                  <button type="button" className="btn" onClick={() => setForgotOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

