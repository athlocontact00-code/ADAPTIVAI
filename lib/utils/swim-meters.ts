/**
 * Parse total swim distance in meters from workout text.
 * Handles patterns: "400m", "4x50m", "4×50 m", "3×400", "8 x 100m", "2*200m".
 * Returns sum in meters or null if no distances found.
 */
export function parseSwimMetersFromText(text: string): number | null {
  if (!text || typeof text !== "string") return null;
  const lower = text
    .replace(/^\s*TOTAL\s*METERS?\s*:\s*\d+\s*$/gim, " ")
    .replace(/^\s*TOTAL\s*:\s*\d+\s*m\s*$/gim, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  let sum = 0;

  const intervalPattern = /(?:^|\s)(\d+)\s*[x×*]\s*(\d+)\s*m?\b/gi;
  let match: RegExpExecArray | null;
  let textWithoutIntervals = lower;
  while ((match = intervalPattern.exec(lower)) !== null) {
    const reps = match[1] ? parseInt(match[1], 10) : 1;
    const meters = parseInt(match[2], 10);
    if (meters > 0 && meters < 10000) sum += reps * meters;
    textWithoutIntervals = textWithoutIntervals.replace(match[0], " ");
  }

  const singleMetersPattern = /(?:^|\s)(\d{2,4})\s*(?:m|meters?)\b/gi;
  while ((match = singleMetersPattern.exec(textWithoutIntervals)) !== null) {
    const meters = parseInt(match[1], 10);
    if (meters > 0 && meters < 10000) sum += meters;
  }

  return sum > 0 ? sum : null;
}
