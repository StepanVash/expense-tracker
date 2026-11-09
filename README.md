# 💰 Expense Tracker & Financial Analytics

A modern, privacy-first personal finance web app designed for multi-currency budgeting, smart bank import, and seasonal spending analytics. Built with **React 18**, **Vite**, and **Recharts**.

---

## 🌟 Key Features

### 1. 📷 100% Private Bank Screenshot OCR Import
- **Local On-Device OCR:** Uses Tesseract.js directly inside your browser — zero financial images or data ever leave your computer.
- **Polish & Ukrainian Banking Apps:** Optimized for Polish bank apps (ZEN, mBank, PKO, ING, Millennium) and Ukrainian bank apps (Monobank, PrivatBank, etc.).
- **Automatic Currency Conversion:** Automatically detects UAH (₴) transactions, applies customizable exchange rates (e.g. 1 PLN = 10.0 UAH), and converts amounts to PLN.
- **Smart Category Learning:** Remembers your merchant category assignments and auto-categorizes similar future transactions.

### 2. 📄 Bank Statement CSV Import
- **Intelligent Header & Column Detection:** Auto-maps date, amount, currency, merchant title, and transaction type from bank CSV files.
- **Transfer & Duplicate Detection:** Filters out internal transfers between your own accounts and highlights duplicate entries before importing.
- **Batch Category Assignment:** Auto-assigns categories across matching transactions in the statement.

### 3. 📊 Monthly Insights & Budgeting
- **KPI Summary Cards:** Real-time tracking of Monthly Income, Expenses, Savings Rate %, and Net Balance.
- **Planned vs. Actual Budgeting:** Set planned budgets per category with visual progress bars and surplus/deficit indicators.
- **Interactive Expense Breakdown:** Donut chart by category with percentages and formatted PLN totals.
- **Motivational Status Banners:** Dynamic insights comparing current month savings against previous benchmarks.

### 4. 📈 Year & Season Analytics Matrix
- **12-Month Matrix View:** Comprehensive month-by-month cross-matrix of all income and expense categories with monthly averages and annual totals.
- **Seasonal Breakdown:** Group spending by Winter, Spring, Summer, and Autumn to uncover seasonal trends.
- **Year-over-Year (YoY) Comparisons:** Track financial progression across years.
- **CSV Data Export:** One-click CSV export for any year's matrix data.

### 5. 🎨 Polished UX & Dark Mode
- **Theme Options:** Seamless switching between Light, Dark, and System preference with high-contrast accessibility.
- **Month & Year Quick Picker:** Fast calendar dropdown to jump between months or jump directly to the current month.
- **Zero Cloud Footprint:** All data is safely stored in your browser's `localStorage` with JSON export/import backup options.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher recommended)

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open in browser
http://localhost:5173
```

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite
- **Visuals & Charts:** Recharts, Lucide React icons
- **OCR Engine:** Tesseract.js (Client-side worker)
- **Styling:** Modern CSS3 with CSS custom properties (design tokens)
- **Persistence:** LocalStorage with JSON backup & restore

---

## 🔒 Privacy & Security

Your financial privacy is guaranteed:
- **No external servers:** No backend API or remote database is used.
- **No telemetry or tracking:** All computations, OCR recognition, and statement parsing occur entirely in your local browser session.
- **Sensitive files git-ignored:** Bank statements, OCR screenshots, and backups are strictly excluded via `.gitignore`.
