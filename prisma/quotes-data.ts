/**
 * Real Motivational Quotes Database
 * All quotes are real, attributed to real people.
 * Categories: ENDURANCE, DISCIPLINE, MENTAL_TOUGHNESS, RECOVERY, GROWTH, FOCUS
 * Tones: SUPPORTIVE, EXECUTION, NEUTRAL
 */

export interface QuoteData {
  text: string;
  author: string;
  category: string;
  source?: string;
  tone?: string;
}

// Import quote collections
import { ENDURANCE_QUOTES } from './quotes/endurance';
import { DISCIPLINE_QUOTES } from './quotes/discipline';
import { MENTAL_TOUGHNESS_QUOTES } from './quotes/mental-toughness';
import { RECOVERY_QUOTES } from './quotes/recovery';
import { GROWTH_QUOTES } from './quotes/growth';
import { FOCUS_QUOTES } from './quotes/focus';

export const QUOTES: QuoteData[] = [
  ...ENDURANCE_QUOTES,
  ...DISCIPLINE_QUOTES,
  ...MENTAL_TOUGHNESS_QUOTES,
  ...RECOVERY_QUOTES,
  ...GROWTH_QUOTES,
  ...FOCUS_QUOTES,
];
