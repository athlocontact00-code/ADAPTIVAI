import type { Metadata } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.adaptivai.online";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to AdaptivAI and continue with your adaptive training plan.",
  alternates: {
    canonical: `${appUrl}/login`,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
