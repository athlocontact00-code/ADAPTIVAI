"use client";

import Link from "next/link";
import { Zap, Sparkles, TrendingUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/logo";

interface PaywallCardProps {
  title?: string;
  message?: string;
  trialEndsAt?: Date | null;
}

const PRO_BENEFITS = [
  { icon: Sparkles, text: "AI Coach & plan generation" },
  { icon: Calendar, text: "Adaptive suggestions & proposals" },
  { icon: TrendingUp, text: "Progress analytics & trends" },
  { icon: Zap, text: "Simulator & advanced reports" },
];

export function PaywallCard({
  title = "Trial ended",
  message = "Upgrade to Pro to unlock AI Coach and all premium features.",
  trialEndsAt,
}: PaywallCardProps) {
  const trialDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Logo size={22} className="shrink-0" />
          <Zap className="h-5 w-5 text-amber-500" />
          {title}
        </CardTitle>
        <CardDescription>
          {message}
          {trialDate && (
            <span className="block mt-1 text-xs text-muted-foreground">
              Trial ended on {trialDate}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {PRO_BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {text}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 pt-2">
          <Link href="/settings?tab=billing">
            <Button>Upgrade to Pro</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

