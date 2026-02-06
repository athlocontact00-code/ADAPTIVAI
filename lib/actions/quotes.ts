"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getDayOfYear,
  getDateKey,
  filterQuotesByReadiness,
  getCategoryDisplay,
  formatQuoteForAI,
  type Quote,
  type QuoteCategory,
  type QuoteTone,
} from "@/lib/services/quotes.service";

export interface DailyQuoteResult {
  quote: {
    id: string;
    text: string;
    author: string;
    category: QuoteCategory;
    source: string | null;
    tone: QuoteTone | null;
  };
  categoryDisplay: { label: string; color: string };
  dateKey: string;
}

/**
 * Get today's quote, optionally filtered by readiness
 */
export async function getTodayQuote(
  readinessScore?: number | null
): Promise<DailyQuoteResult | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const today = new Date();
  const dayOfYear = getDayOfYear(today);
  const dateKey = getDateKey(today);

  // Get yesterday's quote to avoid same author
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday);

  // Try to get cached quote for today from user's last viewed
  // For simplicity, we'll use deterministic selection based on day

  // Get all quotes
  let quotes = await db.quote.findMany({
    orderBy: { id: "asc" },
  });

  if (quotes.length === 0) {
    return null;
  }

  // Filter by readiness if provided
  if (readinessScore !== undefined && readinessScore !== null) {
    const mappedQuotes: Quote[] = quotes.map((q) => ({
      id: q.id,
      text: q.text,
      author: q.author,
      category: q.category as QuoteCategory,
      source: q.source,
      tone: q.tone as QuoteTone | null,
    }));

    const filtered = filterQuotesByReadiness(mappedQuotes, readinessScore);
    if (filtered.length > 0) {
      quotes = quotes.filter((q) => filtered.some((f) => f.id === q.id));
    }
  }

  // Get yesterday's author to avoid repetition
  const yesterdayIndex = (getDayOfYear(yesterday) % quotes.length);
  const yesterdayQuote = quotes[yesterdayIndex];
  const yesterdayAuthor = yesterdayQuote?.author;

  // Select today's quote
  let todayIndex = dayOfYear % quotes.length;
  let selectedQuote = quotes[todayIndex];

  // If same author as yesterday, move to next
  if (selectedQuote && yesterdayAuthor && selectedQuote.author === yesterdayAuthor) {
    todayIndex = (todayIndex + 1) % quotes.length;
    selectedQuote = quotes[todayIndex];
  }

  if (!selectedQuote) {
    return null;
  }

  const category = selectedQuote.category as QuoteCategory;

  return {
    quote: {
      id: selectedQuote.id,
      text: selectedQuote.text,
      author: selectedQuote.author,
      category,
      source: selectedQuote.source,
      tone: selectedQuote.tone as QuoteTone | null,
    },
    categoryDisplay: getCategoryDisplay(category),
    dateKey,
  };
}

/**
 * Get quote context for AI Coach
 */
export async function getQuoteContextForAI(): Promise<string | null> {
  const result = await getTodayQuote();
  if (!result) {
    return null;
  }

  return formatQuoteForAI(result.quote);
}

/**
 * Get quote statistics
 */
export async function getQuoteStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  byTone: Record<string, number>;
}> {
  const quotes = await db.quote.findMany();

  const byCategory: Record<string, number> = {};
  const byTone: Record<string, number> = {};

  for (const quote of quotes) {
    byCategory[quote.category] = (byCategory[quote.category] || 0) + 1;
    if (quote.tone) {
      byTone[quote.tone] = (byTone[quote.tone] || 0) + 1;
    }
  }

  return {
    total: quotes.length,
    byCategory,
    byTone,
  };
}
