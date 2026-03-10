import { redirect } from "next/navigation";

// PHASE 6: The app is completely free. No trial-ended page needed.
// Redirect to the dashboard if anyone lands here.
export default function TrialEndedPage() {
  redirect("/dashboard");
}
