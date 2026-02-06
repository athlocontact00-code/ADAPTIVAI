/**
 * Motivational Quotes Service
 * Provides daily quotes with readiness-aware selection.
 * Deterministic, offline, no external dependencies.
 */

import { formatLocalDateInput } from "@/lib/utils";

export type QuoteCategory =
  | "ENDURANCE"
  | "DISCIPLINE"
  | "MENTAL_TOUGHNESS"
  | "RECOVERY"
  | "GROWTH"
  | "FOCUS";

export type QuoteTone = "SUPPORTIVE" | "EXECUTION" | "NEUTRAL";

export interface Quote {
  id: string;
  text: string;
  author: string;
  category: QuoteCategory;
  source: string | null;
  tone: QuoteTone | null;
}

export interface DailyQuoteResult {
  quote: Quote;
  dateKey: string;
}

/**
 * Get a deterministic day-of-year value
 */
export function getDayOfYear(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Get date key for caching (YYYY-MM-DD)
 */
export function getDateKey(date: Date = new Date()): string {
  return formatLocalDateInput(date);
}

/**
 * Select quote index based on day, avoiding same author as yesterday
 */
export function selectQuoteIndex(
  dayOfYear: number,
  totalQuotes: number,
  previousAuthor?: string,
  quotes?: Quote[]
): number {
  // Base index from day of year
  let index = dayOfYear % totalQuotes;

  // If we have quotes and previous author, try to avoid same author
  if (quotes && previousAuthor) {
    const selectedQuote = quotes[index];
    if (selectedQuote && selectedQuote.author === previousAuthor) {
      // Move to next quote
      index = (index + 1) % totalQuotes;
    }
  }

  return index;
}

/**
 * Filter quotes by tone based on readiness
 */
export function filterQuotesByReadiness(
  quotes: Quote[],
  readinessScore: number | null
): Quote[] {
  if (readinessScore === null || quotes.length === 0) {
    return quotes;
  }

  // Low readiness (< 50): prefer supportive/recovery quotes
  if (readinessScore < 50) {
    const supportive = quotes.filter(
      (q) => q.tone === "SUPPORTIVE" || q.category === "RECOVERY"
    );
    return supportive.length > 0 ? supportive : quotes;
  }

  // High readiness (>= 70): prefer execution/discipline quotes
  if (readinessScore >= 70) {
    const execution = quotes.filter(
      (q) =>
        q.tone === "EXECUTION" ||
        q.category === "DISCIPLINE" ||
        q.category === "FOCUS"
    );
    return execution.length > 0 ? execution : quotes;
  }

  // Medium readiness: any quote
  return quotes;
}

/**
 * Get category display info
 */
export function getCategoryDisplay(category: QuoteCategory): {
  label: string;
  color: string;
} {
  switch (category) {
    case "ENDURANCE":
      return { label: "Endurance", color: "bg-blue-500/10 text-blue-500" };
    case "DISCIPLINE":
      return { label: "Discipline", color: "bg-purple-500/10 text-purple-500" };
    case "MENTAL_TOUGHNESS":
      return { label: "Mental Toughness", color: "bg-orange-500/10 text-orange-500" };
    case "RECOVERY":
      return { label: "Recovery", color: "bg-green-500/10 text-green-500" };
    case "GROWTH":
      return { label: "Growth", color: "bg-cyan-500/10 text-cyan-500" };
    case "FOCUS":
      return { label: "Focus", color: "bg-yellow-500/10 text-yellow-500" };
    default:
      return { label: category, color: "bg-muted text-muted-foreground" };
  }
}

/**
 * Format quote for AI Coach context
 */
export function formatQuoteForAI(quote: Quote): string {
  return `Today's motivational quote: "${quote.text}" — ${quote.author}`;
}
