import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as marketingMetadata } from "@/app/(marketing)/page";

describe("public SEO routes", () => {
  it("includes sitemap and disallows private/internal routes", () => {
    const result = robots();
    expect(result.sitemap).toContain("/sitemap.xml");

    const firstRule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(firstRule).toBeTruthy();
    const disallow = Array.isArray(firstRule?.disallow) ? firstRule.disallow : [];

    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/settings");
    expect(disallow).toContain("/compat-bridge");
  });

  it("publishes key public routes in sitemap", () => {
    const result = sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain("https://www.adaptivai.online");
    expect(urls).toContain("https://www.adaptivai.online/install");
    expect(urls).toContain("https://www.adaptivai.online/login");
    expect(urls).toContain("https://www.adaptivai.online/register");
  });

  it("sets focused landing metadata", () => {
    expect(marketingMetadata.description).toContain("Adaptive training plans");
    expect(marketingMetadata.alternates?.canonical).toBe("https://www.adaptivai.online");
  });
});
