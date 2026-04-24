# Prescription Return-to-Stock (RTS) Tracker

A starter framework for tracking canceled prescriptions on **Thursdays**, pulling stock on **Fridays** (from 2 weeks prior), and recording patient call outcomes before the next cancellation cycle.

## Why this app
Your current process is solid operationally, but spread across notes + Excel. This app centralizes:

- Thursday cancellation log
- Friday pull queue (2-week lag)
- Friday call outcomes (`called`, `left_message`, `no_answer`)
- Weekly counts by category:
  - Antibiotics
  - Waiters
  - Fridge items
  - Narcotics
  - Central fill

## Proposed stack
- **Frontend:** React (Vite)
- **Backend:** Python + FastAPI
- **Database/Auth:** Supabase (Postgres + optional auth)
- **Deployment:** Frontend on Vercel/Netlify, Backend on Render/Railway/Fly.io

---

## Workflow model

### Thursday (Cancel Day)
1. Search patient.
2. Record canceled prescription details:
   - Rx number / medication
   - Category flags (antibiotic, waiter, fridge, narcotic)
   - Filled by central fill (yes/no)
   - Cancel reason / note
3. Prescription is marked `canceled` and assigned a `pull_due_date` (typically `canceled_at + 14 days`).

### Friday (Pull + Call Day)
1. Open **Pull Queue** for today (items due from ~2 weeks ago).
2. Pull stock from drawer and mark pulled.
3. Call patient and log outcome:
   - `called`
   - `left_message`
   - `no_answer`
4. Optionally schedule follow-up.

### Weekly reporting
Dashboard provides count summaries matching your Excel process.

---

## Project structure

```txt
rts-tracker/
├─ backend/
│  ├─ app/
│  │  ├─ config.py
│  │  ├─ main.py
│  │  └─ models.py
│  ├─ requirements.txt
│  └─ .env.example
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ index.html
│  └─ src/
│     ├─ App.jsx
│     └─ api.js
└─ supabase/
   └─ schema.sql
```

---

## 1) Supabase setup

1. Create a new Supabase project.
2. Run SQL in `supabase/schema.sql`.
3. Copy project URL and service role key.
4. Set backend env vars from `backend/.env.example`.

> For pharmacy compliance, avoid storing unnecessary PHI in free text; prefer coded fields and minimum data retention.

---

## 2) Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

API base: `http://localhost:8000`

Key routes:
- `POST /prescriptions` create canceled prescription record
- `GET /prescriptions/pull-queue` list items due for pull
- `POST /prescriptions/{id}/call` save call outcome
- `GET /reports/weekly` summary counts for Excel-style reporting

---

## 3) Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Frontend expects backend URL in `VITE_API_BASE_URL`.

---

## 4) Deployment idea

### Backend
- Deploy FastAPI to Render or Railway.
- Add env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Frontend
- Deploy Vite React app to Vercel/Netlify.
- Configure:
  - `VITE_API_BASE_URL=<backend_url>`

### Access from Shoppers work computers
- Use a normal HTTPS URL with no local install required.
- Add optional simple login and role checks (pharmacist/assistant).
- Restrict by IP allowlist if your workplace supports static egress.

---

## Suggested roadmap

1. **MVP (1–2 weeks)**
   - Cancellation form
   - Pull queue by date
   - Call logging
   - Weekly report page/export CSV
2. **Phase 2**
   - Better patient search and duplicate prevention
   - Audit history + user attribution
   - Reminder tasks for unresolved calls
3. **Phase 3**
   - KPI dashboard (return rate, successful contact rate)
   - Integrations (if policy allows)

---

## Operational notes

- Keep statuses simple:
  - `canceled`
  - `pulled`
  - `returned_to_stock`
- Track event timestamps (`canceled_at`, `pulled_at`, `called_at`).
- Enforce consistent call outcomes so reporting stays clean.

If you want, next step can be adding authentication, CSV export, and a print-friendly Friday call list.
