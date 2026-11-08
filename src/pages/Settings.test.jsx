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
    act(() => type(form.querySelector('.emoji-input'), '🎁'))
    act(() => type(form.querySelector('.name-input'), 'Gifts'))
    act(() => form.querySelector('button[type=submit]').click())

    expect(container.textContent).toContain('Gifts')
    expect(storage.getCategories().find((c) => c.name === 'Gifts').type).toBe('expense')
  })

  it('shows an error for a duplicate name', () => {
    const form = container.querySelectorAll('.add-category form')[0]
    act(() => type(form.querySelector('.name-input'), 'grocery'))
    act(() => form.querySelector('button[type=submit]').click())
    expect(container.querySelector('.error').textContent).toMatch(/already exists/)
  })

  it('renames a category', () => {
    act(() => container.querySelector('[aria-label="Edit Coffee"]').click())
    const input = container.querySelector('.category-list .name-input')
    act(() => type(input, 'Coffee & snacks'))
    act(() => input.form.querySelector('button[type=submit]').click())
    expect(container.textContent).toContain('Coffee & snacks')
  })
})
