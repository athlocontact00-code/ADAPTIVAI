import type { Metadata } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.adaptivai.online";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your AdaptivAI account and start adaptive endurance training.",
  alternates: {
    canonical: `${appUrl}/register`,
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
