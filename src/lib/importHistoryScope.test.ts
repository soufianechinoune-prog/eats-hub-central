import { describe, expect, it } from "vitest";
import { belongsToImportScope } from "./importHistoryScope";

describe("Import history brand isolation", () => {
  it("excludes unassigned imports from Bangkok", () => {
    expect(belongsToImportScope([], ["bangkok"])).toBe(false);
    expect(belongsToImportScope([null], ["bangkok"])).toBe(false);
  });
  it("excludes Chicken Street imports from Bangkok", () => {
    expect(belongsToImportScope(["chicken-street"], ["bangkok"])).toBe(false);
  });
  it("includes only imports intersecting the active brand", () => {
    expect(belongsToImportScope(["bangkok"], ["bangkok"])).toBe(true);
    expect(belongsToImportScope(["bangkok"], [])).toBe(false);
  });
});