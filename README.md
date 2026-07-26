# RunMorp — Elite Running Training App

A mobile-first personal training dashboard for an elite runner. Built with Next.js 15 + Supabase + Tailwind CSS.

## Features

- 📊 **Dashboard** — Stat cards, weekly/monthly volume charts, Pace vs HR dual-axis chart, HR zone distribution
- 🏃 **Run History** — Log activities manually (Apple Watch data entry), filter, edit, delete
- 📅 **Training Plan** — Month calendar + list view, CSV import, planned vs actual comparison, mark complete
- 👤 **Profile** — VO₂max benchmark, PBs, HR zones (Karvonen formula), Pace zones (auto/manual)

## Quick Start

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. In the **SQL Editor**, run `supabase/schema.sql`
3. Then run `supabase/seed.sql` for sample data
4. Copy your project URL and anon key from **Project Settings → API**

### 2. Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## CSV Import (Training Plan)

### Format

Your CSV must have these headers (extra columns are ignored):

```csv
date,day_of_week,phase,session_type,description,distance_km,pace_target,hr_zone,rpe,notes
2026-07-01,Wed,Base,Easy Run,5 km Easy,5,6:45-7:10/km,Z2,3,Conversational Pace
```

| Column | Required | Format | Example |
|--------|----------|--------|---------|
| `date` | ✅ | YYYY-MM-DD | `2026-07-15` |
| `day_of_week` | No | Text | `Mon` |
| `phase` | No | Text | `Base`, `Build` |
| `session_type` | No | Text | `Easy Run`, `Intervals` |
| `description` | No | Text | `6x400m @4:40/km` |
| `distance_km` | No | Number | `8` |
| `pace_target` | No | Text | `6:00-6:30/km` |
| `hr_zone` | No | Text | `Z2`, `Z4` |
| `rpe` | No | Number or `-` | `7` |
| `notes` | No | Text | `Fuel practice` |

### Import Steps

1. Go to **Training Plan** page
2. Tap the **↑ (upload)** icon in the header
3. Drop your CSV file or browse to select it
4. Review the preview (first 5 rows)
5. Tap **Import Plan** — rows are upserted on `date` (existing rows are updated)

The bundled CSV `Running - 10k sup60.csv` can be imported directly.

---

## HR Zones — Karvonen Formula

All HR zones are computed in `lib/hrZones.ts` using:

```
HRR = hr_max - hr_rest
Zone N Min = (HRR × band_min%) + hr_rest
Zone N Max = (HRR × band_max%) + hr_rest
```

| Zone | % HRR | Name |
|------|-------|------|
| Z1 | 50–60% | Recovery |
| Z2 | 60–70% | Aerobic Base |
| Z3 | 70–80% | Tempo |
| Z4 | 80–90% | Threshold |
| Z5 | 90–100% | VO₂max |

---

## Pace Zones

Computed in `lib/paceZones.ts`.

**Auto mode** (recommended): derives zones from your 10K and Half Marathon PBs using a threshold-pace percentage model.

**Manual mode**: enter custom min/max pace strings per zone (e.g., `6:45/km`).

Toggle between modes in the **Profile** page.

---

## Deploy to Vercel

```bash
# Install Vercel CLI (if needed)
npm i -g vercel

# Deploy
vercel --prod
```

Or connect your GitHub repo to [vercel.com](https://vercel.com):

1. Push this repo to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → done

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Next.js 15 (App Router) | Framework |
| Supabase | Postgres database + client |
| Tailwind CSS v4 | Styling |
| Recharts v3 | Charts |
| React Hook Form + Zod | Forms + validation |
| PapaParse | CSV parsing |
| date-fns + date-fns-tz | Date handling (Asia/Bangkok) |
| Phosphor Icons | Icon system |

## Project Structure

```
app/
  dashboard/     # Dashboard with charts
  history/       # Run log
  plan/          # Training plan calendar
  profile/       # Athlete profile
components/
  dashboard/     # Chart components
  layout/        # BottomNav
  plan/          # Calendar, DayDetailSheet, CsvImport
  runs/          # AddRunForm
lib/
  hrZones.ts     # Karvonen HR zone logic (single source of truth)
  paceZones.ts   # Pace zone logic (single source of truth)
  supabase.ts    # Client + TypeScript types
  utils.ts       # Formatting helpers
supabase/
  schema.sql     # Database schema
  seed.sql       # Sample data
```
