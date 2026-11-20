import { describe, expect, it } from "vitest";
import { channelN1Status, restaurantN1Status, shiftYear, type ChannelDatesRow } from "./channelOpening";

// Valeurs réelles au 20/11/2026
const villeneuve: ChannelDatesRow = {
  uber_opening_date: "2025-03-24", uber_first_date: "2025-04-18", uber_history_start: "2024-01-01", uber_is_opening: true,
  cash_first_date: "2026-02-01", cash_history_start: "2026-02-01", cash_is_opening: false,
};
const goussainville: ChannelDatesRow = {
  uber_first_date: "2026-06-01", uber_history_start: "2026-05-24", uber_is_opening: false,
  cash_first_date: "2025-04-08", cash_history_start: "2024-05-01", cash_is_opening: true,
};
const saintDenis: ChannelDatesRow = {
  uber_opening_date: "2019-06-19", uber_first_date: "2023-12-31", uber_history_start: "2023-12-31", uber_is_opening: false,
  cash_first_date: "2024-05-01", cash_history_start: "2024-05-01", cash_is_opening: false,
};
const antony: ChannelDatesRow = {
  uber_opening_date: "2025-11-13", uber_first_date: "2025-11-14", uber_history_start: "2024-01-01", uber_is_opening: true,
  cash_first_date: "2025-11-09", cash_history_start: "2024-05-01", cash_is_opening: true,
};

describe("channelN1Status (2026 vs 2025)", () => {
  it("Antony : nouveau sur Uber comme en caisse", () => {
    expect(channelN1Status(antony, "uber", "2026-01-01")).toBe("new");
    expect(channelN1Status(antony, "cash", "2026-01-01")).toBe("new");
    expect(restaurantN1Status(antony, "all", "2026-01-01").status).toBe("new");
  });
  it("Goussainville : caisse comparable, Uber historique incomplet", () => {
    expect(channelN1Status(goussainville, "cash", "2026-01-01")).toBe("new"); // caisse ouverte le 08/04/2025
    expect(channelN1Status(goussainville, "cash", "2026-06-01")).toBe("ok"); // juin 2026 vs juin 2025
    expect(channelN1Status(goussainville, "uber", "2026-06-01")).toBe("incomplete");
  });
  it("Villeneuve : nouveau en 2026 (Uber ouvert le 24/03/2025), même si la caisse n'est suivie que depuis 02/2026", () => {
    expect(restaurantN1Status(villeneuve, "all", "2026-01-01")).toMatchObject({ status: "new", channel: "uber", date: "2025-03-24" });
  });
  it("Villeneuve : caisse depuis le 01/02/2026 = début de nos données, pas une ouverture", () => {
    expect(channelN1Status(villeneuve, "cash", "2026-06-01")).toBe("incomplete");
    expect(channelN1Status(villeneuve, "uber", "2026-06-01")).toBe("ok");
  });
  it("Saint-Denis : comparable en 2026, caisse incomplète en 2025 (données caisse depuis 05/2024)", () => {
    expect(restaurantN1Status(saintDenis, "all", "2026-01-01").status).toBe("ok");
    expect(channelN1Status(saintDenis, "cash", "2025-01-01")).toBe("incomplete");
    expect(channelN1Status(saintDenis, "uber", "2025-01-01")).toBe("ok");
  });
  it("aucune donnée sur le canal", () => {
    expect(channelN1Status({}, "deliveroo", "2026-01-01")).toBe("none");
  });
  it("canal ajouté en cours de route signalé", () => {
    const r: ChannelDatesRow = { ...saintDenis, deliveroo_opening_date: "2026-03-01", deliveroo_first_date: "2026-03-01" };
    const n1 = restaurantN1Status(r, "all", "2026-01-01");
    expect(n1.status).toBe("ok");
    expect(n1.addedChannels).toEqual([{ channel: "deliveroo", date: "2026-03-01" }]);
  });
  it("décalage d'un an, 29 février compris", () => {
    expect(shiftYear("2026-11-01", -1)).toBe("2025-11-01");
    expect(shiftYear("2028-02-29", -1)).toBe("2027-02-28");
  });
});
