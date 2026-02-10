import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Data deletion - AdaptivAI",
  description: "How to delete your AdaptivAI account and request data removal.",
};

export default function DataDeletionPage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-2xl font-bold mb-6">Data deletion</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold mt-6">Delete your account and data</h2>
        <p className="text-muted-foreground">
          To permanently delete your account and associated data (profile, workouts, diary, settings):
        </p>
        <ol className="text-muted-foreground list-decimal pl-6 space-y-2">
          <li>Log in to AdaptivAI.</li>
          <li>Go to <strong>Settings</strong> (gear icon or menu).</li>
          <li>Open the <strong>Account</strong> or <strong>Profile</strong> section.</li>
          <li>Find &quot;Delete account&quot; and follow the instructions (you will need to type <strong>DELETE</strong> to confirm).</li>
        </ol>
        <p className="text-muted-foreground">
          After deletion, your data is removed from our systems. Billing history may be retained as required by law.
        </p>

        <h2 className="text-lg font-semibold mt-6">Other requests</h2>
        <p className="text-muted-foreground">
          For data access, portability, or correction, see our{" "}
          <Link href="/contact" className="text-primary underline">Contact</Link> page.
        </p>

        <div className="mt-6 flex gap-3">
          <Link href="/settings">
            <Button variant="outline">Go to Settings</Button>
          </Link>
          <Link href="/delete-account">
            <Button variant="ghost">Full account deletion guide</Button>
          </Link>
        </div>
      </section>
    </article>
  );
}
