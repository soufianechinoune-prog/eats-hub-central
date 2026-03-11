

## Problem

The `managers` table has a unique constraint on the `phone` column (`managers_phone_key`). When adding a co-manager with a phone number that already exists (because that person manages another restaurant), the insert fails.

The fix is simple: in the `CoManagersSection` add mutation, check if a manager with that phone already exists. If yes, reuse their ID instead of creating a new record.

## Changes

**File: `src/components/restaurants/CoManagersSection.tsx`**

Update the `addMutation` logic:
1. First, query `managers` table for an existing record matching the phone number
2. If found, use that existing manager's ID (and optionally update their name/email if provided)
3. If not found, create a new manager record
4. Then create the `manager_restaurants` link as before

This mirrors the existing multi-restaurant manager architecture where one manager can be linked to many restaurants.

