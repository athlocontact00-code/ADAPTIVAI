/**
 * Beginner swim week progression: target total meters by phase.
 * Phase 1 = Week 1–2, 2 = Week 3–4, 3 = Week 5–6.
 */
export type BeginnerSwimPhase = 1 | 2 | 3;

export interface BeginnerSwimTarget {
  minMeters: number;
  maxMeters: number;
  drillRatioMin: number;
  drillRatioMax: number;
}

const TARGETS: Record<BeginnerSwimPhase, BeginnerSwimTarget> = {
  1: { minMeters: 900, maxMeters: 1400, drillRatioMin: 0.3, drillRatioMax: 0.4 },
  2: { minMeters: 1200, maxMeters: 1800, drillRatioMin: 0.2, drillRatioMax: 0.3 },
  3: { minMeters: 1500, maxMeters: 2200, drillRatioMin: 0.15, drillRatioMax: 0.25 },
};

export function getBeginnerSwimTargetMeters(phase: BeginnerSwimPhase): BeginnerSwimTarget {
  return TARGETS[phase];
}
