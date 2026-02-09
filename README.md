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
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Auth**: NextAuth v5
- **UI**: Tailwind CSS, shadcn/ui, Lucide icons
- **Charts**: Recharts
- **Validation**: Zod
- **Toasts**: Sonner

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+ (see `engines` in package.json)
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
2. Run database migrations (requires DATABASE_URL and DIRECT_URL in .env)
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

# Run migrations (local: db:migrate:dev; production: db:migrate)
npm run db:migrate:dev

# Seed demo data
npm run db:seed

# Start dev server
npm run dev
```

### Seeding Quote of the Day on production

To show "Quote of the day" on the dashboard (Vercel/Neon), seed the `quotes` table. With `NODE_ENV=production`, the seed only upserts quotes (no demo user). Run from your machine using the production DB URL (e.g. from Neon):

```bash
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." NODE_ENV=production npx prisma db seed
```

Apply migrations first (`npx prisma migrate deploy`). Quotes are upserted by `(text, author)`, so you can run the seed multiple times without duplicates.

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Local Development (PostgreSQL / Neon)

Set in `.env` (use Neon connection strings from the Neon dashboard):

```env
DATABASE_URL="postgresql://..."   # Neon pooled/pgbouncer (runtime)
DIRECT_URL="postgresql://..."    # Neon direct (migrations)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-at-least-32-characters"
NODE_ENV="development"
```

### Production (Vercel + Neon)

Set in Vercel Project Settings > Environment Variables (no values in repo):

- `DATABASE_URL` – Neon pooled/pgbouncer connection string
- `DIRECT_URL` – Neon direct connection string
- `NEXTAUTH_URL` – Your Vercel domain (e.g. https://your-app.vercel.app)
- `NEXTAUTH_SECRET` – e.g. `openssl rand -base64 32`
- `NODE_ENV=production`

No additional environment variables are required for AI Coach features (empty state, send-to-calendar, swim level and total meters, post-workout feedback premium fields, quality gates).

## Neon Setup

Add these variables in Vercel (Project Settings > Environment Variables):

- `DATABASE_URL` (pooled/pgbouncer)
- `DIRECT_URL` (direct)
- `APP_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `INTERNAL_CRON_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PRO`
- `OPENAI_API_KEY`

Note: If your password includes `!` or other special characters, the URL must use percent-encoding.

## Release Checks

Pre-launch verification (AI context privacy, entitlements sanity):

```bash
HARDENING_USER_ID=<valid-user-id> npm run hardening:checks
```

**Required env var:** `HARDENING_USER_ID` – ID of a real user for validation. Add to CI secrets if running hardening in automation, or run manually before releases. The main CI workflow does **not** run hardening by default; use the optional manual workflow if needed.

## Production Release Checklist

The app is **release-ready (100/100)**: Sentry monitoring, structured webhook logs, security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy), 33 unit tests covering billing, rate-limit, logger, structured error logging (coach, billing), Node.js engines pin, 0 npm audit vulnerabilities, and CI gates (lint + typecheck + test + build) are in place.

### Vercel env vars (required)

Set in Project Settings > Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✓ | Neon pooled/pgbouncer |
| `DIRECT_URL` | ✓ | Neon direct (migrations) |
| `NEXTAUTH_URL` | ✓ | e.g. https://your-app.vercel.app |
| `NEXTAUTH_SECRET` | ✓ | `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | ✓ | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | ✓ | Webhook signing secret |
| `STRIPE_PRICE_ID_PRO` or `PRO_PRICE_ID_MONTHLY` | ✓ | Monthly Pro price ID |
| `INTERNAL_CRON_SECRET` | ✓ | Min 16 chars for cron auth |
| `OPENAI_API_KEY` | ✓ | For AI Coach |
| `SENTRY_DSN` | ✓ | Error monitoring (optional but recommended) |

### Prisma migrate deploy

```bash
npx prisma migrate deploy
```

### Stripe webhook

1. **Endpoint URL**: `https://your-app.vercel.app/api/billing/webhook`
2. **Required events**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
3. **Signing secret**: Confirm "Signing secret" is set in Stripe Dashboard and matches `STRIPE_WEBHOOK_SECRET`

### Verify subscription flow

1. Run test checkout in Stripe test mode
2. Confirm DB `Subscription` row updates
3. Confirm UI switches from trial to PRO

### Monitoring / uptime

Use `/api/health` for uptime checks (Vercel Health Checks, UptimeRobot, etc.). Returns `200` with `{ status: "healthy", database: "connected" }` when DB is reachable. Response has `Cache-Control: no-store` so monitors get fresh status.

### Before shipping

1. `npm run ci` (lint + typecheck + build) passes
2. `npm run test` (runs in CI)
3. Run `hardening:checks` with `HARDENING_USER_ID` set
4. Smoke-test auth (login/register) and locale switching
5. Verify env vars in production

## Manual Smoke Checklist (New Features)

1. **Create account → onboarding**: Register a new user; should see 3-step onboarding wizard; complete or skip.
2. **Generate plan**: In onboarding step 3 or via AI Coach, generate a 7-day plan; verify sessions appear in Calendar.
3. **"What should I do today?"**: On Dashboard or Today, click the CTA; modal should show AI decision (DO_THIS_WORKOUT / LIGHT_ALTERNATIVE / REST_TODAY).
4. **Notifications bell**: Open app header; bell icon shows notification count; dropdown lists items; click leads to correct view.
5. **Weekly digest**: Go to Dashboard; if digest exists, "Weekly digest" section visible; click "View all" → /digest page; digest list and detail view work.

## PWA install (mobile + desktop)

AdaptivAI is an installable PWA. Checklist:

- **HTTPS** – Required (Vercel provides this).
- **Manifest** – `public/manifest.webmanifest` with name, icons (192/512, maskable), start_url, theme_color.
- **Service worker** – Generated by `@ducanh2912/next-pwa` in production; caches static assets and pages; **API, auth, and billing routes are never cached**.
- **Install on desktop** – Chrome/Edge: Install icon in address bar or menu → Install app.
- **Install on iOS** – Safari only: Share → Add to Home Screen. See `/install` for steps.
- **Install on Android** – Chrome: menu → Install app or Add to Home screen.

Install instructions (public, no auth): **[/install](/install)**.

### PWA QA / tests

1. **DevTools → Application → Manifest**  
   Check that manifest loads (200), icons and `start_url` are correct.

2. **DevTools → Application → Service Worker**  
   In production build, confirm the service worker is registered and active. No caching for `/api/*`.

3. **Lighthouse → PWA**  
   Run PWA audit; fix any critical issues (installable, manifest, SW, icons).

4. **Manual**  
   - Desktop: Chrome/Edge on Windows or macOS → open app URL → Install app.  
   - iOS: Safari → Share → Add to Home Screen.  
   - Android: Chrome → menu → Install app.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run ci` | CI gates: lint + typecheck + test + build |
| `npm run test` | Run unit tests (entitlements, subscription mapper, checkout-prices, rate-limit, logger) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript check (no emit) |
| `npm run hardening:checks` | Pre-launch privacy/entitlement checks (requires HARDENING_USER_ID) |
| `npm run setup` | Full setup: generate + migrate + seed + dev |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Deploy migrations (production) |
| `npm run db:migrate:dev` | Create/apply migrations (local dev) |
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

### 1. Create Neon Project

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the pooled/pgbouncer and direct connection strings from the Neon dashboard

### 2. Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables (no secrets in repo):
   - `DATABASE_URL` – Neon pooled/pgbouncer connection string
   - `DIRECT_URL` – Neon direct connection string
   - `NEXTAUTH_URL` – Your Vercel domain (e.g. https://your-app.vercel.app)
   - `NEXTAUTH_SECRET` – e.g. `openssl rand -base64 32`

### 3. Run Migrations on Production

From your machine (with env set) or via Vercel post-deploy:

```bash
npm run db:migrate
npm run db:seed
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
# Reset database and re-seed (PostgreSQL)
npm run db:reset
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
