import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.adaptivai.online";

const PUBLIC_ROUTES = [
  "",
  "/install",
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/cookies",
  "/support",
  "/contact",
  "/data-deletion",
  "/delete-account",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/register" || route === "/login" ? 0.8 : 0.6,
  }));
}
