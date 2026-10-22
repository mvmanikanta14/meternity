# Maternity – Pregnancy Tracker 🤰

A mobile-first pregnancy tracking app covering the full 9-month (40-week) journey.

- **Frontend:** React 18 + Vite (mobile app design, installable as a PWA)
- **Backend:** Python FastAPI + SQLite

## Features

| Screen | What it does |
| --- | --- |
| **Login / Sign up** | Account with secure (PBKDF2) password hashing and token sessions |
| **Setup** | Enter last period date *or* due date → due date, week and trimester are calculated |
| **Home** | Progress ring with current week, days to go, % done, due date, baby size (fruit), tip of the week, next visit |
| **Baby (Week by week)** | All 40 weeks: baby size, length, weight, baby development, changes in mom's body, tips |
| **Health** | Daily log: weight, blood pressure, water, mood, symptoms, notes; weight trend chart; high-BP warning |
| **Visits** | Doctor appointments (check-ups, scans, tests): add, edit, mark done, upcoming / past |
| **Kick counter** | Tap to count baby kicks with a timer, goal of 10, saved history |
| **Me (Profile)** | Blood group, doctor, hospital, phone, change dates, emergency warning signs + 108 call button |

## Run it

### 1. Backend (Python)

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to the backend on port 8000.

### Open on your phone

`npm run dev` listens on your local network. Connect your phone to the same Wi-Fi and open
`http://<your-PC-IP>:5173` (shown in the terminal as "Network"). Use the browser's
**Add to Home screen** to install it like an app.

### Default login

On startup the backend creates the account **prasu / 123456** if it doesn't exist.

## Deploy to Vercel

The repo is ready for Vercel: `vercel.json` builds the frontend, and `api/index.py` runs the
FastAPI backend as a serverless function under `/api`.

1. On vercel.com, **Add New → Project** and import this GitHub repo (keep the default settings).
2. In the project, open **Storage → Create Database → Neon (Postgres)** and connect it to the
   project. This sets `DATABASE_URL`, which switches the backend from SQLite to Postgres.
3. **Redeploy** so the new variable is picked up.

Without `DATABASE_URL` the backend uses the local SQLite file, which Vercel does not keep.

## Project structure

```
backend/
  app/
    main.py        # API routes
    database.py    # SQLite schema & connection
    security.py    # password hashing, sessions
    schemas.py     # request validation
    week_data.py   # 40-week pregnancy guide content
frontend/
  src/
    pages/         # Home, Weeks, Health, Appointments, KickCounter, Profile, Auth, Setup
    components/    # Layout (bottom tab bar), icons, bottom sheet, progress ring
    context/       # auth state
    api.js         # API client
    styles.css     # design system
```

> Information in this app is general guidance and does not replace medical advice.
