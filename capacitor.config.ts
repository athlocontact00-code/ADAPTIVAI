import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for AdaptivAI native wrappers (iOS / Android).
 *
 * Production (App Store / Play Store): the app loads the live web app.
 * Set server.url to your canonical URL so the WebView opens https://www.adaptivai.online.
 * For local dev, set server.url to http://YOUR_IP:3000 (or leave unset to use webDir).
 */
const config: CapacitorConfig = {
  appId: "com.adaptivai.app",
  appName: "AdaptivAI",
  webDir: "public",
  // Load production URL in WebView. Comment out for local dev (then webDir is used if you have index.html there).
  server: {
    url: "https://www.adaptivai.online",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
