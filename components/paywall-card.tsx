"use client";

import Link from "next/link";
import { Zap, Sparkles, TrendingUp, Calendar, Crown, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/logo";

interface PaywallCardProps {
  title?: string;
  message?: string;
  trialEndsAt?: Date | null;
  /** Compact variant for inline feature locks */
  compact?: boolean;
}

const PRO_BENEFITS = [
  { icon: Sparkles, text: "Full AI Coach & plan generation" },
  { icon: Calendar, text: "Season planner & adaptive suggestions" },
  { icon: TrendingUp, text: "Progress analytics & trend insights" },
  { icon: Zap, text: "Simulator, digest & advanced reports" },
];

export function PaywallCard({
  title = "Unlock Pro",
  message = "Upgrade to Pro to unlock AI Coach and all premium features.",
  trialEndsAt,
  compact = false,
}: PaywallCardProps) {
  const trialDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;

  if (compact) {
    return (
      <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-purple-500/5 backdrop-blur-sm">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-purple-600">
            <Lock className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{message}</p>
          </div>
          <Link href="/settings?tab=billing">
            <Button size="sm" className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-sm">
              Upgrade
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-purple-500/5 to-transparent backdrop-blur-sm overflow-hidden relative">
      {/* Decorative gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-purple-500 to-orange-500" />

      <CardHeader className="pt-6">
        <CardTitle className="flex items-center gap-2.5 text-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-purple-600 shadow-lg shadow-orange-500/20">
            <Crown className="h-4.5 w-4.5 text-white" />
          </div>
          {title}
        </CardTitle>
        <CardDescription className="text-sm">
          {message}
          {trialDate && (
            <span className="block mt-1.5 text-xs text-muted-foreground/80">
              Trial ended on {trialDate}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <ul className="space-y-2.5">
          {PRO_BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-sm">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                <Icon className="h-3.5 w-3.5 text-orange-500" />
              </div>
              <span className="text-muted-foreground">{text}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Link href="/settings?tab=billing" className="flex-1">
            <Button className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 h-11">
              <Crown className="mr-2 h-4 w-4" />
              Upgrade to Pro
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/#pricing">
            <Button variant="ghost" className="rounded-xl h-11 text-muted-foreground">
              See plans
            </Button>
          </Link>
        </div>

        <p className="text-xs text-center text-muted-foreground/60">
          Starting at $6.67/mo billed yearly • Cancel anytime
        </p>
      </CardContent>
    </Card>
  );
}
