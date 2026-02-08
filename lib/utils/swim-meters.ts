/**
 * Parse total swim distance in meters from workout text.
 * Handles patterns: "400m", "4x50m", "4×50 m", "3×400", "8 x 100m", "2*200m".
 * Returns sum in meters or null if no distances found.
 */
export function parseSwimMetersFromText(text: string): number | null {
  if (!text || typeof text !== "string") return null;
  const lower = text.replace(/\s+/g, " ").toLowerCase();
  // Match: optional repeats (Nx or N×), number, optional "m". Exclude "30 min" (minutes).
  const pattern = /(?:^|\s)(?:(\d+)\s*[x×*]\s*)?(\d+)\s*m?\b(?!\s*min\b)/gi;
  let sum = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(lower)) !== null) {
    const reps = match[1] ? parseInt(match[1], 10) : 1;
    const meters = parseInt(match[2], 10);
    if (meters > 0 && meters < 10000) sum += reps * meters;
  }
  return sum > 0 ? sum : null;
}
