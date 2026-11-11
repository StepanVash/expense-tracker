const PIN_KEY = 'expense-tracker:pin'

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 8

const PIN_RE = new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`)

/**
 * Pure-JS SHA-256 implementation so PIN hashing is synchronous,
 * deterministic, and works in all environments (browsers & jsdom).
 */
function sha256Hex(message) {
  const utf8 = unescape(encodeURIComponent(message))
  const len = utf8.length
  const words = []
  for (let i = 0; i < len; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8)
  }
  const bitLen = len * 8
  words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32))
  words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]

  let H0 = 0x6a09e667
  let H1 = 0xbb67ae85
  let H2 = 0x3c6ef372
  let H3 = 0xa54ff53a
  let H4 = 0x510e527f
  let H5 = 0x9b05688c
  let H6 = 0x1f83d9ab
  let H7 = 0x5be0cd19

  const rotr = (n, x) => (x >>> n) | (x << (32 - n))
  const w = new Array(64)

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) w[t] = words[i + t] | 0
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3)
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }

    let a = H0
    let b = H1
    let c = H2
    let d = H3
    let e = H4
    let f = H5
    let g = H6
    let h = H7

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) | 0

      h = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }

    H0 = (H0 + a) | 0
    H1 = (H1 + b) | 0
    H2 = (H2 + c) | 0
    H3 = (H3 + d) | 0
    H4 = (H4 + e) | 0
    H5 = (H5 + f) | 0
    H6 = (H6 + g) | 0
    H7 = (H7 + h) | 0
  }

  return [H0, H1, H2, H3, H4, H5, H6, H7].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

function generateSalt() {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
}

function loadPinRecord() {
  try {
    const raw = localStorage.getItem(PIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.salt === 'string' && typeof parsed.hash === 'string') {
      return parsed
    }
  } catch {
    // ignore malformed entry
  }
  return null
}

/** Validate that a PIN is 4 to 8 numeric digits. Returns trimmed string or throws. */
export function validatePinFormat(pin) {
  const value = String(pin ?? '').trim()
  if (!PIN_RE.test(value)) {
    throw new Error(`PIN must be ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits.`)
  }
  return value
}

/** Whether a PIN has been configured in localStorage. */
export function hasPin() {
  return loadPinRecord() !== null
}

/** Save a new salted PIN hash to localStorage. */
export function setPin(newPin) {
  const valid = validatePinFormat(newPin)
  const salt = generateSalt()
  const hash = sha256Hex(`${salt}:${valid}`)
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt, hash, updatedAt: new Date().toISOString() }))
}

/** Verify whether the candidate PIN matches the stored PIN. */
export function verifyPin(candidatePin) {
  const record = loadPinRecord()
  if (!record) return false
  const candidate = String(candidatePin ?? '').trim()
  const candidateHash = sha256Hex(`${record.salt}:${candidate}`)
  return candidateHash === record.hash
}

/**
 * Reset/change the PIN. When a PIN is already set, currentPin must match it.
 */
export function resetPin(currentPin, newPin) {
  if (hasPin() && !verifyPin(currentPin)) {
    throw new Error('Current PIN is incorrect.')
  }
  setPin(newPin)
}

/** Remove the stored PIN from localStorage. */
export function clearPin() {
  localStorage.removeItem(PIN_KEY)
}
