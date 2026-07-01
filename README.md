# Pacelog — Elite Training Tracker

A mobile-first personal training web app for competitive runners. Built with **Next.js 14+ (App Router)**, **Supabase (Postgres)**, and **Tailwind CSS**. Single-user, no authentication — a private tool for one athlete.

## Features

- **Dashboard** — distance stats, weekly/monthly charts, HR zone distribution, recent activities
- **Run History** — manual run logging with auto pace calculation and live HR zone feedback
- **Training Plan** — CSV import with upsert, agenda/calendar views, completion tracking
- **Profile** — runner stats, pace zones, auto-computed Karvonen HR zones

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

## Supabase Setup

### 1. Create a project

Create a new Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard).

### 2. Run migrations

Open the **SQL Editor** in Supabase and run the migration file:

```
supabase/migrations/001_initial_schema.sql
```

This creates `profiles`, `activities`, and `training_plan` tables with permissive RLS policies for single-user access.

### 3. Seed sample data (optional)

Run `supabase/seed.sql` in the SQL Editor to populate a sample profile and activities.

### 4. Environment variables

Edit `.env.local` in the project root and add your Supabase credentials:

| Variable | Where to find it |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role key (keep secret) |

The app uses the **service role key server-side** for all database operations. The anon key is optional but recommended if you add client-side Supabase calls later.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Import Training Plan CSV

1. Go to **Training Plan**
2. Upload a CSV with columns: `date, day_of_week, phase, session_type, description, distance_km, pace_target, hr_zone, rpe, notes`
3. Review the preview and confirm import

A sample file is included at `supabase/sample-training-plan.csv`. Re-importing updates existing rows by date (no duplicates).

## HR Zones

HR zones (Z1–Z5) are computed automatically from **HR Max** and **HR Rest** using the Karvonen formula:

```
HRR = hr_max - hr_rest
Zone HR = hr_rest + (HRR × intensity%)
```

Update these values in **Profile** and all zone displays across the app update automatically.

## Deploy to Vercel

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add the three environment variables from `.env.local`
4. Deploy

All routes are open — no auth required.

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Supabase Postgres
- Tailwind CSS v4
- Recharts
- React Hook Form + Zod
- PapaParse (CSV import)
- date-fns + date-fns-tz (Asia/Bangkok timezone)

## Project Structure

```
src/
  app/              # Pages (Dashboard, Runs, Training Plan, Profile)
  components/       # UI, charts, page clients
  lib/
    hrZones.ts      # Karvonen HR zone calculations (single source of truth)
    actions/        # Server actions for Supabase
    supabase/       # Supabase client
supabase/
  migrations/       # SQL schema
  seed.sql          # Sample data
```
