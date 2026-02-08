/**
 * Admin checks: who is admin, and how to verify admin actions (secret header).
 * No secrets in responses; lazy env so build does not require ADMIN vars.
 */
import type { Session } from "next-auth";

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw || typeof raw !== "string") return [];
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

/** True if session user is admin (ADMIN_EMAILS or role ADMIN). */
export function isAdmin(session: Session | null): boolean {
  if (!session?.user?.email) return false;
  const emails = getAdminEmails();
  if (emails.length > 0 && emails.includes(session.user.email)) return true;
  const role = (session.user as { role?: string }).role;
  return role === "ADMIN";
}

/** Get secret for admin action header (ADMIN_ACTIONS_SECRET or INTERNAL_CRON_SECRET). */
export function getAdminActionsSecret(): string | null {
  const s =
    process.env.ADMIN_ACTIONS_SECRET ??
    process.env.INTERNAL_CRON_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

/** Check request has valid admin secret in x-admin-secret header. */
export function verifyAdminSecretHeader(req: Request): boolean {
  const secret = getAdminActionsSecret();
  if (!secret) return false;
  const header = req.headers.get("x-admin-secret");
  return header === secret;
}
