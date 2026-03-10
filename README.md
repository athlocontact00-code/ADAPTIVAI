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
- `NEXTAUTH_URL` – Canonical app URL (e.g. https://www.adaptivai.online)
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

Adaptive planner freshness is protected by a dedicated CI check: `planner-regression`. Run `npm run test:planner-regression` locally when changing planner cache freshness, invalidation, `today-decision`, stale recommendation copy/badges, shared planner status headers, launcher freshness summaries, premium check-in or conflict review freshness UI, check-in result handoff after auto-apply/undo, shared plan adaptation copy across check-in/conflict/coach flows, shared proposal review loop via Calendar deep links, Calendar proposal review context headers, Calendar URL cleanup after proposal decisions, Calendar proposal review state helpers, Calendar page server-side proposal resolution, pending coach change visibility across Coach/Dashboard/Calendar, coach suggestion handoff into Calendar review context, coach review context cleanup after Calendar actions, coach review target cleanup after Coach actions, shared coach review copy/CTA labels, shared coach review outcome copy, next-step CTA after coach review resolution, resolved coach review handoff back into Coach, resolved coach review handoff into Dashboard, or check-in driven workout adaptation. See `docs/PLANNER_REGRESSION_SUITE.md`.

Coach planning quality is protected by a separate CI check: `coach-planning-regression`. Run `npm run test:coach-planning-regression` locally when changing coach prescription logic, coach calendar insert flows, or coach-applied workout plan updates. See `docs/COACH_PLANNING_REGRESSION_SUITE.md`.

Coach prompt quality is protected by `coach-prompts-regression`. Run `npm run test:coach-prompts-regression` locally when changing coach prompt templates, intent-to-prompt constraints, swim PR pace injection, or compact context shaping. See `docs/COACH_PROMPTS_REGRESSION_SUITE.md`.

Coach output/parser quality is protected by `coach-output-regression`. Run `npm run test:coach-output-regression` locally when changing save-to-calendar parsing, fallback workout extraction, or `calendarInsert` response normalization. See `docs/COACH_OUTPUT_REGRESSION_SUITE.md`.

Coach response semantics are protected by `coach-semantics-regression`. Run `npm run test:coach-semantics-regression` locally when changing workout quality gates, required sections, sport-specific structure validation, coach correction retries, swim hard guards, swim meter auto-fix helpers, response finalization logic, response envelope/meta shaping, request routing heuristics, manual add workout orchestration, manual workout parsing, lightweight today/plan response handlers, deterministic fallback behavior, workout creation assembly, or shared coach chat utilities in coach replies and auto-save JSON flows. See `docs/COACH_SEMANTICS_REGRESSION_SUITE.md`.

AI memory/context quality is protected by `memory-context-regression`. Run `npm run test:memory-context-regression` locally when changing AI memory aggregation, visibility filtering, or privacy rules in AI context building. See `docs/MEMORY_CONTEXT_REGRESSION_SUITE.md`.

Rule of thumb:
- `planner-regression` protects recommendation freshness and invalidation.
- `coach-planning-regression` protects workout generation, prescription quality, and coach plan application flows.
- `coach-prompts-regression` protects coach prompt construction, intent constraints, and prompt compactness/privacy hardening.
- `coach-output-regression` protects coach response parsing, save-to-calendar contracts, and fallback workout extraction.
- `coach-semantics-regression` protects the actual structure and training usefulness of coach workout replies.
- `memory-context-regression` protects privacy filtering and visibility-aware AI context shaping.

## Production Release Checklist

The app is **release-ready (100/100)**: Sentry monitoring, structured webhook logs, security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy), unit coverage for billing, planner freshness, and coach prompt shaping flows, Node.js engines pin, 0 npm audit vulnerabilities, and CI gates (`planner-regression` + targeted AI regression checks + quality checks) are in place.

### Vercel env vars (required)

Set in Project Settings > Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✓ | Neon pooled/pgbouncer |
| `DIRECT_URL` | ✓ | Neon direct (migrations) |
| `NEXTAUTH_URL` | ✓ | e.g. https://www.adaptivai.online |
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

1. **Endpoint URL**: `https://www.adaptivai.online/api/billing/webhook`
2. **Required events**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
3. **Signing secret**: Confirm "Signing secret" is set in Stripe Dashboard and matches `STRIPE_WEBHOOK_SECRET`

### Verify subscription flow

1. Run test checkout in Stripe test mode
2. Confirm DB `Subscription` row updates
3. Confirm UI switches from trial to PRO

### Monitoring / uptime

Use `/api/health` for uptime checks (Vercel Health Checks, UptimeRobot, etc.). Returns `200` with `{ status: "healthy", database: "connected" }` when DB is reachable. Response has `Cache-Control: no-store` so monitors get fresh status.

### Before shipping

1. `npm run ci` passes
2. `npm run test:planner-regression` passes if planner freshness/invalidation changed
3. `npm run test:coach-planning-regression` passes if coach planning logic changed
4. `npm run test:coach-prompts-regression` passes if coach prompt shaping changed
5. `npm run test:coach-output-regression` passes if coach parser/save contract changed
6. `npm run test:coach-semantics-regression` passes if coach workout quality gates changed
7. `npm run test:memory-context-regression` passes if AI memory/context logic changed
8. `npm run test` passes
9. Run `hardening:checks` with `HARDENING_USER_ID` set
10. Smoke-test auth (login/register) and locale switching
11. Verify env vars in production

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

### PWA icon checklist (required files)

| File | Size | Purpose |
|------|------|---------|
| `public/icons/icon-192.png` | 192×192 | any |
| `public/icons/icon-512.png` | 512×512 | any |
| `public/icons/icon-192-maskable.png` | 192×192 | maskable |
| `public/icons/icon-512-maskable.png` | 512×512 | maskable |
| `public/apple-touch-icon.png` | 180×180 | iOS Add to Home Screen |
| `public/favicon.png` or `favicon.ico` | 32×32 | Browser tab |
| `public/favicon-16.png` | 16×16 | Optional |
| `public/favicon-32.png` | 32×32 | Optional |

Manifest: `public/manifest.webmanifest` must reference the above icons with correct `sizes`, `type`: `image/png`, and `purpose`: `any` or `maskable`. Set `theme_color` and `background_color` (e.g. `#0a0a0a` for dark UI). Regenerate all with `npm run pwa:icons`.

### Odświeżenie ikony PWA po deployu

Po wdrożeniu nowej wersji ikon (np. po `npm run pwa:icons` i deployu) ikona na urządzeniu może się nie zaktualizować z powodu cache. Żeby zobaczyć nową ikonę:

1. **Odinstaluj PWA** (Chrome: ikona aplikacji → prawy przycisk → Usuń; Android: długie przytrzymanie ikony → Odinstaluj; iOS: długie przytrzymanie → Usuń aplikację).
2. **Wyczyść dane witryny** (opcjonalnie): Chrome → DevTools → Application → Storage → Clear site data (lub w ustawieniach przeglądarki — dane witryny dla Twojej domeny).
3. **Zainstaluj ponownie** (Install app / Add to Home Screen).

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run ci` | CI gates: lint + typecheck + test + build |
| `npm run smoke` | Lightweight smoke: typecheck + build (verifies core pages compile) |
| `npm run test` | Run unit tests (entitlements, subscription mapper, checkout-prices, rate-limit, logger) |
| `npm run test:coach-planning-regression` | Run coach planning and prescription regression suite |
| `npm run test:coach-planning-regression:watch` | Watch coach planning and prescription regression suite |
| `npm run test:coach-output-regression` | Run coach output parsing and save-to-calendar regression suite |
| `npm run test:coach-output-regression:watch` | Watch coach output parsing and save-to-calendar regression suite |
| `npm run test:coach-prompts-regression` | Run coach prompt shaping regression suite |
| `npm run test:coach-prompts-regression:watch` | Watch coach prompt shaping regression suite |
| `npm run test:coach-semantics-regression` | Run coach workout semantics and quality gate regression suite |
| `npm run test:coach-semantics-regression:watch` | Watch coach workout semantics and quality gate regression suite |
| `npm run test:memory-context-regression` | Run AI memory and context privacy regression suite |
| `npm run test:memory-context-regression:watch` | Watch AI memory and context privacy regression suite |
| `npm run test:planner-regression` | Run Adaptive Day Planner freshness/invalidation regression suite |
| `npm run test:planner-regression:watch` | Watch planner freshness/invalidation regression suite |
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
| `npm run pwa:icons` | Regenerate PWA icons + favicons from `assets/logo.png` or `assets/logo-1024.png` (or create `assets/logo-1024.png` from built-in sygnet). |
| `npm run cap:sync` | Sync web assets to native iOS/Android (Capacitor). |
| `npm run cap:open:ios` | Open iOS project in Xcode. |
| `npm run cap:open:android` | Open Android project in Android Studio. |

See [docs/CAPACITOR_AND_STORE.md](docs/CAPACITOR_AND_STORE.md) for Capacitor setup, production URL, deep links, and store submission checklists.

See [docs/COACH_PLANNING_REGRESSION_SUITE.md](docs/COACH_PLANNING_REGRESSION_SUITE.md) for the dedicated coach planning regression gate.

See [docs/MEMORY_CONTEXT_REGRESSION_SUITE.md](docs/MEMORY_CONTEXT_REGRESSION_SUITE.md) for the dedicated AI memory/context regression gate.

See [docs/PLANNER_REGRESSION_SUITE.md](docs/PLANNER_REGRESSION_SUITE.md) for the dedicated Adaptive Day Planner regression gate.

## Manual QA checklist (web + PWA)

After deploy, run through these checks:

**Web (desktop + mobile viewports)**  
- [ ] Landing: hero, CTAs, how it works, features, pricing teaser, screenshots, FAQ, final CTA; no horizontal scroll.  
- [ ] Login / Register flow; redirect to dashboard or onboarding.  
- [ ] App: Dashboard, Calendar, Coach, Settings, Progress, Simulator — all scroll smoothly; no double scrollbars; no overflow-x.  
- [ ] Sticky header stays visible; main content scrolls underneath.  
- [ ] Modals/drawers: open and close; body scroll lock only while open.

**PWA**  
- [ ] Install prompt (Chrome/Edge); Add to Home Screen (iOS Safari).  
- [ ] After install: icon and name correct; app opens and loads.  
- [ ] Safe areas: no content cut off by notch or home bar on iOS.

**Legal & consent**  
- [ ] Footer links: Privacy, Terms, Cookies, Support, Account deletion — all resolve.  
- [ ] Cookie banner on first visit; Accept all / Reject non-essential / Customize; choice persists after reload.

**Console**  
- [ ] No errors on landing and app shell (check DevTools Console).

See [docs/smoke-test.md](docs/smoke-test.md) for a longer smoke list.

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
   - `NEXTAUTH_URL` – Canonical app URL (e.g. https://www.adaptivai.online)
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
