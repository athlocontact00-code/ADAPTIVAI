# Season HQ — Smoke Test Checklist

Deterministic step-by-step verification. Run in order.

## Prerequisites
- Logged-in user
- `/season` route accessible

---

## 1. Empty State
- [ ] Navigate to `/season` (no season exists)
- [ ] Page shows premium hero card: "Season HQ", value prop, two CTAs
- [ ] Skeleton preview of blocks timeline + sidebar visible below buttons
- [ ] Click "Auto-Create Season" → wizard opens
- [ ] Click "Create Manually" → create dialog opens
- [ ] No console errors, no React warnings

## 2. Create Season (Manual)
- [ ] Open "Create Manually" dialog
- [ ] Fill: name, start date, end date (valid: start ≤ end)
- [ ] If goal race date < start date → error message shown, Submit disabled
- [ ] Submit → toast success, page refreshes, empty season with "Auto-Create Blocks" CTA
- [ ] No blocks yet; "Season Intelligence" sidebar shows "This Week", "Alert Center", "Milestones" (empty/mock data)

## 3. Auto-Create Wizard
- [ ] From empty state, click "Auto-Create Season"
- [ ] Step 1: Goal — fill goal race date, start date
- [ ] If goal date < start date → "Goal race date must be on or after start date" shown, Next disabled
- [ ] Step 2: Constraints — max hours, training days, intensity
- [ ] Step 3: Style — plan rigidity, discipline sliders, summary
- [ ] Submit → season + blocks + test milestones + alerts created
- [ ] Page shows header with KPIs, blocks timeline, sidebar

## 4. Auto-Create Blocks (season exists, no blocks)
- [ ] Create season manually (no blocks)
- [ ] Click "Auto-Create Blocks" → blocks generated
- [ ] Timeline populated with Base/Build/Peak/Taper (and Recovery)

## 5. Edit Block
- [ ] Click a block in timeline → right panel opens
- [ ] Change type, dates, hours, TSS, focus, guardrails
- [ ] Save → toast, panel closes, data refreshed
- [ ] Reopen block → changes persisted

## 6. Add / Edit / Delete Milestone
- [ ] Click "Add Milestone" → dialog opens
- [ ] Fill name, date, type (e.g. A_RACE), priority
- [ ] Add → milestone appears in sidebar
- [ ] Hover milestone → edit/delete buttons appear
- [ ] Edit → change fields, Save → updated
- [ ] Delete → milestone removed

## 7. Dismiss Alert
- [ ] Alert Center shows at least one alert (e.g. "Check your profile")
- [ ] Click X on alert → alert disappears
- [ ] Refresh page → alert stays dismissed (dismissedAt persisted)

## 8. Edge Cases
- [ ] **Very short season**: Create auto-season with start date 1 week before goal → valid block(s) (collapsed Base/Taper)
- [ ] **Goal date before start**: Wizard and manual create both prevent and show error
- [ ] **No blocks**: Panel shows "Auto-Create Blocks" CTA + skeleton
- [ ] **Missing user**: Redirect to login (auth layer)

## 9. No Console Errors
- [ ] Open DevTools Console
- [ ] Perform: load page → create season → add block → edit block → add milestone → dismiss alert
- [ ] No red errors, no "Warning: Each child in a list should have a unique key"
- [ ] No hydration mismatch warnings

## 10. Responsive
- [ ] Resize to mobile width → layout stacks (header, timeline, sidebar)
- [ ] Modals/panels remain usable
- [ ] No horizontal scroll on main content

---

## Quick Sanity Commands (Dev)

```bash
# Ensure DB is synced
npx prisma db push

# Build (catches type errors)
npm run build
```

## Known Limitations
- **Weekly KPIs** (Hours, TSS, Compliance) require workout data; if none, values may be 0 or N/A.
- **Ramp rate** needs at least 2 weeks of completed TSS; otherwise N/A.
- **Alerts** (Overload risk, Compliance drop) depend on plan + completed data; may not appear with empty baseline.
