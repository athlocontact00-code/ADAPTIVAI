## Coach Prompts Regression Suite

Use `npm run test:coach-prompts-regression` when changing coach prompt construction, intent-to-prompt constraints, or compact AI context shaping for coach chat.

This suite protects:
- required prompt constraints for requested sport, date, and swim distance
- swim PR extraction used for pace target injection
- prompt compactness for long profile notes and equipment fields
- privacy hardening so raw diary notes never reach the coach prompt builder

Use `npm run test:coach-prompts-regression:watch` while iterating on:
- `lib/services/coach-llm-prompts.ts`
- `lib/coach/swim-utils.ts`
- `lib/coach/intent.ts`
- `lib/services/ai-context.builder.ts`

Run the full suite before shipping changes to coach prompt templates, prompt injection rules, or compact context behavior.
