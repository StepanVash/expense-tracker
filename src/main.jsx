import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ensureDefaultCategories } from './storage.js'
import { DEFAULT_CATEGORIES } from './defaultCategories.js'
import './index.css'

// First run: fill in the default categories (does nothing on later runs)
ensureDefaultCategories(DEFAULT_CATEGORIES)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
