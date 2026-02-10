import Link from "next/link";
import { Activity } from "lucide-react";
import { LegalFooter } from "@/components/legal-footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center">
          <Link href="/" className="flex items-center gap-2 text-foreground hover:opacity-90">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-semibold">AdaptivAI</span>
          </Link>
        </div>
      </header>
      <main className="container max-w-3xl py-8 px-4">{children}</main>
      <LegalFooter className="border-t py-6 mt-12" />
    </div>
  );
}
