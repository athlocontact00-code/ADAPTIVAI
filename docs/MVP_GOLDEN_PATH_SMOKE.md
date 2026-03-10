# MVP golden path smoke

Manual checklist for the first AdaptivAI MVP loop:

## Golden path

1. Open `/register` and create a new account.
2. Confirm redirect to `/onboarding`.
3. Complete onboarding and generate the first plan.
4. Land on `/dashboard?fromOnboarding=1` and confirm the next action is clear.
5. Open `/today` and confirm the same daily state appears there.
6. Open `/calendar` and confirm `Today in Calendar` shows the same primary action.
7. If a workout is planned, complete pre-training check-in.
8. Open the workout from `Today` or `Calendar`.
9. Mark the workout as completed.
10. Save post-workout feedback.
11. Confirm `/dashboard` and `/today` refresh to the updated daily state.

## What changed in this MVP pass

- `Dashboard`, `Today`, and `Calendar` now share a common daily flow model.
- Check-in, workout, and feedback actions refresh the surrounding UI after completion.
- Onboarding now pushes users toward `Dashboard` first, then `Today`.
- The feedback modal now behaves like a single focused flow and resets cleanly between workouts.

## Current blockers found during validation

- `npm run typecheck` passes.
- `npm run test` passes.
- Manual smoke test is partially blocked by local runtime instability around Next.js manifests in dev mode.
- The main runtime issue observed locally is missing `.next/routes-manifest.json` during auth/API requests in `next dev`.
- A version mismatch warning is present between `next` (`15.5.11`) and `@next/swc` (`15.5.7`).

## Pilot blocker list

1. Stabilize local Next.js runtime so auth and API routes work consistently in development.
2. Align `@next/swc` with the installed `next` version.
3. Re-run the full auth -> onboarding -> dashboard -> today -> calendar -> feedback smoke test after runtime stabilization.

## Out of scope for this MVP pass

- Simulator polish
- Season HQ expansion
- Deeper progress analytics
- AI infrastructure hardening
