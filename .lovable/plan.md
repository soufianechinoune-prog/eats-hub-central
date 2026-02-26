

# Fix Deliveroo import 500 timeout errors

## Root cause

The `parse-deliveroo-statement` edge function receives the entire CSV content in one HTTP request and processes all upsert batches synchronously without delays. For large files (700+ rows), the cumulative DB round-trips exceed Cloudflare's execution timeout (typically 25-30s for Deno edge functions), resulting in a 500 error.

The edge function logs confirm that most files succeed (125-475 rows), but the largest file (701 rows / 708 raw records) likely triggers the timeout.

## Fix strategy

Add a small inter-batch delay (50ms) in the upsert loop inside `parse-deliveroo-statement/index.ts` to prevent connection exhaustion, and reduce batch size from 100 to 50 for more predictable timing. This matches the pattern already used in other edge functions per the memory note on performance and resilience.

### File: `supabase/functions/parse-deliveroo-statement/index.ts`

1. **Reduce BATCH_SIZE** from 100 to 50 (line 140)
2. **Add 50ms delay between batches** after each upsert call in the loop (after line 159)

```typescript
// After each batch upsert:
if (i + BATCH_SIZE < deduplicatedRecords.length) {
  await new Promise(r => setTimeout(r, 50));
}
```

This is a minimal, targeted fix. No frontend changes needed.

