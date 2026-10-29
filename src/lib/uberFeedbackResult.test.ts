import { describe, expect, it } from "vitest";
import { feedbackImportFailed } from "../../supabase/functions/parse-report-csv/feedbackResult";

describe("Automatic Uber feedback import", () => {
  it("does not acknowledge a rejected import as success", () => {
    expect(feedbackImportFailed(new Error("Import rejected"), null)).toBe(true);
    expect(feedbackImportFailed(null, { success: false })).toBe(true);
  });
  it("requires retries for partial database errors", () => {
    expect(feedbackImportFailed(null, { success: true, stats: { inserted: 9, errors: 1 } })).toBe(true);
  });
  it("accepts successful imports and empty reports", () => {
    expect(feedbackImportFailed(null, { success: true, stats: { inserted: 13, errors: 0 } })).toBe(false);
    expect(feedbackImportFailed(null, { success: true, stats: { inserted: 0, errors: 0 } })).toBe(false);
  });
});