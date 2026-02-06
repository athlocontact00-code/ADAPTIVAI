# Season HQ — No-Console-Errors Verification Guide

Follow these UI actions and confirm no console errors or React warnings.

## Setup
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to **Console** tab
3. Clear console (🚫 or "Clear console")
4. Navigate to `/season`

---

## Sequence 1: Empty → Create
| Action | What to click | Expected |
|--------|---------------|----------|
| Load | Go to /season | No errors |
| Open wizard | "Auto-Create Season" | Wizard opens, no errors |
| Close | Cancel or X | No errors |
| Open create | "Create Manually" | Dialog opens, no errors |
| Submit invalid | Leave name empty, click Create | Button disabled or validation; no errors |
| Submit valid | Fill name, start, end; Create | Toast, refresh, no errors |

---

## Sequence 2: Season with Blocks
| Action | What to click | Expected |
|--------|---------------|----------|
| Auto-create | "Auto-Create Season" → fill wizard → Create | Season + blocks; no errors |
| Click block | Any block in timeline | Right panel opens; no errors |
| Edit block | Change a field, Save | Toast, panel closes; no errors |
| Open panel again | Click same or other block | No errors |

---

## Sequence 3: Milestones & Alerts
| Action | What to click | Expected |
|--------|---------------|----------|
| Add milestone | "Add Milestone" → fill → Add | Milestone in list; no errors |
| Edit milestone | Pencil icon on milestone | Dialog opens with data; no errors |
| Save | Save in edit dialog | Updated; no errors |
| Dismiss alert | X on any alert | Alert gone; no errors |
| Refresh | F5 or Cmd+R | Dismissed alert still gone; no errors |

---

## Sequence 4: Validation & Edge Cases
| Action | What to do | Expected |
|--------|------------|----------|
| Goal < start | Wizard Step 1: goal date before start | Error text, Next disabled; no errors |
| Manual invalid | Create dialog: goal date before start | Error text, Create disabled; no errors |
| Empty milestone | Add Milestone: leave name empty | Add disabled; no errors |

---

## Red Flags to Watch For
- `Warning: Each child in a list should have a unique "key" prop`
- `Hydration failed because...`
- `TypeError: Cannot read property 'X' of undefined`
- `Unhandled Rejection` or network 500s
- Any red error in console

---

## If Errors Occur
1. Note the exact error message and stack trace
2. Check which action triggered it (last click/input)
3. Verify data (e.g. season exists, block ids valid)
4. Re-run `npx prisma db push` if schema changed
