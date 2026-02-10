import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookies Policy - AdaptivAI",
  description: "How AdaptivAI uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-2xl font-bold mb-6">Cookies Policy</h1>
      <p className="text-muted-foreground text-sm mb-4">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold mt-6">What are cookies</h2>
        <p className="text-muted-foreground">
          Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and improve your experience.
        </p>

        <h2 className="text-lg font-semibold mt-6">Cookies we use</h2>
        <ul className="text-muted-foreground list-disc pl-6 space-y-1">
          <li><strong>Essential</strong> – Required for login, security, and core functionality. We do not ask for consent for these.</li>
          <li><strong>Preferences</strong> – e.g. language, theme. Stored based on your choices.</li>
          <li><strong>Analytics (optional)</strong> – If you accept optional cookies, we may use analytics to understand how the app is used. You can change this in cookie preferences at any time.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">Your choices</h2>
        <p className="text-muted-foreground">
          When you first visit, you can accept all cookies, reject non-essential cookies, or manage preferences. Your choice is stored so we do not ask again until it expires or you clear data. You can change your mind via the cookie banner or settings.
        </p>

        <h2 className="text-lg font-semibold mt-6">More information</h2>
        <p className="text-muted-foreground">
          For how we use personal data, see our <a href="/privacy" className="text-primary underline">Privacy Policy</a>.
        </p>
      </section>
    </article>
  );
}
