# BudgetLens 💰

Personal finance app: transactions, budgets, categories, and stocks — React frontend + Node/Express API + Supabase.

## Quick Start
- Prereqs: Node 18+, npm, Supabase project
- Install: `npm install && (cd client && npm install)`
- Env: create `.env` in repo root with:
  - `SUPABASE_URL=...`
  - `SUPABASE_ANON_KEY=...`
  - `SUPABASE_SERVICE_KEY=...`
  - `JWT_SECRET=...`
  - `PORT=5001`
- Dev: `npm run dev` (server on 5001, client on 4000)
- Prod: `npm run build && npm start`

## Scripts
- `npm run dev`: server (nodemon) + client (react-scripts)
- `npm run server:dev`: backend only
- `npm start`: start backend (prod)

## Endpoints (quick)
- Auth: `/api/auth/login`, `/api/auth/register`, `/api/auth/verify`
- Transactions: `/api/transactions`
- Categories: `/api/categories`
- Dashboard: `/api/dashboard`
- Upload: `/api/upload`

## Structure
```
client/   # React app (PORT 4000)
server/   # Express API (PORT 5001)
sql/      # Supabase SQL
```

## Notes
- Run SQL files in `sql/` on Supabase.
- Frontend expects backend at `http://localhost:5001` in dev.

License: MIT
