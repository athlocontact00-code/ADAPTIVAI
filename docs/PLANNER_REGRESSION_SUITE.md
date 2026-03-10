## Planner Regression Suite

Use `npm run test:planner-regression` when changing any part of the Adaptive Day Planner freshness flow.

This suite protects:
- planner cache freshness and date normalization
- `today-decision` API cache vs recompute behavior
- stale recommendation copy/badge semantics across planner surfaces
- launcher summary freshness/staleness rendering on Today, Dashboard, and Calendar
- premium check-in and conflict review freshness rendering
- shared planner status badge/header rendering
- check-in result handoff state after auto-apply and undo
- shared plan adaptation copy for apply/proposal flows
- shared proposal review loop via Calendar deep links
- Calendar review context header when landing from a proposal link
- Calendar URL cleanup after proposal accept/decline
- Calendar proposal review state helpers and URL transitions
- Calendar page server-side proposal resolution (`proposalId` -> `workoutId` + review context)
- pending coach change visibility contract across Coach, Dashboard, and Calendar
- coach suggestion handoff into Calendar workout/day review context
- coach review context cleanup after Calendar actions and URL sync
- coach review target cleanup in Coach after apply/dismiss actions
- shared coach review copy/CTA labels across Coach and Calendar
- shared coach review outcome copy across Coach and Calendar resolution states
- next-step CTA after coach review resolution in Calendar
- resolved coach review handoff back into Coach
- resolved coach review handoff into Dashboard
- planner cache invalidation after workout mutations from coach flows
- planner cache invalidation after coach-applied workout plan edits
- planner cache invalidation after plan proposal decisions
- planner cache invalidation after daily check-in adaptations

Use `npm run test:planner-regression:watch` while iterating on:
- `lib/services/adaptive-day-planner-cache.service.ts`
- `lib/services/resolved-coach-review.service.ts`
- `app/api/ai/today-decision/route.ts`
- `lib/actions/coach-draft.ts`
- `lib/actions/coach-workout-plan.ts`
- `lib/actions/plan-rigidity.ts`
- `lib/actions/daily-checkin.ts`
- `lib/product/today-decision-staleness.ts`
- `components/today-decision-inline-status.tsx`
- `components/adaptive-planner-status-cluster.tsx`
- `lib/product/checkin-result-ui.ts`
- `lib/product/plan-adaptation-ui.ts`
- `lib/product/calendar-proposal-review.ts`
- `lib/product/calendar-coach-review.ts`
- `lib/product/coach-pending-changes.ts`
- `lib/product/coach-review-context.ts`
- `lib/product/coach-review-copy.ts`
- `lib/product/coach-review-outcome.ts`
- `lib/product/coach-review-next-step.ts`
- `app/(app)/calendar/page.tsx`
- `app/(app)/calendar/calendar-client.tsx`
- `components/dashboard/daily-checkin-inline.tsx`
- `components/dashboard/conflict-review-drawer.tsx`
- `components/daily-checkin-modal.tsx`
- `components/coach/coach-command-center.tsx`
- `components/coach/pending-coach-changes-banner.tsx`
- `components/dashboard/resolved-coach-review-banner.tsx`
- `components/calendar/coach-review-context-card.tsx`
- `components/calendar/coach-review-next-step-card.tsx`

Run the full suite before shipping changes to planner freshness, invalidation, or background refresh behavior.
