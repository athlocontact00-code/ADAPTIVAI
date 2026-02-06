/**
 * Pace zone helper — compute pace ranges from PB/threshold.
 * Used by AI Coach and UI to show "easy/tempo/threshold" targets.
 */

export type PaceZoneLabel = {
  easy?: string;
  tempo?: string;
  threshold?: string;
  vo2?: string;
  intervals?: string;
};

export type SwimBenchmarks = {
  swimCssSecPer100?: number | null;
  swim400TimeSec?: number | null;
  swim100TimeSec?: number | null;
};

export type RunBenchmarks = {
  run5kTimeSec?: number | null;
  run10kTimeSec?: number | null;
  runThresholdSecPerKm?: number | null;
  runHmTimeSec?: number | null;
  runMarathonTimeSec?: number | null;
};

export type BikeBenchmarks = {
  ftp?: number | null;
  bikeBest20minWatts?: number | null;
};

function fmtMmSs(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function getSwimPaceZones(b: SwimBenchmarks | null): PaceZoneLabel {
  if (!b?.swimCssSecPer100 || b.swimCssSecPer100 <= 0) return {};
  const css = b.swimCssSecPer100;
  return {
    easy: `${fmtMmSs(css + 15)}–${fmtMmSs(css + 25)}/100m`,
    tempo: `${fmtMmSs(css + 8)}–${fmtMmSs(css + 15)}/100m`,
    threshold: `${fmtMmSs(Math.max(0, css - 8))}–${fmtMmSs(css)}/100m`,
    vo2: `${fmtMmSs(Math.max(0, css - 15))}–${fmtMmSs(css - 5)}/100m`,
  };
}

export function getRunPaceZones(b: RunBenchmarks | null): PaceZoneLabel {
  if (!b) return {};
  const tenK = typeof b.run10kTimeSec === "number" && b.run10kTimeSec > 0 ? b.run10kTimeSec / 10 : null;
  const fiveK = typeof b.run5kTimeSec === "number" && b.run5kTimeSec > 0 ? b.run5kTimeSec / 5 : null;
  const threshold = b.runThresholdSecPerKm ?? null;
  const hm = typeof b.runHmTimeSec === "number" && b.runHmTimeSec > 0 ? b.runHmTimeSec / 21.0975 : null;
  const marathon = typeof b.runMarathonTimeSec === "number" && b.runMarathonTimeSec > 0 ? b.runMarathonTimeSec / 42.195 : null;

  const easyPace = tenK != null ? tenK + 45 : hm != null ? hm + 60 : marathon != null ? marathon + 90 : null;
  const tempoPace = tenK != null ? tenK + 15 : threshold != null ? threshold + 5 : hm != null ? hm + 30 : null;
  const thrPace = threshold ?? tenK ?? fiveK;
  const vo2Pace = fiveK != null ? fiveK - 10 : tenK != null ? tenK - 5 : null;

  const result: PaceZoneLabel = {};
  if (easyPace != null && easyPace > 0) result.easy = `${fmtMmSs(easyPace + 15)}–${fmtMmSs(easyPace + 45)}/km`;
  if (tempoPace != null && tempoPace > 0) result.tempo = `${fmtMmSs(tempoPace)}–${fmtMmSs(tempoPace + 20)}/km`;
  if (thrPace != null && thrPace > 0) result.threshold = `${fmtMmSs(Math.max(0, thrPace - 5))}–${fmtMmSs(thrPace + 10)}/km`;
  if (vo2Pace != null && vo2Pace > 0) result.vo2 = `${fmtMmSs(Math.max(0, vo2Pace - 15))}–${fmtMmSs(vo2Pace)}/km`;
  if (fiveK != null && fiveK > 0) result.intervals = `${fmtMmSs(Math.max(0, fiveK - 15))}–${fmtMmSs(fiveK)}/km`;
  return result;
}

export function getBikePowerZones(b: BikeBenchmarks | null): PaceZoneLabel & { z2?: string; tempo?: string; threshold?: string; vo2?: string } {
  const ftp = b?.ftp ?? (b?.bikeBest20minWatts != null ? Math.round((b.bikeBest20minWatts ?? 0) * 0.95) : null);
  if (!ftp || ftp <= 0) return {};
  const z2Min = Math.round(ftp * 0.6);
  const z2Max = Math.round(ftp * 0.75);
  const tempoMin = Math.round(ftp * 0.8);
  const tempoMax = Math.round(ftp * 0.9);
  const thrMin = Math.round(ftp * 0.95);
  const thrMax = Math.round(ftp * 1.05);
  const vo2Min = Math.round(ftp * 1.1);
  const vo2Max = Math.round(ftp * 1.2);
  return {
    z2: `${z2Min}–${z2Max} W (60–75% FTP)`,
    easy: `${z2Min}–${z2Max} W`,
    tempo: `${tempoMin}–${tempoMax} W (80–90% FTP)`,
    threshold: `${thrMin}–${thrMax} W (95–105% FTP)`,
    vo2: `${vo2Min}–${vo2Max} W (110–120% FTP)`,
  };
}
