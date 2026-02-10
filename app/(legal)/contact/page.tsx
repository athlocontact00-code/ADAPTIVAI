import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contact - AdaptivAI",
  description: "Contact AdaptivAI support and feedback.",
};

export default function ContactPage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-2xl font-bold mb-6">Contact</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold mt-6">Support & feedback</h2>
        <p className="text-muted-foreground">
          For account issues, billing, or product feedback, use the in-app option when available
          (e.g. Settings or help menu). You can also reach us by email; include your registered
          email so we can locate your account.
        </p>
        <p className="text-muted-foreground text-sm">
          If you do not have a support email configured yet, set one in your deployment
          (e.g. support@adaptivai.online) and document it here or in your README.
        </p>

        <h2 className="text-lg font-semibold mt-6">Data & privacy</h2>
        <p className="text-muted-foreground">
          For data access, correction, or deletion requests, see our{" "}
          <Link href="/data-deletion" className="text-primary underline">
            Data deletion
          </Link>{" "}
          page and <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
        </p>

        <div className="mt-6">
          <Link href="/">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </section>
    </article>
  );
}
