import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GettingStartedClient } from "@/components/getting-started/getting-started-client";

export default async function GettingStartedPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="container max-w-3xl py-6">
      <GettingStartedClient />
    </div>
  );
}
