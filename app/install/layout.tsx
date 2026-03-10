import type { Metadata } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.adaptivai.online";

export const metadata: Metadata = {
  title: "Install app",
  description: "Install AdaptivAI on your phone or desktop for a faster app-like experience.",
  alternates: {
    canonical: `${appUrl}/install`,
  },
};

export default function InstallLayout({ children }: { children: React.ReactNode }) {
  return children;
}
