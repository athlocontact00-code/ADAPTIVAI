import { redirect } from "next/navigation";

/**
 * Contact page: redirect to /support (canonical support URL).
 */
export default function ContactPage() {
  redirect("/support");
}
