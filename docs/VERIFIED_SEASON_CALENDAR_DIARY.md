# Season, Calendar, Diary — Verified Checklist

## Summary of Changes

### KROK 1 — Formatowanie liczb (`lib/utils/format.ts`)
- `formatNumber(value, { decimals, trimZeros })` — bezpieczne formatowanie z obsługą null/undefined/NaN
- `formatHours(value)` — np. 0, 0.5, 1.3, 4.4 (max 1 miejsce, bez .0)
- `formatTSS(value)` — integer
- `formatPercent(value)` — integer + %
- `formatRange(a, b, unit)` — "X–Y h"
- Wszystkie funkcje obsługują: null, undefined, NaN — zwracają "—"

### KROK 2 — SEASON
- **Header**: pasek postępu do goal race (Today → goal date), chipy (sport, faza), dni do startu
- **Metric cards**: formatHours, formatTSS, formatPercent — jednostki "h", brak długich floatów
- **Blocks timeline**: formatHoursRange, formatHours — wartości 6.6 h/week zamiast 6.6300000
- **Season Intelligence**: formatowanie godzin, TSS, compliance, ramp rate
- **Progress bar**: wizualizacja postępu od startu sezonu do goal race

### KROK 3 — CALENDAR
- **Open slot**: zamieniono na subtelny placeholder (bg-muted/20), bez tekstu "Open slot"
- **Selected day**: wyraźniejszy outline (ring-2 ring-primary/70 ring-offset-2)
- **Today**: ring-1 ring-primary/80 gdy nie selected
- **Command center**: formatHours, formatTSS, formatPercent dla Volume, Load, Compliance
- **Week plan empty state**: sensowny empty-state z CTA zamiast pustych skeletonów

### KROK 4 — DIARY
- **Month grid**: mini-indykatory — jakość snu (Moon + %), trend samopoczucia (strzałka), notatka (kwadracik)
- **Day entry modal**: sekcja "Dziennik", "Sygnały dnia", ulepszony spacing, typografia, focus ring

### Zabezpieczenia edge-case
- null/undefined/NaN → "—" we wszystkich formatach
- formatHours(0) → "0", formatHours(1) → "1", formatHours(1.3) → "1.3"
- Brak danych w weekStats → null, brak wyświetlania KPI
- Puste bloki/milestones → empty states zamiast pustych ramek

---

## Pliki zmienione

| Ścieżka | Opis |
|---------|------|
| `lib/utils/format.ts` | Rozszerzenie: formatNumber (opcje), formatHours, formatTSS, formatPercent, formatRange; usunięcie duplikatów |
| `app/(app)/season/components/season-header.tsx` | Formatowanie KPI, progress bar, chipy |
| `app/(app)/season/components/season-intelligence.tsx` | formatHours, formatTSS, formatPercent |
| `app/(app)/season/components/blocks-timeline.tsx` | formatHours, formatHoursRange |
| `app/(app)/calendar/calendar-client.tsx` | Usunięcie "Open slot", placeholder, formatowanie, empty state, displayName |
| `app/(app)/diary/diary-client.tsx` | Mini-indykatory (sleep, mood, notes), polish modalu |

---

## Weryfikacja (ręczna)

### Season
- [ ] Otwórz /season — brak liczb z wieloma zerami (np. 6.6300000)
- [ ] Klik block → side panel otwiera się
- [ ] Hours/TSS/Compliance — formatowane spójnie (0 / 4.4 h, 0/232, 0%)
- [ ] Brak NaN/undefined na UI

### Calendar
- [ ] Grid miesięczny — puste kafelki mają subtelny placeholder, nie "Open slot"
- [ ] Wybrany dzień — wyraźny outline
- [ ] Day/Week/Month — przełączanie bez błędów konsoli
- [ ] Volume/Load/Compliance — formatowane

### Diary
- [ ] Kafelek dnia z wpisem — mini-indykatory (sleep %, trend, notatka)
- [ ] Klik dnia → modal z dziennikiem i sygnałami
- [ ] Zapis → toast, zamknięcie, markery widoczne po powrocie

---

## Komendy

```bash
npm run build   # ✓ green
npm run lint    # (istniejące warningi w innych plikach — poza scope)
```

---

## Znane ograniczenia
- Lint: błędy w plikach poza Season/Calendar/Diary pozostawione
- Brak testów jednostkowych (projekt nie ma vitest/jest)
- Język: Diary pozostaje PL, Season/Calendar EN — zgodnie z obecnym stanem
