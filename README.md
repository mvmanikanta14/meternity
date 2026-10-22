# Maternity – Pregnancy Tracker 🤰

A mobile-first pregnancy tracking app covering the full 9-month (40-week) journey.

- **App:** React 18 + Vite (mobile app design, installable as a PWA)
- **Storage:** everything is saved in the browser's localStorage — no backend or database

Data stays on the device and browser it was entered in. Clearing site data / browser cache
deletes it, and it does not sync between phones or browsers.

## Features

| Screen | What it does |
| --- | --- |
| **Login / Sign up** | Local accounts on this device (hashed passwords), several people can share one browser |
| **Setup** | Enter last period date *or* due date → due date, week and trimester are calculated |
| **Home** | Progress ring with current week, days to go, % done, due date, baby size (fruit), tip of the week, next visit |
| **Baby (Week by week)** | All 40 weeks: baby size, length, weight, baby development, changes in mom's body, tips |
| **Health** | Daily log: weight, blood pressure, water, mood, symptoms, notes; weight trend chart; high-BP warning |
| **Visits** | Doctor appointments (check-ups, scans, tests): add, edit, mark done, upcoming / past |
| **Kick counter** | Tap to count baby kicks with a timer, goal of 10, saved history |
| **Medicines & water** | Daily medicine checklist, water glasses counter, last-7-days view, medicine-time and water reminders (while the app is open) |
| **Scan & lab reports** | Upload report photos / PDFs (kept in IndexedDB); values (Hb, sugar, TSH, platelets, urine, baby heart rate, AFI, EFW), report type and date are **auto-filled** by reading the file in the browser (tesseract.js OCR for photos, pdf.js for PDFs); results are checked against pregnancy ranges with trend charts |
| **Contraction timer** | Start/stop each contraction, length and gap, last-hour averages, 5-1-1 "go to hospital" alert |
| **Hospital bag** | Ready-made packing checklist by section (documents, mom, baby, partner), add your own items |
| **Baby names** | Shortlist with meanings, favourites, girl/boy filter and name ideas |
| **Backup & restore** | Download all data (including report files) as one file and restore it on any phone or browser |
| **Me (Profile)** | Blood group, doctor, hospital, phone, change dates, emergency warning signs + 108 call button |

## Run it

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

### Open on your phone

`npm run dev` listens on your local network. Connect your phone to the same Wi-Fi and open
`http://<your-PC-IP>:5173` (shown in the terminal as "Network"). Use the browser's
**Add to Home screen** to install it like an app.

### Default login

The account **prasu / 123456** is created in each browser the first time the app opens.

## Deploy to Vercel

On vercel.com, **Add New → Project** and import this GitHub repo (keep the default settings).
`vercel.json` builds the frontend as a static site — no database or environment variables needed.

## Project structure

```
frontend/
  src/
    pages/         # Home, Weeks, Health, Appointments, KickCounter, Profile, Auth, Setup
    components/    # Layout (bottom tab bar), icons, bottom sheet, progress ring
    context/       # auth state
    api.js         # data layer: everything saved in localStorage
    fileStore.js   # report photos / PDFs saved in IndexedDB
    reportRanges.js # pregnancy reference ranges used to check report values
    reportScan.js  # reads report photos / PDFs and picks out the test values
    weekData.js    # 40-week pregnancy guide content
    styles.css     # design system
```

> Information in this app is general guidance and does not replace medical advice.
