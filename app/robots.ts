import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.adaptivai.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/today",
          "/calendar",
          "/coach",
          "/diary",
          "/digest",
          "/progress",
          "/season",
          "/settings",
          "/simulator",
          "/onboarding",
          "/trial-ended",
          "/account/",
          "/compat-bridge",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
