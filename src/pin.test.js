import { describe, it, expect, beforeEach } from 'vitest'
import { hasPin, setPin, verifyPin, resetPin, clearPin, validatePinFormat } from './pin.js'

describe('pin security helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with no PIN configured', () => {
    expect(hasPin()).toBe(false)
    expect(verifyPin('1234')).toBe(false)
  })

  it('validates PIN format (4 to 8 numeric digits)', () => {
    expect(validatePinFormat('1234')).toBe('1234')
    expect(validatePinFormat('00000000')).toBe('00000000')
    expect(() => validatePinFormat('123')).toThrow(/4 to 8 digits/)
    expect(() => validatePinFormat('123456789')).toThrow(/4 to 8 digits/)
    expect(() => validatePinFormat('12ab')).toThrow(/4 to 8 digits/)
    expect(() => validatePinFormat('')).toThrow(/4 to 8 digits/)
  })

  it('stores PIN hashed (never plaintext) and verifies correctly', () => {
    setPin('4829')
    expect(hasPin()).toBe(true)

    const raw = localStorage.getItem('expense-tracker:pin')
    expect(raw).not.toContain('4829')
    const parsed = JSON.parse(raw)
    expect(parsed.salt).toBeTruthy()
    expect(parsed.hash).toHaveLength(64)

    expect(verifyPin('4829')).toBe(true)
    expect(verifyPin('0000')).toBe(false)
    expect(verifyPin('')).toBe(false)
  })

  it('resets PIN only when current PIN matches', () => {
    setPin('1111')
    expect(() => resetPin('9999', '2222')).toThrow(/Current PIN is incorrect/)
    expect(verifyPin('1111')).toBe(true)

    resetPin('1111', '2222')
    expect(verifyPin('1111')).toBe(false)
    expect(verifyPin('2222')).toBe(true)
  })

  it('sets PIN via resetPin when none was configured yet', () => {
    expect(hasPin()).toBe(false)
    resetPin('', '5678')
    expect(hasPin()).toBe(true)
    expect(verifyPin('5678')).toBe(true)
  })

  it('clears the PIN', () => {
    setPin('1234')
    expect(hasPin()).toBe(true)
    clearPin()
    expect(hasPin()).toBe(false)
    expect(verifyPin('1234')).toBe(false)
  })
})

