export type PremiumCheckinInput = {
  sleepQuality: number; // 0-100
  fatigue: number; // 0-100 (higher = more fatigued)
  motivation: number; // 0-100
  soreness: number; // 0-100 (higher = more sore)
  stress: number; // 0-100 (higher = more stressed)
  notes?: string;
  notesVisibility?: "FULL_AI_ACCESS" | "METRICS_ONLY" | "HIDDEN";
};

export type PremiumReadinessResult = {
  readinessScore: number;
  topFactor: string;
  recommendation: string;
};

const STRESS_THRESHOLD = 50;

export function calculatePremiumReadiness(input: PremiumCheckinInput): PremiumReadinessResult {
  const { sleepQuality, fatigue, motivation, soreness, stress } = input;

  const sleepContrib = sleepQuality * 0.35;
  const fatigueContrib = (100 - fatigue) * 0.25;
  const motivationContrib = motivation * 0.20;
  const sorenessContrib = (100 - soreness) * 0.20;

  const stressPenalty =
    stress > STRESS_THRESHOLD ? Math.floor((stress - STRESS_THRESHOLD) / 10) : 0;

  let readinessScore = Math.round(
    sleepContrib + fatigueContrib + motivationContrib + sorenessContrib - stressPenalty
  );
  readinessScore = Math.max(0, Math.min(100, readinessScore));

  const factors = [
    { name: "Sleep", impact: 100 - sleepQuality, weight: 0.35 },
    { name: "Fatigue", impact: fatigue, weight: 0.25 },
    { name: "Motivation", impact: 100 - motivation, weight: 0.20 },
    { name: "Soreness", impact: soreness, weight: 0.20 },
    { name: "Stress", impact: stress, weight: 0.15 },
  ];

  factors.sort((a, b) => b.impact * b.weight - a.impact * a.weight);
  const topFactor = factors[0].name;

  let recommendation: string;
  if (readinessScore >= 75) {
    recommendation = "Proceed as planned";
  } else if (readinessScore >= 60) {
    recommendation = "Monitor how you feel";
  } else if (readinessScore >= 45) {
    recommendation = "Keep today easy";
  } else {
    recommendation = "Consider rest or light recovery";
  }

  return { readinessScore, topFactor, recommendation };
}
