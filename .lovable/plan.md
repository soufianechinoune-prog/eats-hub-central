

## Problem

The "Gérant" column in the restaurant list shows "-" for all restaurants because it reads from `restaurants.manager_first_name` and `restaurants.manager_last_name` columns, which are empty. The actual manager data is stored in the `managers` table, linked via `manager_restaurants` (the newer architecture). The restaurant detail page correctly uses this linked table to display manager names, but the list page does not.

## Solution

Update the restaurant list query in `src/pages/Restaurants.tsx` to join the `manager_restaurants` and `managers` tables, then display the linked manager's name in the "Gérant" column.

### Changes

**`src/pages/Restaurants.tsx`**:

1. Update the Supabase query to also fetch linked managers via a join:
   ```
   .select(`*, manager_restaurants(managers(first_name, last_name))`)
   ```

2. Update the "Gérant" column rendering (lines 479-484) to first check for linked managers from the `manager_restaurants` join, and fall back to the legacy `manager_first_name`/`manager_last_name` fields.

3. Update the sort logic for the "manager" column to use the same resolution (linked manager name first, then legacy fields).

This is a minimal change: one query modification and one rendering update. No new components or database changes needed.

