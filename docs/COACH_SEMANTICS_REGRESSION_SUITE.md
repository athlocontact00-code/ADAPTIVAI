## Coach Semantics Regression Suite

Use `npm run test:coach-semantics-regression` when changing coach quality gates, workout section requirements, or sport-specific structure validation.

This suite protects:
- sport detection and sport-correctness validation
- swim completeness checks for explicit meters
- semantic workout structure checks for `SWIM`, `RUN`, `BIKE`, and `STRENGTH`
- required save-ready sections such as warm-up, main set, cool-down, and `CORE` for strength
- intensity cue expectations such as pace, RPE, HR, FTP, watts, or equivalent targets
- the retry loop in `sendCoachMessage()` when the first LLM answer is structurally incomplete
- the strict JSON retry in `sendCoachMessage()` when the first auto-save payload does not match user intent
- the swim hard guard that refuses to save when requested meters still do not match after retry
- the swim near-match auto-fix path and exact-meter helpers used to repair small payload mismatches
- response finalization logic for sanitize, confidence inference, guardrails, and uncertainty copy
- request routing heuristics for add-to-calendar, manual add, today list, seven-day plan, and default coach chat
- manual add workout orchestration for past dates, protected dates, proposal creation, and direct adds
- lightweight response handlers for today's workouts and seven-day plan output normalization
- deterministic fallback behavior when the full coach path is unavailable
- manual workout parsing for dates, type/intensity/title inference, sections, and extra targets
- workout creation assembly for template generation, persistence, audit logging, and planner invalidation
- shared coach chat utilities for local day ranges, rigidity parsing, error classification, medical copy stripping, and payload extraction

Use `npm run test:coach-semantics-regression:watch` while iterating on:
- `lib/utils/coach-gates.ts`
- `lib/actions/coach-chat.ts`
- `lib/coach/intent.ts`
- `lib/coach/swim-utils.ts`
- `lib/utils/swim-meters.ts`
- `lib/services/coach-correction-orchestrator.ts`
- `lib/services/coach-response-finalizer.ts`
- `lib/services/coach-response-envelope.ts`
- `lib/services/coach-request-router.ts`
- `lib/services/coach-manual-add-handler.ts`
- `lib/services/coach-lightweight-response-handlers.ts`
- `lib/services/coach-deterministic-fallback.ts`
- `lib/services/coach-manual-workout-parser.ts`
- `lib/services/coach-workout-creator.ts`
- `lib/services/coach-chat-utils.ts`

Run the full suite before shipping changes to coach response quality gates or retry heuristics.
