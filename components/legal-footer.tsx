"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/support", label: "Support" },
  { href: "/account/delete", label: "Account deletion" },
] as const;

export function LegalFooter({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <nav className={cn("flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground", className)}>
        {LEGAL_LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className="hover:text-foreground underline-offset-4 hover:underline">
            {label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <footer className={cn("container", className)}>
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row md:items-center">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Logo size={20} />
          <span>AdaptivAI</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {LEGAL_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-foreground underline-offset-4 hover:underline">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AdaptivAI. All rights reserved.
      </p>
    </footer>
  );
}
