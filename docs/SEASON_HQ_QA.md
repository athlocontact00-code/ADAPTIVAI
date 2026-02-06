# Season HQ — Manual QA Checklist

## Prerequisites
- Logged-in user
- Navigate to `/season`

---

## 1. Empty State (No Season)
- [ ] Page shows premium hero card with "Season HQ" title
- [ ] Value prop text visible
- [ ] "Auto-Create Season" button present
- [ ] "Create Manually" button present
- [ ] Skeleton/demo preview of blocks timeline visible below
- [ ] Click "Auto-Create Season" → 3-step wizard opens
- [ ] Click "Create Manually" → create season dialog opens

## 2. Auto-Create Wizard
- [ ] **Step 1 (Goal):** Season name, Sport (Triathlon default), Goal race date, Race type, Season start date
- [ ] Can proceed only when goal race date is set
- [ ] **Step 2 (Constraints):** Max weekly hours, Training days (Mon–Sun toggles), Intensity limit, Injury toggle + note
- [ ] **Step 3 (Style):** Plan rigidity (Locked/Semi-locked/Flexible), Discipline focus sliders (swim/bike/run/strength), Summary
- [ ] Back/Next navigation works
- [ ] Submit creates season + blocks + test milestones + alerts
- [ ] Page refreshes with new season

## 3. Create Season Manually
- [ ] Dialog has: Name, Sport, Start date, End date, Goal race date (optional), Primary goal (optional)
- [ ] Submit creates season without blocks
- [ ] "Auto-Create Blocks" CTA visible for season with no blocks

## 4. Season with No Blocks
- [ ] "No blocks yet" message + "Auto-Create Blocks" CTA
- [ ] Skeleton timeline preview visible
- [ ] Click "Auto-Create Blocks" → blocks generated, timeline populated

## 5. Season HQ Layout (With Season + Blocks)
- [ ] **Header:** Season name, sport chip, date range, goal race chip + countdown, current phase chip
- [ ] **KPIs:** Hours, TSS, Compliance, Ramp Rate, Key sessions (if data available)
- [ ] **CTAs:** "Edit Blocks" (or "Auto-Create Blocks" if no blocks), "Add Milestone"
- [ ] **Blocks Timeline:** Blocks (Base/Build/Peak/Taper/Recovery) with date range, hours, focus label
- [ ] Click block → right panel (sheet) opens with block editor

## 6. Block Editor Panel
- [ ] Block type, start/end dates, focus notes
- [ ] Target hours min/max, TSS min/max
- [ ] Focus discipline dropdown (Swim/Bike/Run/Strength/Mixed)
- [ ] Focus label
- [ ] Guardrails: max hard sessions/week, ramp rate limit
- [ ] Save updates block, panel closes, page refreshes

## 7. Season Intelligence Sidebar
- [ ] **This Week:** Week range, planned vs done hours/TSS, compliance, ramp rate, key sessions
- [ ] **Alert Center:** Alerts with severity (info/warn/danger), title, message, "Why it matters", CTA, dismiss (X)
- [ ] **Milestones:** List of races/tests/camps with date and type
- [ ] Add Milestone button

## 8. Milestones
- [ ] Add Milestone dialog: Name, date, type (A_RACE/B_RACE/C_RACE/TEST/CAMP), priority, distance, goal time, notes
- [ ] Submit adds milestone to list
- [ ] Edit (pencil) opens dialog with pre-filled data
- [ ] Delete (trash) removes milestone

## 9. Alerts
- [ ] Alerts appear (e.g. "Check your profile", taper proximity if applicable)
- [ ] Dismiss (X) hides alert
- [ ] Alert persists after refresh until dismissed

## 10. How to Verify in UI
1. Go to `/season`
2. If no season: use "Auto-Create Season" or "Create Manually"
3. Complete wizard or manual form
4. If no blocks: click "Auto-Create Blocks"
5. Click a block → edit in right panel → Save
6. Add milestone via "Add Milestone"
7. Dismiss an alert
8. Ensure no navigation tabs were added; only Season tab content changed
