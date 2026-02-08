"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logError } from "@/lib/logger";
import {
  getDateKey,
  getQuoteOfTheDay,
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
 * Get today's quote (deterministic by date). Optionally filter by readiness.
 * Returns null when no quotes in DB or on error; logs errors without throwing.
 */
export async function getTodayQuote(
  readinessScore?: number | null
): Promise<DailyQuoteResult | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }

    const today = new Date();
    const dateKey = getDateKey(today);

    const rows = await db.quote.findMany({ orderBy: { id: "asc" } });
    if (rows.length === 0) {
      return null;
    }

    const mappedQuotes: Quote[] = rows.map((q) => ({
      id: q.id,
      text: q.text,
      author: q.author,
      category: q.category as QuoteCategory,
      source: q.source,
      tone: q.tone as QuoteTone | null,
    }));

    let pool = mappedQuotes;
    if (readinessScore !== undefined && readinessScore !== null) {
      const filtered = filterQuotesByReadiness(mappedQuotes, readinessScore);
      if (filtered.length > 0) pool = filtered;
    }

    const selectedQuote = getQuoteOfTheDay(today, pool);
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
  } catch (err) {
    logError("quotes.getTodayQuote", {}, err instanceof Error ? err : undefined);
    return null;
  }
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
