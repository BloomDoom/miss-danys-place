# Ms Dany's Place

Admin app for a one-teacher English school: classes, attendance, make-ups and
monthly payments. Mobile-first PWA, made for an iPhone Home Screen.

**Stack:** React + Vite (plain JS) · Supabase (Postgres + Auth) · GitHub Pages

## Project structure

```
index.html                  iPhone/PWA meta tags
vite.config.js              build settings + PWA manifest and service worker
supabase/
  schema.sql                all tables and security rules (run first)
  02-payments.sql           monthly fees function (run second)
  reset-test-data.sql       ⚠️ erases all data (only before loading real data)
src/
  main.jsx                  starts React, the router and the crash screen
  App.jsx                   login check, routes, offline banner
  index.css                 all styles (colors/sizes at the top)
  lib/
    sessions.js             which classes happen on which day (the core logic)
    payments.js             fee statuses: paid / partial / unpaid / overdue
    makeups.js              make-up statuses
    format.js               dates, months, money (Argentine format)
    useLoad.js              loading data in a screen (+ unwrap)
    backup.js, csv.js       CSV export and import
    phone.js, groups.js, errors.js, supabase.js, useOnline.js
  components/               reusable pieces (tab bar, toast, pay panel, ...)
  screens/                  one file per screen
public/                     icons (copied as-is)
.github/workflows/          deploy to GitHub Pages + keep Supabase awake
```

**How classes work:** weekly classes are never stored in advance. For each
day the app calculates them from `group_slots`, and mixes in rows from
`sessions` for classes that were cancelled, moved, had attendance saved, or
are extras (see `src/lib/sessions.js`).

**How fees work:** when the Payments screen opens a month, `ensure_charges`
creates one fee per student per group, copying the price of that month.
Changing a price only updates fees with no payments and no hand edit.

## One-time setup

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com). Pick the
   São Paulo region (closest to Argentina).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and press **Run**.
   Then do the same with `supabase/02-payments.sql` (the monthly fees function).
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
4. **Authentication → Users → Add user → Create new user**: her email and a
   password, with "Auto Confirm User" ticked.
5. **Project Settings → API Keys**: copy the Project URL and the **publishable**
   key (or the legacy "anon" key).

### 2. Run it on your computer
```
cp .env.example .env     # then paste the URL and key into .env
npm install
npm run dev
```
Open the "Network" address it prints (e.g. `http://192.168.0.10:5173`) on a
phone on the same Wi-Fi to try it there.

### 3. GitHub Pages
1. Push this folder to a **public** GitHub repo.
2. Repo **Settings → Secrets and variables → Actions → New repository secret**:
   add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`.
3. Repo **Settings → Pages → Source**: choose **GitHub Actions**.
4. Every push to `main` now deploys to `https://<user>.github.io/<repo>/`.
   You can watch it run in the **Actions** tab.

### 4. Install on the iPhone
Open the site in **Safari** → Share button → **Add to Home Screen**. Open the
app from the new icon and log in once. The Home Screen app keeps its own login,
separate from Safari.

## Loading data from the paper sheets
First, erase the test data: paste `supabase/reset-test-data.sql` in the SQL
Editor and run it (this can't be undone).

Then Groups → gear → **Import from a spreadsheet**. Import groups first, then
students. Commas or semicolons both work (Excel in Spanish uses `;`).

```
name,level,schedule,price,notes
Kids A1,Beginners,Tue 17:00 60 / Thu 17:00 60,25000,

name,group,phone,parent_name,parent_phone,start_date,notes
Sofía Pérez,Kids A1,,Laura Pérez,11 5555-1234,01/03/2026,
```
Rows with problems are shown before anything is saved. Names that already
exist are skipped, so importing the same file twice is safe.

## Good to know
- **Keep-alive:** Supabase pauses free projects after 7 days without use.
  `keep-alive.yml` pings it every 3 days. GitHub turns off scheduled workflows
  in repos with no commits for 60 days and emails you first. If that happens,
  re-enable it in the Actions tab.
- **Backups:** the free plan has no automatic backups. Settings → **Make a
  backup** → **Save backup files** exports every table as CSV (on the iPhone
  it opens the Share sheet: save to Files/Drive or email it). Do it monthly.
- **Nothing is ever deleted** by the app: payments, fees and absences get a
  `deleted_at` date instead, and the database doesn't even allow deleting them.
- **Updates:** after a deploy, the phone picks up the new version the next time
  the app is opened (sometimes it takes a second open).
