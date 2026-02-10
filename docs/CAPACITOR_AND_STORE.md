# Capacitor & store submission (iOS / Android)

## Config

- **appId**: `com.adaptivai.app` (Bundle ID on iOS, Application ID on Android)
- **appName**: AdaptivAI
- **webDir**: `public` (static assets; when `server.url` is set, the WebView loads that URL instead)
- **server.url**: Set to `https://www.adaptivai.online` so the app loads the production web app. No local build required.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run cap:add` | Add a platform, e.g. `npm run cap:add ios` |
| `npm run cap:sync` | Copy web assets and config into native projects |
| `npm run cap:open:ios` | Open iOS project in Xcode |
| `npm run cap:open:android` | Open Android project in Android Studio |

## Production vs local

- **Production (store builds)**: `capacitor.config.ts` has `server.url: "https://www.adaptivai.online"`. The native app is a WebView that loads this URL. Ensure the site is live and returns the correct content for mobile.
- **Local dev**: Comment out the `server` block in `capacitor.config.ts` (or set `server.url` to `http://YOUR_IP:3000`). Run `npm run dev`, then `npm run cap:sync` and open the native project. The app will load your local Next.js server (use your machine’s IP, not localhost, for a physical device).

## Deep links & universal links

### Custom URL scheme: `adaptivai://`

- **iOS**: In Xcode, add URL Type: Identifier `com.adaptivai.app`, URL Scheme `adaptivai`. Then `adaptivai://` links open the app.
- **Android**: In `AndroidManifest.xml`, add an intent filter for `adaptivai` scheme (Capacitor may add this via config; if not, add manually under the main activity).

### Universal Links (iOS) / App Links (Android)

- **iOS**: In App Store Connect / Apple Developer, enable Associated Domains and add `applinks:www.adaptivai.online`. On your server, host `https://www.adaptivai.online/.well-known/apple-app-site-association` with the app’s team ID and bundle ID.
- **Android**: Add intent filters for `https://www.adaptivai.online` and host `https://www.adaptivai.online/.well-known/assetlinks.json` with your app’s package name and signing certificate fingerprint.

These files are not included in the repo; configure them in the Apple/Google consoles and on your domain when you are ready for store submission.

---

## Store submission checklist

### iOS (App Store Connect)

- **App name**, **subtitle**, **description**, **keywords**
- **Privacy Policy URL**: `https://www.adaptivai.online/privacy`
- **Support URL**: e.g. `https://www.adaptivai.online/delete-account` (contact)
- **Category**: Health & Fitness (or Sports)
- **Screenshots**: 6.5", 5.5" (iPhone); iPad if supporting
- **App Privacy**: Declare data collection (account, usage, etc.) and link to Privacy Policy
- **Age rating**: Questionnaire
- **Pricing**: Free (with in-app subscription if applicable)
- **In-App Purchases**: If using Stripe for in-app, you must use IAP for digital goods on iOS; for SaaS you may use Stripe outside the app (e.g. web). Confirm with Apple’s guidelines.

### Android (Google Play Console)

- **App name**, **short description**, **full description**
- **Privacy Policy URL**: `https://www.adaptivai.online/privacy`
- **Data safety**: Declare what data is collected and how it’s used (align with Privacy Policy)
- **Screenshots**: Phone, 7" tablet, 10" tablet (as required)
- **Content rating**: Questionnaire
- **Target audience**: Age groups
- **Pricing**: Free
- **Subscriptions**: If offering in-app, configure products in Play Console or document that billing is via web (Stripe).
