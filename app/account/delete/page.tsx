import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Account deletion - AdaptivAI",
  description: "How to delete your AdaptivAI account and request data removal.",
};

export default function AccountDeletePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          AdaptivAI
        </Link>
      </header>
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <article className="prose prose-invert prose-sm max-w-none">
          <h1 className="text-2xl font-bold mb-6">Account deletion</h1>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold mt-6">Delete your account and data</h2>
            <p className="text-muted-foreground">
              To permanently delete your account and associated data (profile, workouts, diary, settings):
            </p>
            <ol className="text-muted-foreground list-decimal pl-6 space-y-2">
              <li>Log in to AdaptivAI.</li>
              <li>Go to <strong>Settings</strong> (gear icon or menu).</li>
              <li>Open the <strong>Account</strong> or <strong>Profile</strong> section.</li>
              <li>Find &quot;Delete account&quot; and follow the instructions (e.g. type <strong>DELETE</strong> to confirm).</li>
            </ol>
            <p className="text-muted-foreground">
              After deletion, your data is removed from our systems. Billing history may be retained as required by law.
            </p>

            <h2 className="text-lg font-semibold mt-6">Request deletion (alternative)</h2>
            <p className="text-muted-foreground">
              If you cannot log in or prefer to request deletion by email, contact us and we will process your request in line with our Privacy Policy.
            </p>
            <p className="text-muted-foreground text-sm">
              <Link href="/support" className="text-primary underline">
                Go to Support / Contact
              </Link>{" "}
              to submit a request. Include your registered email so we can locate your account.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/settings">
                <Button>Go to Settings</Button>
              </Link>
              <Link href="/support">
                <Button variant="outline">Contact support</Button>
              </Link>
            </div>
          </section>
        </article>
      </main>
    </div>
  );
}
