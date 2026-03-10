## Memory Context Regression Suite

Use `npm run test:memory-context-regression` when changing AI memory aggregation, visibility filtering, or AI context privacy rules.

This suite protects:
- learnable diary entry filtering by visibility
- AI memory summary visibility scoring
- prompt context output for limited diary visibility
- AI context verification that raw diary notes never leak into prompts

Use `npm run test:memory-context-regression:watch` while iterating on:
- `lib/services/ai-memory.service.ts`
- `lib/services/ai-context.builder.ts`

Run the full suite before shipping changes to memory privacy, context shaping, or visibility-aware prompt behavior.
