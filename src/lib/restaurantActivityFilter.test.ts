import { describe, expect, it } from "vitest";
import { getEffectiveOpeningDate } from "./restaurantActivityFilter";

describe("getEffectiveOpeningDate", () => {
  it("prend la première activité si elle est plus ancienne que la date saisie (TC Nanterre)", () => {
    expect(getEffectiveOpeningDate({ id: "a", name: "Nanterre", first_activity_date: "2025-04-12", first_activity_source: "uber" }))
      .toEqual({ date: "2025-04-12", isAuto: true, source: "uber" });
  });
  it("garde la date saisie si elle est plus ancienne (CS Saint-Denis 2019, données depuis 2024)", () => {
    expect(getEffectiveOpeningDate({ id: "b", name: "Saint-Denis", uber_opening_date: "2019-06-19", first_activity_date: "2023-12-31", first_activity_source: "uber" }))
      .toEqual({ date: "2019-06-19", isAuto: false, source: "manual" });
  });
  it("ignore les dates impossibles (an 1)", () => {
    expect(getEffectiveOpeningDate({ id: "c", name: "Paris 18", first_activity_date: "0001-01-01" }).date).toBeNull();
  });
});
