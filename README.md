# 💰 Expense Tracker

A personal web app for tracking income and expenses (in PLN) with simple analytics.
It replaces the `2026_Budget_Tracking.xlsx` spreadsheet.

## Run it

```powershell
npm.cmd install     # first time only
npm.cmd run dev     # then open http://localhost:5173
npm.cmd test        # run automated checks
```

## Project structure

| File | Purpose |
|---|---|
| `src/storage.js` | **The only file that reads/writes data** (localStorage now, cloud DB later) |
| `src/format.js` | Money and month formatting helpers |
| `src/App.jsx` | The user interface |
| `src/index.css` | Styles |
| `docs/` | The original Excel file used as a reference |

## Roadmap

1. ✅ Scaffold: app shell, storage layer, tests
2. ✅ Categories: defaults from Excel, Settings page to add / rename / delete
3. ✅ Add & list transactions: form, category suggestions, search, filters, edit, delete, CSV statement import
4. ✅ Monthly Insights dashboard: charts, motivational status banner, planned vs actual budgets, top 5 expenses
5. Import Excel
6. Year view
7. Backup + polish
