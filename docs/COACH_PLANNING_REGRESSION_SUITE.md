## Coach Planning Regression Suite

Use `npm run test:coach-planning-regression` when changing coach planning, prescription generation, or coach-applied workout plan flows.

This suite protects:
- coach intent parsing and rubric generation
- benchmark- and preference-aware workout prescription logic
- idempotent coach workout persistence and replacement behavior
- coach calendar insert flows
- coach-applied workout plan updates and proposal behavior
- planner freshness after coach-applied workout plan changes

Use `npm run test:coach-planning-regression:watch` while iterating on:
- `lib/services/coach-brain.ts`
- `lib/actions/coach-draft.ts`
- `lib/actions/coach-workout-plan.ts`

Run the full suite before shipping changes to coach planning quality, guardrails, or coach-driven workout editing.
