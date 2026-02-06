import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEntitlements } from "@/lib/billing/entitlements";
import { AppShell } from "@/components/app-shell";

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
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
      }}
      showFinishSetupBanner={Boolean(user.onboardingDismissedAt && !user.onboardingDone)}
      planBadge={
        entitlements.plan === "PRO"
          ? "Pro"
          : entitlements.isTrialActive && entitlements.trialDaysRemaining != null
            ? `Trial: ${entitlements.trialDaysRemaining}d left`
            : null
      }
    >
      {children}
    </AppShell>
  );
}
