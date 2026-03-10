import type { Metadata } from "next";
import LandingPage from "./LandingPage";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.adaptivai.online";

export const metadata: Metadata = {
  title: "Adaptive Training for Endurance Athletes",
  description:
    "Adaptive training plans for runners, cyclists, swimmers, and triathletes that respond to fatigue, schedule, and goals.",
  alternates: {
    canonical: appUrl,
  },
};

export default function Page() {
  return <LandingPage />;
}
