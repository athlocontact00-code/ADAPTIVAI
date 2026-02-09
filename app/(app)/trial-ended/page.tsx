"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Zap, Sparkles, TrendingUp, Calendar, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PRO_BENEFITS = [
  { icon: Sparkles, text: "AI Coach & plan generation" },
  { icon: Calendar, text: "Adaptive suggestions & proposals" },
  { icon: TrendingUp, text: "Progress analytics & trends" },
  { icon: Zap, text: "Simulator & advanced reports" },
];

export default function TrialEndedPage() {
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<"month" | "year">("month");
  const router = useRouter();

  async function handleUpgrade() {
    setIsStartingCheckout(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: checkoutPlan }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string; code?: string; portalUrl?: string } | null;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      if (res.status === 409 && data?.portalUrl) {
        window.location.href = data.portalUrl;
        return;
      }
      if (!res.ok) {
        router.push("/settings");
        return;
      }
    } finally {
      setIsStartingCheckout(false);
    }
  }

  return (
    <div className="container max-w-md py-12">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-6 w-6 text-amber-500" />
            Trial zakończony
          </CardTitle>
          <CardDescription>
            Twój 14-dniowy okres próbny dobiegł końca. Odblokuj pełną aplikację, wykupując Pro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {PRO_BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                {text}
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 flex gap-1">
            <button
              type="button"
              onClick={() => setCheckoutPlan("month")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                checkoutPlan === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Miesięcznie
            </button>
            <button
              type="button"
              onClick={() => setCheckoutPlan("year")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                checkoutPlan === "year" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rocznie
            </button>
          </div>

          <Button
            onClick={handleUpgrade}
            disabled={isStartingCheckout}
            className="w-full gap-2"
          >
            {isStartingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Ulepsz do Pro
          </Button>

          <div className="pt-2 border-t border-white/[0.06]">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Wyloguj się
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Możesz też przejść do{" "}
        <button type="button" onClick={() => router.push("/settings")} className="underline hover:text-foreground">
          Ustawienia
        </button>{" "}
        i tam zarządzać subskrypcją.
      </p>
    </div>
  );
}
