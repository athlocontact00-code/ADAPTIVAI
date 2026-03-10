## Coach Output Regression Suite

Use `npm run test:coach-output-regression` when changing coach response parsing, calendar insert extraction, or fallback workout-to-calendar conversion.

This suite protects:
- parsing the final `calendarInsert` JSON block from coach responses
- normalization of lowercase sport values, bad duration fields, and multiline markdown inside JSON
- fallback parsing of `CALENDAR BLOCK` / labeled workout text when JSON is missing
- choosing the latest valid workout block when the model emits an example before the final answer
- `STRENGTH` workout parsing, including `CORE` sections used for calendar save flows

Use `npm run test:coach-output-regression:watch` while iterating on:
- `lib/schemas/coach-calendar-insert.ts`
- `lib/coach/workout-parser.ts`
- `lib/coach/calendar-payload-from-messages.ts`
- `lib/actions/coach-draft.ts`
- `lib/actions/coach-chat.ts`

Run the full suite before shipping changes to coach save-to-calendar behavior or parser contracts.
