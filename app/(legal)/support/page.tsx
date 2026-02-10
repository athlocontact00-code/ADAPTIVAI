import { redirect } from "next/navigation";

/**
 * Support page: redirect to contact (same content for store compliance).
 * Stores often require a "Support URL" — we use /contact for both.
 */
export default function SupportPage() {
  redirect("/contact");
}
