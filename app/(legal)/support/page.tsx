import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Support - AdaptivAI",
  description: "Get help with AdaptivAI — contact support, FAQs, and useful links.",
};

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@adaptivai.online";

const FAQ_ITEMS = [
  {
    q: "How do I reset my password?",
    a: "Go to the sign-in page and click \"Forgot password\". You'll receive a reset link via email within a few minutes.",
  },
  {
    q: "Can I use AdaptivAI without a wearable?",
    a: "Absolutely. You can log workouts using time and RPE (perceived effort). Wearable integration is optional and improves accuracy over time.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Open Settings → Subscription in the app and tap \"Manage subscription\". You can cancel anytime and keep access until the end of your billing period.",
  },
  {
    q: "Is my training data private?",
    a: "Yes. We never sell your data. You can review our Privacy Policy for full details, and you can request data deletion at any time.",
  },
  {
    q: "What sports does AdaptivAI support?",
    a: "AdaptivAI works for running, cycling, swimming, and multi-sport training like triathlon. More disciplines are on the roadmap.",
  },
];

export default function SupportPage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-2xl font-bold mb-2">Support</h1>
      <p className="text-muted-foreground mb-8">
        We're here to help. Find answers below or reach out directly.
      </p>

      {/* Contact */}
      <section className="space-y-3 mb-10">
        <h2 className="text-lg font-semibold">Contact us</h2>
        <p className="text-muted-foreground">
          For account issues, billing questions, or product feedback, email us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-primary underline"
          >
            {SUPPORT_EMAIL}
          </a>
          . Please include the email address associated with your account so we can help you faster.
        </p>
        <p className="text-muted-foreground text-sm">
          We typically respond within 24 hours on business days.
        </p>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Frequently asked questions</h2>
        <div className="space-y-3 not-prose">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"
            >
              <summary className="cursor-pointer list-none select-none flex items-start justify-between gap-4">
                <span className="text-sm font-medium text-foreground">{item.q}</span>
                <span className="mt-0.5 text-white/50 transition-transform duration-200 group-open:rotate-45 shrink-0" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Useful links */}
      <section className="space-y-3 mb-10">
        <h2 className="text-lg font-semibold">Useful links</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link href="/terms" className="text-primary underline">
              Terms of Service
            </Link>
          </li>
          <li>
            <Link href="/account/delete" className="text-primary underline">
              Account Deletion
            </Link>
          </li>
        </ul>
      </section>

      <div className="mt-8">
        <Link href="/">
          <Button variant="outline">Back to home</Button>
        </Link>
      </div>
    </article>
  );
}
