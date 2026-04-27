# Prescription Return-to-Stock (RTS) Tracker

This app is built for your real weekly pharmacy flow:
- **Thursday:** cancel scripts and categorize them
- **Friday:** call patients + pull return-to-stock inventory
- **Dashboard:** track totals and trends by **week/month/3 months/6 months**

## New UI feature
- Added a **Light / Dark mode toggle button** at the top of the dashboard.

## Features currently in this repo
- Add and delete cancellation logs quickly
- Track categories: regular meds, antibiotics, waiters, fridge items, narcotics, central fill
- Dashboard totals:
  - total scripts canceled
  - total scripts called
  - per-category counts
- Status pie chart (`canceled`, `pulled`, `returned_to_stock`)
- Pull queue view for due items

## API routes
- `POST /prescriptions`
- `DELETE /prescriptions/{id}`
- `GET /prescriptions?period=week|month|3m|6m`
- `POST /prescriptions/{id}/call`
- `GET /prescriptions/pull-queue`
- `GET /reports/dashboard?period=week|month|3m|6m`

## Local run
### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Real deployment guide (so it works after your laptop is off)

To use this from work desktops without your laptop running, deploy both backend + frontend to cloud services.

### 1) Create/prepare Supabase project
1. Create project at Supabase.
2. Run `supabase/schema.sql` in SQL editor.
3. Copy:
   - Project URL
   - Service Role Key (for backend server)

### 2) Deploy backend (Render example)
1. Push repo to GitHub.
2. In Render: **New Web Service** → connect repo.
3. Root directory: `backend`.
4. Start command:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
5. Add env vars:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Deploy and copy backend URL (example `https://rts-api.onrender.com`).

### 3) Deploy frontend (Vercel example)
1. In Vercel: **New Project** → import same repo.
2. Root directory: `frontend`.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add env var:
   - `VITE_API_BASE_URL=https://rts-api.onrender.com`
6. Deploy and copy frontend URL.

### 4) Use at work desktops
- Open the frontend URL in browser (Chrome/Edge) on the work computer.
- Since app is cloud-hosted, it works even when your laptop is shut down.
- Optional: bookmark it on each work station.

### 5) Recommended hardening before production
- Add login/auth + audit trail (who changed what)
- Enable backup/retention policy in Supabase
- Restrict backend CORS to only your frontend domain
