

## Problem

The IDU (Identifiant Unique) numbers returned by the ADEME API are not visible in the REP membership section, despite the edge function correctly fetching and returning them. The API confirms data like `FR418884_01FQUK` is available.

## Root Cause Analysis

The code in `RepMembershipSection.tsx` has the IDU rendering logic (lines 350-360 for summary, lines 372-379 for inline), and the matching logic at line 70 (`iduEntries.find(i => i.filiere === r.filiere)`) correctly pairs IDUs with their filieres. The API test confirms matching filieres (`EMPAP` = `EMPAP`).

The most likely cause is that the latest component code hasn't been applied in the running preview. The plan ensures the IDU is displayed even more prominently and adds a debug-safe fallback.

## Plan

1. **Make IDU more prominent in the inscrit card** -- Move the IDU display to be directly under the restaurant name/badge header, as a clearly visible standalone line (not buried in the detail entries). Show it with a distinct style: `IDU: FR418884_01FQUK` with a copy-friendly mono font and a colored background pill.

2. **Always show IDU at entry level** -- In each validity entry line, display the IDU immediately after the filiere badge, regardless of whether it matched. If no IDU was found for that filiere, show "IDU non disponible" in a muted style.

3. **Add a fallback display for unmatched IDUs** -- If `iduEntries` has entries that don't match any adherent filiere, display them separately at the bottom as a catch-all.

### Files to modify
- `src/components/analytics/RepMembershipSection.tsx` -- Restructure the inscrit card layout to show IDU more prominently

