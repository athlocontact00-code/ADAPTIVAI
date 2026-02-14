import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEntitlements } from "@/lib/billing/entitlements";
import { setSentryUser } from "@/lib/sentry";
import { AppShell } from "@/components/app-shell";
import { TrialGate } from "@/components/trial-gate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id!;
  setSentryUser({ id: userId, email: session.user.email });

  const [user, entitlements] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    getEntitlements(userId),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (!user.onboardingDone && !user.onboardingDismissedAt) {
    redirect("/onboarding");
  }

  return (
    <TrialGate plan={entitlements.plan}>
      <AppShell
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
        }}
        showFinishSetupBanner={Boolean(user.onboardingDismissedAt && !user.onboardingDone)}
        isPro={entitlements.isPro}
        planBadge={
          entitlements.plan === "PRO"
            ? "Pro"
            : entitlements.isTrialActive && entitlements.trialDaysRemaining != null
              ? `Trial: ${entitlements.trialDaysRemaining}d left`
              : entitlements.plan === "FREE"
                ? "Free — Upgrade"
                : null
        }
      >
        {children}
      </AppShell>
    </TrialGate>
  );
}
