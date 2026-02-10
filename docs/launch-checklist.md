# Launch checklist (store & web)

Use this list before submitting to App Store / Google Play or going live.

## App metadata

| Item | Value / notes |
|------|----------------|
| **App name** | AdaptivAI |
| **Short description** | e.g. "AI-powered training for endurance athletes" (store character limits apply) |
| **Long description** | Full pitch: triathletes, swimmers, check-in, AI Coach, calendar, progress. No fake claims. |
| **Support URL** | https://www.adaptivai.online/contact |
| **Privacy Policy URL** | https://www.adaptivai.online/privacy |
| **Data deletion URL** | https://www.adaptivai.online/data-deletion |

## Icons & assets

| Asset | Size | Location / notes |
|-------|------|------------------|
| PWA icon (any) | 192×192, 512×512 | `public/icons/icon-192.png`, `icon-512.png` |
| PWA icon (maskable) | 192×192, 512×512 | `public/icons/icon-192-maskable.png`, `icon-512-maskable.png` |
| Apple touch icon | 180×180 | `public/apple-touch-icon.png` |
| Favicon | 16×16, 32×32 | `public/favicon-16.png`, `public/favicon-32.png` |

Regenerate all: `npm run pwa:icons`.

## Screenshots (stores)

- **Mobile**: Phone (e.g. 6.5", 5.5"). Key screens: login, dashboard, calendar, coach, settings.
- **Tablet** (if supported): 7", 10".
- **Desktop** (PWA): Optional for web listing.

## Content ratings

- **iOS**: Complete App Store Connect questionnaire (e.g. no objectionable content).
- **Android**: Complete Data safety and content rating in Play Console.

## PWA install

- **Instructions**: Public page at `/install` (Add to Home Screen / Install app).
- **Manifest**: `public/manifest.webmanifest` — name, short_name, icons, theme_color, background_color.

## Legal & consent

- [ ] Privacy Policy live at `/privacy`
- [ ] Terms at `/terms`
- [ ] Cookies at `/cookies`
- [ ] Contact at `/contact`
- [ ] Data deletion at `/data-deletion`
- [ ] Cookie banner shows and persists choice (Accept / Reject / Manage)

## Smoke test

Run through `docs/smoke-test.md` on mobile and desktop before release.
