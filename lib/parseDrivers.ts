export type InsightDriver = { factor: string; value: string | number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export function parseInsightDrivers(input: unknown): InsightDriver[] {
  if (input == null) return [];

  // If it's already an array
  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (!isRecord(item)) return null;
        const factor = typeof item.factor === "string" ? item.factor : null;
        const valueRaw = item.value;
        const value =
          typeof valueRaw === "string" || typeof valueRaw === "number" ? valueRaw : null;

        if (!factor || value == null) return null;
        return { factor, value } satisfies InsightDriver;
      })
      .filter((x): x is InsightDriver => !!x);
  }

  // If it's a string, try to parse JSON
  if (typeof input === "string") {
    try {
      return parseInsightDrivers(JSON.parse(input));
    } catch {
      return [];
    }
  }

  // If it's an object
  if (isRecord(input)) {
    // Common wrapper shape: { drivers: [...] }
    if (Array.isArray(input.drivers)) {
      return parseInsightDrivers(input.drivers);
    }

    // Legacy/current shape: { factor1: value1, factor2: value2 }
    const entries = Object.entries(input);
    if (entries.length === 0) return [];

    return entries
      .map(([factor, valueRaw]) => {
        const value =
          typeof valueRaw === "string" || typeof valueRaw === "number"
            ? valueRaw
            : null;
        if (value == null) return null;
        return { factor, value } satisfies InsightDriver;
      })
      .filter((x): x is InsightDriver => !!x);
  }

  return [];
}
