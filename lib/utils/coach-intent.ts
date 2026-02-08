/**
 * Detect user intents from coach chat message (e.g. send to calendar).
 */

export function isSendToCalendarIntent(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    /\b(send|add|wklej|dodaj)\s+(it\s+)?(to\s+)?(the\s+)?calendar\b/i.test(lower) ||
    /\b(add|dodaj)\s+(to\s+)?(the\s+)?calendar\b/i.test(lower) ||
    /\b(wklej|dodaj)\s+do\s+kalendarza\b/i.test(lower)
  );
}
