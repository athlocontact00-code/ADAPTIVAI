import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSeasonHQ } from "@/lib/actions/season";
import { SeasonClient } from "./season-client";

export default async function SeasonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const season = await getSeasonHQ();

  return <SeasonClient season={season} />;
}
