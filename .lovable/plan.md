
# Fix: Uber One chart truncated at 11 days in Network view

## Root Cause

The database function `get_uber_one_stats` returns one row per restaurant per day. For 92 restaurants over 31 days, that's **2,799 rows**. The database client applies a **default limit of 1,000 rows**, so only the first ~11 days of data are returned (1000 / 92 = ~11 days). With a single restaurant, 31 rows fit easily under the limit.

## Fix

### File: `src/hooks/useUberOneStats.ts`

Add `.limit(10000)` to the RPC call chain to override the default 1,000 row cap. This ensures all rows are returned even for large networks with daily granularity (worst case: ~100 restaurants x 365 days = 36,500 rows for yearly view, so 10,000 covers monthly views comfortably).

```text
Before:
  supabase.rpc("get_uber_one_stats", { ... })

After:
  supabase.rpc("get_uber_one_stats", { ... }).limit(10000)
```

This is a one-line change that resolves the truncation for all period modes.
