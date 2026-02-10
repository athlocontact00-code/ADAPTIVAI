# Store-ready release – summary of changes

This document summarizes the “store-ready” release: legal pages, cookie consent, PWA polish, Capacitor native wrappers, and billing/Stripe consistency. All changes are minimal and safe for production.

---

## A) Canonical URLs / env

- **README.md**: Replaced example `https://your-app.vercel.app` with `https://www.adaptivai.online` for NEXTAUTH_URL and Stripe webhook endpoint.
- **No code changes**: `getAppUrl()` and billing already use `APP_URL` / `NEXTAUTH_URL` from env. No hardcoded vercel.app domains were found in app code.

**Vercel env (production):**

- `NEXTAUTH_URL=https://www.adaptivai.online`
- `APP_URL=https://www.adaptivai.online`
- `NEXT_PUBLIC_APP_URL=https://www.adaptivai.online` (optional; for client when needed)

---

## B) Legal pages (public, indexable)

**Created:**

- `app/(legal)/layout.tsx` – Minimal header + footer for all legal pages.
- `app/(legal)/privacy/page.tsx` – Privacy Policy at `/privacy`.
- `app/(legal)/terms/page.tsx` – Terms of Service at `/terms`.
- `app/(legal)/cookies/page.tsx` – Cookies Policy at `/cookies`.
- `app/(legal)/delete-account/page.tsx` – Account deletion instructions + contact at `/delete-account`.

**Footer:**

- `components/legal-footer.tsx` – Links to Privacy, Terms, Cookies, Delete account & contact. Supports `compact` for sidebar.
- **Updated:** `app/(marketing)/page.tsx` – Replaced inline footer with `<LegalFooter />`.
- **Updated:** `components/app-shell.tsx` – Added `<LegalFooter compact />` in sidebar bottom.

Legal pages use the same dark UI and are public (no auth). Replace placeholder text with final legal copy and contact details (e.g. support email) before store submission.

---

## C) Cookie consent (GDPR-friendly)

- **Created:** `lib/cookie-consent.ts` – Storage helpers: `getStoredConsent()`, `setStoredConsent()`, `mayLoadAnalytics()`. Saves choice in `localStorage` and cookie `cookie_consent` (values: `all` | `essential`).
- **Created:** `components/cookie-consent-banner.tsx` – Banner with “Accept all”, “Reject non-essential”, “Manage preferences”. Manage opens a modal; choice is persisted and banner hidden.
- **Created:** `hooks/use-cookie-consent.ts` – `useCookieConsent()` returns `{ analyticsAllowed }` for future analytics (only true when consent is “all”).
- **Updated:** `app/layout.tsx` – Rendered `<CookieConsentBanner />` in root layout so it shows on first visit site-wide.

No analytics are loaded yet; the hook is ready when you add tracking.

---

## D) PWA polish

- **Updated:** `README.md` – Added “PWA icon checklist” table: required files (icon-192, icon-512, maskable variants, apple-touch-icon, favicons) and that manifest must reference them with correct `sizes`, `type`, `purpose`; `theme_color` and `background_color` (e.g. `#0a0a0a`).

Existing `public/manifest.webmanifest` and icons already meet this. Regenerate with `npm run pwa:icons` if needed.

---

## E) Capacitor (native wrappers)

- **Created:** `capacitor.config.ts` – `appId: "com.adaptivai.app"`, `appName: "AdaptivAI"`, `webDir: "public"`, `server.url: "https://www.adaptivai.online"` so the app loads the production URL in the WebView.
- **Created:** `docs/CAPACITOR_AND_STORE.md` – Config, scripts, production vs local dev, deep links (`adaptivai://`), Universal Links / App Links placeholders, and store checklists.
- **Updated:** `package.json` – Added scripts: `cap:add`, `cap:sync`, `cap:open:ios`, `cap:open:android`. Added dependencies: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`.
- **Added:** Native projects `ios/` and `android/` (by `npx cap add ios` and `npx cap add android`).

For local dev: comment out the `server` block in `capacitor.config.ts` or set `server.url` to your dev server (e.g. `http://YOUR_IP:3000`), then `npm run cap:sync` and open in Xcode/Android Studio.

---

## F) Stripe / billing polish

- **Confirmed:** Webhook path is `/api/billing/webhook` (no change). Billing return URLs use `getAppUrl()` and `BILLING_SETTINGS_PATH` (e.g. `https://www.adaptivai.online/settings?tab=billing`).
- **Updated:** `app/(app)/settings/page.tsx` – Under “Manage subscription” (Pro users), added hint: “Manage subscription opens the Stripe portal and returns you here when done.”

---

## G) File list (created / edited)

**Created:**

- `app/(legal)/layout.tsx`
- `app/(legal)/privacy/page.tsx`
- `app/(legal)/terms/page.tsx`
- `app/(legal)/cookies/page.tsx`
- `app/(legal)/delete-account/page.tsx`
- `components/legal-footer.tsx`
- `components/cookie-consent-banner.tsx`
- `lib/cookie-consent.ts`
- `hooks/use-cookie-consent.ts`
- `capacitor.config.ts`
- `docs/CAPACITOR_AND_STORE.md`
- `docs/STORE_READY_RELEASE.md`
- `ios/` (Capacitor iOS project)
- `android/` (Capacitor Android project)

**Edited:**

- `README.md` – Canonical URL examples, PWA icon checklist, Capacitor scripts + link to docs.
- `app/(marketing)/page.tsx` – Use `LegalFooter`; import.
- `components/app-shell.tsx` – Import and render `LegalFooter` (compact) in sidebar.
- `app/layout.tsx` – Import and render `CookieConsentBanner`.
- `app/(app)/settings/page.tsx` – Billing UI hint under “Manage subscription”.
- `package.json` – Capacitor scripts and dependencies.

---

## Store submission checklist (short)

**iOS (App Store Connect):** App name, description, Privacy Policy URL (`https://www.adaptivai.online/privacy`), Support/contact URL, screenshots, App Privacy (data declaration), age rating, pricing, in-app purchase setup if applicable.

**Android (Play Console):** App name, short/full description, Privacy Policy URL, Data safety form, screenshots, content rating, target audience, pricing.

See `docs/CAPACITOR_AND_STORE.md` for the full checklist and deep-link setup.
