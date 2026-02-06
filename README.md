# AdaptivAI

An intelligent training platform built with Next.js, featuring performance analytics, workout tracking, and training diary functionality.

## Features

- **Dashboard** - KPI cards, performance charts (CTL/ATL/TSB), quote of the day
- **Calendar** - Week view with CRUD for workouts (planned & completed)
- **Diary** - Track mood, energy, sleep, stress, and soreness
- **Settings** - Profile management and heart rate zone configuration
- **Auth** - Email/password authentication with NextAuth

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (dev) / PostgreSQL (prod via Supabase)
- **ORM**: Prisma
- **Auth**: NextAuth v5
- **UI**: Tailwind CSS, shadcn/ui, Lucide icons
- **Charts**: Recharts
- **Validation**: Zod
- **Toasts**: Sonner

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- npm or yarn

### One-Command Setup

```bash
# Clone and install
npm install

# Run setup (generates Prisma client, runs migrations, seeds data, starts dev server)
npm run setup
```

This will:
1. Generate Prisma client
2. Run database migrations (creates SQLite database)
3. Seed demo data
4. Start the development server

### Demo Credentials

After seeding, you can log in with:
- **Email**: `demo@adaptivai.app`
- **Password**: `Demo1234!`

### Manual Setup

If you prefer to run steps individually:

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Start dev server
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Local Development (SQLite)

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-at-least-32-characters"
NODE_ENV="development"
```

### Production (Supabase PostgreSQL)

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your-production-secret-at-least-32-characters"
NODE_ENV="production"
```

## Release Checks

Pre-launch verification (AI context privacy, entitlements sanity):

```bash
HARDENING_USER_ID=<valid-user-id> npm run hardening:checks
```

**Required env var:** `HARDENING_USER_ID` – ID of a real user for validation. Add to CI secrets if running hardening in automation, or run manually before releases. The main CI workflow does **not** run hardening by default; use the optional manual workflow if needed.

## Release Checklist

Before shipping:

1. `npm run ci` (lint + typecheck + build) passes
2. Run `hardening:checks` with `HARDENING_USER_ID` set
3. Smoke-test auth (login/register) and locale switching
4. Verify env vars in production (DATABASE_URL, NEXTAUTH_*, etc.)

## Manual Smoke Checklist (New Features)

1. **Create account → onboarding**: Register a new user; should see 3-step onboarding wizard; complete or skip.
2. **Generate plan**: In onboarding step 3 or via AI Coach, generate a 7-day plan; verify sessions appear in Calendar.
3. **"What should I do today?"**: On Dashboard or Today, click the CTA; modal should show AI decision (DO_THIS_WORKOUT / LIGHT_ALTERNATIVE / REST_TODAY).
4. **Notifications bell**: Open app header; bell icon shows notification count; dropdown lists items; click leads to correct view.
5. **Weekly digest**: Go to Dashboard; if digest exists, "Weekly digest" section visible; click "View all" → /digest page; digest list and detail view work.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run ci` | CI gates: lint + typecheck + build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript check (no emit) |
| `npm run hardening:checks` | Pre-launch privacy/entitlement checks (requires HARDENING_USER_ID) |
| `npm run setup` | Full setup: generate + migrate + seed + dev |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset database (delete all data) |

## Project Structure

```
adaptivai/
├── app/
│   ├── (marketing)/      # Landing page
│   ├── (auth)/           # Login, Register
│   ├── (app)/            # Protected app routes
│   │   ├── dashboard/
│   │   ├── calendar/
│   │   ├── diary/
│   │   ├── settings/
│   │   └── onboarding/
│   └── api/              # API routes
├── components/
│   ├── ui/               # shadcn/ui components
│   └── app-shell.tsx     # Main app layout
├── lib/
│   ├── auth.ts           # NextAuth configuration
│   ├── db.ts             # Prisma client
│   ├── env.ts            # Environment validation
│   ├── utils.ts          # Utility functions
│   └── services/         # Business logic
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed script
└── public/
```

## Database Schema

- **User** - Authentication and profile
- **Profile** - Training preferences, HR zones
- **Workout** - Training sessions (planned/completed)
- **DiaryEntry** - Daily wellness tracking
- **MetricDaily** - CTL, ATL, TSB, readiness scores
- **Quote** - Motivational quotes for dashboard

## Deployment to Vercel

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy the database connection string from Settings > Database

### 2. Update Prisma Schema for PostgreSQL

Change the datasource provider in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 3. Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `DATABASE_URL` - Supabase connection string
   - `NEXTAUTH_URL` - Your Vercel domain
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`

### 4. Run Migrations on Production

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

## Phase B Modules (TODO)

The following features are planned for future development:

- [ ] **Decision Engine** - AI-powered training recommendations
- [ ] **Advanced Readiness** - ML-based recovery prediction
- [ ] **Guardrails** - Overtraining prevention alerts
- [ ] **Simulator** - "What-if" scenario planning
- [ ] **Coach Mode** - Conversational AI coach

## Troubleshooting

### Database Connection Issues

If you see "Server error" on startup:
1. Check that `.env` file exists
2. Verify `DATABASE_URL` is correct
3. Run `npm run db:generate` to regenerate Prisma client

### Reset Everything

```bash
# Delete database and start fresh
rm -rf prisma/dev.db prisma/dev.db-journal
npm run db:migrate
npm run db:seed
```

### Prisma Studio

To visually browse/edit your database:

```bash
npm run db:studio
```

## License

MIT
# ADAPTIVAI
