

# Fix: Deliveroo CSV import stuck on loading

## Root cause

Two bugs in `src/components/reports/DeliverooImportTab.tsx`:

1. **No client-side timeout on edge function calls**: `supabase.functions.invoke` uses `fetch` internally which has NO default timeout. When processing 10+ files sequentially with `dryRun: false`, if any single file's actual import takes longer than the edge function's server-side timeout (60s), the server terminates but the client's `fetch` may hang indefinitely. All subsequent files are blocked too.

2. **`readFileAsText` is outside try-catch** (line 97): If `FileReader` fails for any file, the error is unhandled, `setIsLoading(false)` never runs, and the UI stays stuck on the spinner permanently.

Evidence: Edge function logs show all dry-run calls succeed, but zero "Import done" messages appear — the actual import calls (dryRun: false) never complete or never start properly.

## Fix

### `src/components/reports/DeliverooImportTab.tsx`

1. **Add `AbortController` timeout** to all `supabase.functions.invoke` calls (both dry-run and actual import) — 90-second client-side timeout per file
2. **Move `readFileAsText` inside try-catch** in `handleFileChange` 
3. **Add `finally` blocks** to both `handleFileChange` and `handleImport` to guarantee `setIsLoading(false)` always runs
4. **Add console.log** at key points (start/end of each file processing) for future debugging

### `supabase/functions/parse-deliveroo-statement/index.ts`

5. **Add a log at the START of actual import** (not dry run) so we can trace whether the function is even invoked: `console.log("Starting actual import for: " + fileName)`

