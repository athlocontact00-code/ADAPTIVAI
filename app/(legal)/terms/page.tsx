import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - AdaptivAI",
  description: "AdaptivAI Terms of Service. Rules and conditions for using our platform.",
};

export default function TermsPage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>
      <p className="text-muted-foreground text-sm mb-4">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold mt-6">1. Acceptance</h2>
        <p className="text-muted-foreground">
          By using AdaptivAI (&quot;Service&quot;) you agree to these Terms and our <a href="/privacy" className="text-primary underline">Privacy Policy</a>. If you do not agree, do not use the Service.
        </p>

        <h2 className="text-lg font-semibold mt-6">2. Description of service</h2>
        <p className="text-muted-foreground">
          AdaptivAI provides an intelligent training platform: workout planning, calendar, diary, analytics, and AI-powered suggestions. Features and availability may change over time.
        </p>

        <h2 className="text-lg font-semibold mt-6">3. Account and use</h2>
        <p className="text-muted-foreground">
          You must provide accurate information and keep your account secure. You are responsible for activity under your account. Do not misuse the Service, attempt to access others&apos; data, or violate applicable laws.
        </p>

        <h2 className="text-lg font-semibold mt-6">4. Subscription and payment</h2>
        <p className="text-muted-foreground">
          Paid plans are billed via Stripe according to the plan you choose. Fees are non-refundable except where required by law. We may change pricing with notice; continued use after changes constitutes acceptance.
        </p>

        <h2 className="text-lg font-semibold mt-6">5. Intellectual property</h2>
        <p className="text-muted-foreground">
          The Service and its content (excluding your data) are owned by us or our licensors. You may not copy, modify, or distribute our software or branding without permission.
        </p>

        <h2 className="text-lg font-semibold mt-6">6. Limitation of liability</h2>
        <p className="text-muted-foreground">
          The Service is provided &quot;as is&quot;. We are not liable for indirect, incidental, or consequential damages. Our total liability is limited to the amount you paid us in the twelve months before the claim.
        </p>

        <h2 className="text-lg font-semibold mt-6">7. Termination</h2>
        <p className="text-muted-foreground">
          You may stop using the Service at any time. We may suspend or terminate access for breach of these Terms. See <a href="/delete-account" className="text-primary underline">Account deletion</a> for how to delete your account and data.
        </p>

        <h2 className="text-lg font-semibold mt-6">8. Contact</h2>
        <p className="text-muted-foreground">
          Questions about these Terms? See our <a href="/delete-account" className="text-primary underline">Contact</a> page.
        </p>
      </section>
    </article>
  );
}
