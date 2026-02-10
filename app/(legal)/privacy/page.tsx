import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - AdaptivAI",
  description: "AdaptivAI Privacy Policy. How we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-4">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold mt-6">1. Who we are</h2>
        <p className="text-muted-foreground">
          AdaptivAI (&quot;we&quot;, &quot;our&quot;) operates https://www.adaptivai.online. This policy describes how we collect, use, and protect your personal data when you use our service.
        </p>

        <h2 className="text-lg font-semibold mt-6">2. Data we collect</h2>
        <p className="text-muted-foreground">
          We collect information you provide (email, name, profile and training data), usage data (e.g. how you use the app), and technical data (device, IP) where necessary for security and operation.
        </p>

        <h2 className="text-lg font-semibold mt-6">3. How we use it</h2>
        <p className="text-muted-foreground">
          We use your data to provide and improve the service, personalize your experience, process payments (via Stripe), send service-related communications, and comply with legal obligations.
        </p>

        <h2 className="text-lg font-semibold mt-6">4. Data sharing</h2>
        <p className="text-muted-foreground">
          We do not sell your data. We may share data with service providers (hosting, payments, analytics) under strict agreements. We may disclose data when required by law.
        </p>

        <h2 className="text-lg font-semibold mt-6">5. Your rights</h2>
        <p className="text-muted-foreground">
          You can access, correct, or request deletion of your data. To delete your account and data, see our <a href="/delete-account" className="text-primary underline">Account deletion</a> page. For other requests, contact us at the address below.
        </p>

        <h2 className="text-lg font-semibold mt-6">6. Cookies</h2>
        <p className="text-muted-foreground">
          We use essential cookies for authentication and preferences. See our <a href="/cookies" className="text-primary underline">Cookies Policy</a> for details.
        </p>

        <h2 className="text-lg font-semibold mt-6">7. Contact</h2>
        <p className="text-muted-foreground">
          For privacy questions or to exercise your rights, contact us via the details on our <a href="/delete-account" className="text-primary underline">Contact / Delete account</a> page.
        </p>
      </section>
    </article>
  );
}
