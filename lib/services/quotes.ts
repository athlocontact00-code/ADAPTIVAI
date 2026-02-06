import { db } from "@/lib/db";
import { getDayOfYear } from "@/lib/utils";
import { getCategoryDisplay, type QuoteCategory } from "./quotes.service";

export interface DailyQuote {
  text: string;
  author: string;
  category: string;
  source: string | null;
  tone: string | null;
  categoryDisplay: { label: string; color: string };
}

export async function getQuoteOfTheDay(readinessScore?: number | null): Promise<DailyQuote> {
  let quotes = await db.quote.findMany({
    orderBy: { id: "asc" },
  });
  
  if (quotes.length === 0) {
    return {
      text: "The only bad workout is the one that didn't happen.",
      author: "Unknown",
      category: "DISCIPLINE",
      source: null,
      tone: null,
      categoryDisplay: getCategoryDisplay("DISCIPLINE"),
    };
  }

  // Filter by readiness if provided
  if (readinessScore !== undefined && readinessScore !== null) {
    // Low readiness (< 50): prefer supportive/recovery quotes
    if (readinessScore < 50) {
      const supportive = quotes.filter(
        (q) => q.tone === "SUPPORTIVE" || q.category === "RECOVERY"
      );
      if (supportive.length > 0) quotes = supportive;
    }
    // High readiness (>= 70): prefer execution/discipline quotes
    else if (readinessScore >= 70) {
      const execution = quotes.filter(
        (q) =>
          q.tone === "EXECUTION" ||
          q.category === "DISCIPLINE" ||
          q.category === "FOCUS"
      );
      if (execution.length > 0) quotes = execution;
    }
  }

  const today = new Date();
  const dayOfYear = getDayOfYear(today);
  
  // Get yesterday's author to avoid repetition
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDayOfYear = getDayOfYear(yesterday);
  const yesterdayIndex = yesterdayDayOfYear % quotes.length;
  const yesterdayQuote = quotes[yesterdayIndex];
  
  // Select today's quote
  let todayIndex = dayOfYear % quotes.length;
  let selectedQuote = quotes[todayIndex];
  
  // If same author as yesterday, move to next
  if (selectedQuote && yesterdayQuote && selectedQuote.author === yesterdayQuote.author) {
    todayIndex = (todayIndex + 1) % quotes.length;
    selectedQuote = quotes[todayIndex];
  }
  
  return {
    text: selectedQuote.text,
    author: selectedQuote.author,
    category: selectedQuote.category,
    source: selectedQuote.source,
    tone: selectedQuote.tone,
    categoryDisplay: getCategoryDisplay(selectedQuote.category as QuoteCategory),
  };
}
