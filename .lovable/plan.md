

## Plan

### 1. Add "Attestation adhésion" document type

Add `"attestation_adhesion"` to the `DocumentType` union and `DOCUMENT_TYPES` array in `RestaurantDocuments.tsx`, with a distinct badge color (e.g., teal/emerald to match the eco-contribution theme).

**File: `src/components/restaurants/RestaurantDocuments.tsx`**
- Add `"attestation_adhesion"` to the `DocumentType` type
- Add `{ value: "attestation_adhesion", label: "Attestation adhésion REP" }` to `DOCUMENT_TYPES`
- Add a teal/emerald badge color case in `getDocumentTypeBadgeColor`

### 2. Fix `NodeJS.Timeout` build errors

Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` in 4 files:
- `src/components/actions/CalendarDayView.tsx` (line 129)
- `src/components/actions/CalendarMonthView.tsx` (line 223)
- `src/components/actions/CalendarWeekView.tsx` (line 119)
- `src/hooks/useVoiceRecorder.ts` (line 20)

