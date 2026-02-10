import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Delete account & contact - AdaptivAI",
  description: "How to delete your AdaptivAI account and request data removal. Contact information.",
};

export default function DeleteAccountPage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-2xl font-bold mb-6">Account deletion & contact</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold mt-6">Delete your account</h2>
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

        <h2 className="text-lg font-semibold mt-6">Contact us</h2>
        <p className="text-muted-foreground">
          For account deletion help, data requests (access, correction, portability), or other privacy/legal questions:
        </p>
        <ul className="text-muted-foreground list-disc pl-6 space-y-1">
          <li>Use the in-app feedback or support option if available.</li>
          <li>Email: include &quot;AdaptivAI&quot; and your registered email so we can locate your account. We will respond within a reasonable time.</li>
        </ul>
        <p className="text-muted-foreground text-xs mt-4">
          If you do not have a support email yet, set one in your deployment (e.g. support@adaptivai.online) and document it in your README or legal pages.
        </p>

        <div className="mt-6">
          <Link href="/settings">
            <Button variant="outline">Go to Settings</Button>
          </Link>
        </div>
      </section>
    </article>
  );
}
