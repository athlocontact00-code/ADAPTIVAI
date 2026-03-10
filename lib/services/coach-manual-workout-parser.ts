export type CoachManualWorkoutDraft = {
  date: Date;
  type: string;
  durationMin: number;
  intensity: string;
  title: string;
  tss: number;
  warmUpText?: string | null;
  mainSetText?: string | null;
  coolDownText?: string | null;
  extraTargets?: Array<{ label: string; value: string }> | null;
};

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function nextOccurrenceOfDow(params: { now: Date; targetDow: number; allowToday: boolean }): Date {
  const d = new Date(params.now);
  d.setHours(12, 0, 0, 0);
  const current = d.getDay();
  let delta = (params.targetDow - current + 7) % 7;
  if (delta === 0 && !params.allowToday) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

export function parseCoachDateFromText(input: string, now: Date): Date | null {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const iso = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null;
  if (iso) {
    const [y, m, day] = iso.split("-").map((n) => parseInt(n, 10));
    const dt = new Date(y, m - 1, day);
    dt.setHours(12, 0, 0, 0);
    return dt;
  }

  const d = new Date(now);
  d.setHours(12, 0, 0, 0);

  if (/\b(dzisiaj|dziś|today)\b/.test(lower)) return d;
  if (/\b(jutro|tomorrow)\b/.test(lower)) {
    d.setDate(d.getDate() + 1);
    return d;
  }

  const inDays = raw.match(/\b(za|in)\s*(\d{1,2})\s*(dni|days)\b/i);
  if (inDays) {
    const n = parseInt(inDays[2], 10);
    if (Number.isFinite(n) && n >= 0 && n <= 30) {
      d.setDate(d.getDate() + n);
      return d;
    }
  }

  const hasThis = /\b(this|ten|ta)\b/.test(lower);
  const allowToday = /\b(dzisiaj|dziś|today)\b/.test(lower);

  const dow: Record<string, number> = {
    monday: 1,
    mon: 1,
    poniedzialek: 1,
    "poniedziałek": 1,
    pon: 1,
    tuesday: 2,
    tue: 2,
    wtorek: 2,
    wto: 2,
    w: 2,
    wednesday: 3,
    wed: 3,
    sroda: 3,
    "środa": 3,
    sr: 3,
    thursday: 4,
    thu: 4,
    czwartek: 4,
    czw: 4,
    friday: 5,
    fri: 5,
    piatek: 5,
    "piątek": 5,
    pt: 5,
    saturday: 6,
    sat: 6,
    sobota: 6,
    sob: 6,
    sunday: 0,
    sun: 0,
    niedziela: 0,
    ndz: 0,
  };

  const tokens = lower
    .replace(/[,.;!?]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);

  for (const t of tokens) {
    const k = normalizeWhitespace(t);
    if (k in dow) {
      return nextOccurrenceOfDow({ now, targetDow: dow[k]!, allowToday: allowToday || hasThis });
    }
  }

  return null;
}

export function parseCoachSectionsFromInput(input: string): {
  warmUpText: string | null;
  mainSetText: string | null;
  coolDownText: string | null;
} {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { warmUpText: null, mainSetText: null, coolDownText: null };
  }

  const joined = lines.join("\n");
  const pick = (re: RegExp): string | null => {
    const m = joined.match(re);
    if (!m?.[1]) return null;
    const v = normalizeWhitespace(m[1]);
    return v.length > 2 ? v : null;
  };

  const warmUpText =
    pick(
      /(?:^|\n)(?:warm-?up|warmup|rozgrzewka|rozgrzewkę)\s*[:\-]\s*([^\n]+(?:\n(?!\s*(?:main|main set|cool|cool-?down|schlodzenie|schłodzenie)\s*[:\-]).+)*)/i
    ) ?? null;
  const mainSetText =
    pick(
      /(?:^|\n)(?:main set|main|część\s*główna|czesc\s*glowna|glowna)\s*[:\-]\s*([^\n]+(?:\n(?!\s*(?:cool|cool-?down|schlodzenie|schłodzenie)\s*[:\-]).+)*)/i
    ) ?? null;
  const coolDownText =
    pick(/(?:^|\n)(?:cool-?down|cooldown|schlodzenie|schłodzenie)\s*[:\-]\s*([^\n]+(?:\n.+)*)/i) ?? null;

  return { warmUpText, mainSetText, coolDownText };
}

export function parseCoachExtraTargets(input: string): Array<{ label: string; value: string }> {
  const raw = input;
  const out: Array<{ label: string; value: string }> = [];

  const hr = raw.match(/\b(?:hr|t[eę]tno)\s*[:=]?\s*(\d{2,3})\s*(?:-|–|to)\s*(\d{2,3})\s*(?:bpm)?\b/i);
  if (hr) out.push({ label: "HR", value: `${hr[1]}–${hr[2]} bpm` });

  const pace = raw.match(/\b(?:pace|tempo)\s*[:=]?\s*(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})\s*\/?km\b/i);
  if (pace) out.push({ label: "Pace", value: `${pace[1]}–${pace[2]}/km` });

  const power = raw.match(/\b(?:power|moc)\s*[:=]?\s*(\d{2,4})\s*(?:-|–|to)\s*(\d{2,4})\s*w\b/i);
  if (power) out.push({ label: "Power", value: `${power[1]}–${power[2]} W` });

  const cadence = raw.match(/\b(?:cadence|kadencja)\s*[:=]?\s*(\d{2,3})\s*(?:-|–|to)\s*(\d{2,3})\b/i);
  if (cadence) out.push({ label: "Cadence", value: `${cadence[1]}–${cadence[2]} spm` });

  const dist = raw.match(/\b(\d{1,3}(?:[\.,]\d+)?)\s*(km|k|m)\b/i);
  if (dist) {
    const v = dist[1].replace(",", ".");
    const unit = dist[2].toLowerCase();
    if (unit === "k" || unit === "km") out.push({ label: "Distance", value: `${v} km` });
    else if (unit === "m") out.push({ label: "Distance", value: `${v} m` });
  }

  return out;
}

export function parseCoachWorkoutDraft(
  input: string,
  now: Date
): {
  ok: boolean;
  error?: string;
  data?: CoachManualWorkoutDraft;
} {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const date = parseCoachDateFromText(raw, now);
  if (!date) {
    return {
      ok: false,
      error: "Podaj dzień treningu (np. 2026-02-05 albo 'jutro').",
    };
  }

  const minMatch = raw.match(/\b(\d{2,3})\s*(min|minutes|m)\b/i);
  const hrMatch = raw.match(/\b(\d+(?:[\.,]\d+)?)\s*h\b/i);
  const durationMin = (() => {
    if (minMatch) return Math.max(10, parseInt(minMatch[1], 10));
    if (hrMatch) {
      const v = parseFloat(hrMatch[1].replace(",", "."));
      if (Number.isFinite(v)) return Math.max(10, Math.round(v * 60));
    }
    return 60;
  })();

  const type =
    /\b(swim|plywanie|pływanie)\b/.test(lower)
      ? "swim"
      : /\b(strength|silownia|siłownia)\b/.test(lower)
          ? "strength"
        : /\b(bike|rower)\b/.test(lower)
          ? "bike"
          : /\b(rest|odpoczynek)\b/.test(lower)
            ? "rest"
            : "run";

  const intensity =
    /\b(recovery|regener|very easy|z1)\b/.test(lower)
      ? "recovery"
      : /\b(easy|spokojnie|luźno|luzno|z2|endurance)\b/.test(lower)
        ? "easy"
        : /\b(tempo|moderate|steady|threshold|prog|z3)\b/.test(lower)
          ? "moderate"
          : /\b(interval|hard|mocno|vo2|max|z4|z5)\b/.test(lower)
            ? "hard"
            : "easy";

  const quotedTitle = raw.match(/"([^"]{3,80})"/)?.[1]?.trim() ?? null;
  const title = quotedTitle
    ? quotedTitle
    : type === "run"
      ? intensity === "hard"
        ? "Intervals Run"
        : intensity === "moderate"
          ? "Tempo Run"
          : intensity === "recovery"
            ? "Recovery Run"
            : "Easy Run"
      : type === "bike"
        ? intensity === "hard"
          ? "Intervals Ride"
          : intensity === "moderate"
            ? "Tempo Ride"
            : intensity === "recovery"
              ? "Recovery Spin"
              : "Endurance Ride"
        : type === "swim"
          ? "Swim Session"
          : type === "strength"
            ? "Strength Session"
            : "Rest Day";

  const tssMatch = raw.match(/\btss\s*[:=]?\s*(\d{1,3})\b/i);
  const tss = (() => {
    if (tssMatch) return Math.max(0, parseInt(tssMatch[1], 10));
    if (type === "rest") return 0;
    const factor = intensity === "hard" ? 1.3 : intensity === "moderate" ? 1.0 : intensity === "recovery" ? 0.5 : 0.8;
    return Math.max(1, Math.round(durationMin * factor));
  })();

  const sections = parseCoachSectionsFromInput(raw);
  const extraTargets = parseCoachExtraTargets(raw);

  const repPattern = /\b\d+\s*x\s*\d+(?:[\.,]\d+)?\s*(?:m|km|min)\b/i.test(raw);
  const hasAt = /\s@\s*\d{1,2}:\d{2}/.test(raw) || /\b@\s*(?:z\d|hr|pace|power)\b/i.test(raw);
  const mainSetHeuristic = (() => {
    if (sections.mainSetText) return sections.mainSetText;
    if (!(repPattern || hasAt)) return null;
    const cleaned = raw
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
      .replace(/\b(jutro|tomorrow|dzisiaj|dziś|today)\b/gi, "")
      .replace(/\b\d{2,3}\s*(min|minutes|m)\b/gi, "")
      .replace(/\b\d+(?:[\.,]\d+)?\s*h\b/gi, "")
      .trim();
    const candidate = normalizeWhitespace(cleaned);
    return candidate.length > 10 ? candidate : null;
  })();

  return {
    ok: true,
    data: {
      date,
      type,
      durationMin,
      intensity,
      title,
      tss,
      warmUpText: sections.warmUpText,
      mainSetText: mainSetHeuristic,
      coolDownText: sections.coolDownText,
      extraTargets: extraTargets.length > 0 ? extraTargets : null,
    },
  };
}
