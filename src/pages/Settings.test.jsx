import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Settings from './Settings.jsx'
import * as storage from '../storage.js'
import { DEFAULT_CATEGORIES } from '../defaultCategories.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container, root

beforeEach(() => {
  storage.clearAll()
  storage.ensureDefaultCategories(DEFAULT_CATEGORIES)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Settings />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

/** Type into a React-controlled input. */
function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Settings page', () => {
  it('shows the default categories', () => {
    expect(container.textContent).toContain('Grocery')
    expect(container.textContent).toContain('Salary')
    expect(container.textContent).toContain('Coffee')
  })

  it('adds a new expense category', () => {
    const form = container.querySelectorAll('.add-category form')[0] // expense section
    act(() => form.querySelector('.emoji-input').click()) // open picker
    act(() => container.querySelector('[aria-label="Emoji 🎁"]').click()) // pick emoji
    act(() => type(form.querySelector('.name-input'), 'Gifts'))
    act(() => form.querySelector('button[type=submit]').click())

    expect(container.textContent).toContain('Gifts')
    const gifts = storage.getCategories().find((c) => c.name === 'Gifts')
    expect(gifts.type).toBe('expense')
    expect(gifts.emoji).toBe('🎁')
  })

  it('opens the emoji picker, selects an emoji and closes it', () => {
    const form = container.querySelectorAll('.add-category form')[0]
    expect(container.querySelector('.emoji-popup')).toBeNull()
    act(() => form.querySelector('.emoji-input').click())
    expect(container.querySelector('.emoji-popup')).not.toBeNull()
    act(() => container.querySelector('[aria-label="Emoji 🚀"]').click())
    expect(container.querySelector('.emoji-popup')).toBeNull()
    expect(form.querySelector('.emoji-input').textContent).toBe('🚀')
  })

  it('closes the emoji picker on Escape', () => {
    const form = container.querySelectorAll('.add-category form')[0]
    act(() => form.querySelector('.emoji-input').click())
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(container.querySelector('.emoji-popup')).toBeNull()
  })

  it('shows an error for a duplicate name', () => {
    const form = container.querySelectorAll('.add-category form')[0]
    act(() => type(form.querySelector('.name-input'), 'grocery'))
    act(() => form.querySelector('button[type=submit]').click())
    expect(container.querySelector('.error').textContent).toMatch(/already exists/)
  })

  it('stops at 50 symbols and shows an error message', () => {
    const form = container.querySelectorAll('.add-category form')[0]
    const input = form.querySelector('.name-input')

    act(() => type(input, 'x'.repeat(50)))
    expect(container.querySelector('.error')).toBeNull() // exactly 50 is fine

    act(() => type(input, 'x'.repeat(51)))
    expect(input.value).toHaveLength(50) // extra symbol refused
    expect(container.querySelector('.error').textContent).toMatch(/cannot be longer than 50 symbols/)

    act(() => type(input, 'short')) // error disappears once the user fixes it
    expect(container.querySelector('.error')).toBeNull()
  })

  it('renames a category', () => {
    act(() => container.querySelector('[aria-label="Edit Coffee"]').click())
    const input = container.querySelector('.category-list .name-input')
    act(() => type(input, 'Coffee & snacks'))
    act(() => input.form.querySelector('button[type=submit]').click())
    expect(container.textContent).toContain('Coffee & snacks')
  })
})
