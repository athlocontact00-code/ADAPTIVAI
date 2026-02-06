# Progress Tab — Verified Checklist

## Summary of Changes

### KPI Top Row
- **Fitness (CTL)**: MetricCard with sparkline (14d ctlTrend), delta vs prev 14d, tooltip, sublabel (block type)
- **Readiness**: sparkline (7d), delta, tooltip, tone (success/warning/danger)
- **Compliance**: formatPercent, sparkline, delta, tooltip
- **Next Race**: countdown + priority; empty state with CTA "Add race" → /season
- **No summary**: "Not enough data yet" + CTA "Go to Today"

### Weekly / Monthly Story
- **Based on**: bullets (compliance, load, readiness, diary)
- **Why**: 2–3 sentence explanation
- **Confidence**: LOW/MED/HIGH + reason
- **Actions**: "Plan next week" → /calendar, "Ask AI coach" → /coach with prefilled prompt

### Timeline
- **Search**: filter by title/subtitle
- **Date range**: 7d / 30d / 90d / Season
- **Filters**: Blocks, Races, Injuries, PBs, PeakWeeks (toggle)
- **Event cards**: fixed Tailwind classes (no dynamic `bg-${color}`), axis line, up to 50 events
- **Empty state**: CTA Add race, Add PB

### Personal Bests
- **Table**: Discipline, Value, Date, Source per sport
- **Empty state**: premium with CTA
- Uses formatPBValue (pace, power, time)

### Reports
- **Empty state**: CTA "Generate first report"
- **Report dialog**: Export (Print) button

### Data & Edge Cases
- null/undefined/NaN → "—" via format utils
- No summary → Not enough data + CTA
- No races → Add race CTA
- Empty timeline → Add race / Add PB
- Empty PBs → Add first PB
- Empty reports → Generate first report

---

## Files Changed

| Path | Description |
|------|-------------|
| `lib/actions/progress.ts` | Extended getProgressSummary: ctlTrend, deltaCtl, deltaReadiness, deltaCompliance, fortnightMetrics, prev14Metrics |
| `lib/services/progress-narrative.service.ts` | Added basedOn, why, confidence, confidenceReason to WeeklyNarrative and MonthlyNarrative |
| `app/(app)/progress/progress-client.tsx` | KPI MetricCards, story Based on/Why/Confidence/Actions, Timeline search/range/filters, PB table, Reports empty state, Export |

---

## Smoke Test

1. Open /progress
2. Check KPI cards (or "Not enough data")
3. Check story cards: Based on, Why, Confidence, Plan next week, Ask AI coach
4. Timeline tab: search, change range (7d/30d/90d/Season), toggle filters
5. Personal Bests: Add PB, verify table
6. Reports: Generate Weekly/Monthly, open report, Export (Print)
7. No console errors

---

## Known Limitations

- Coach uses `?prefill=` for prefilled prompts
- Block report type not added (only Weekly/Monthly)
- PB status (current/improving/stale) not implemented
- Import from workouts placeholder not added
