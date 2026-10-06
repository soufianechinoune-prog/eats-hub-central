import * as XLSX from "xlsx";
import { MEAL_VOUCHER_PROVIDERS, type MealVoucherRestaurantRow } from "./useMealVoucherBreakdown";

const r2 = (v: number) => Math.round(v * 100) / 100;

export function exportMealVoucherExcel(params: {
  rows: MealVoucherRestaurantRow[];
  restaurantNames: Map<string, string>;
  periodLabel: string;
  startDate: string;
  endDate: string;
}) {
  const { rows, restaurantNames, periodLabel, startDate, endDate } = params;
  const list = rows
    .filter((r) => r.uberOrderCount > 0)
    .map((r) => ({ ...r, name: restaurantNames.get(r.restaurantId) ?? "—" }))
    .sort((a, b) => b.trAmount - a.trAmount);

  const totalTR = list.reduce((s, r) => s + r.trAmount, 0);
  const totalUber = list.reduce((s, r) => s + r.uberRevenueTTC, 0);
  const totalTROrders = list.reduce((s, r) => s + r.trOrderCount, 0);

  const synthese: Record<string, string | number>[] = [
    { Indicateur: "Période", Valeur: `${periodLabel} (${startDate} → ${endDate})` },
    { Indicateur: "Total TR encaissés (€)", Valeur: r2(totalTR) },
    { Indicateur: "CA Uber TTC (€)", Valeur: r2(totalUber) },
    { Indicateur: "% du CA Uber", Valeur: totalUber > 0 ? r2((totalTR / totalUber) * 100) : 0 },
    { Indicateur: "Commandes avec TR", Valeur: totalTROrders },
    { Indicateur: "Panier moyen TR (€)", Valeur: totalTROrders > 0 ? r2(totalTR / totalTROrders) : 0 },
    { Indicateur: "Restos sans aucun TR", Valeur: list.filter((r) => r.trAmount === 0).length },
  ];

  const emetteurs = MEAL_VOUCHER_PROVIDERS.map((p) => {
    const amount = list.reduce((s, r) => s + r.byProvider[p].amount, 0);
    return {
      Émetteur: p,
      "Montant (€)": r2(amount),
      "Part du total TR (%)": totalTR > 0 ? r2((amount / totalTR) * 100) : 0,
      Commandes: list.reduce((s, r) => s + r.byProvider[p].orderCount, 0),
      Restaurants: list.filter((r) => r.byProvider[p].amount > 0).length,
    };
  });

  const detail = list.map((r, i) => {
    const row: Record<string, string | number> = {
      "#": i + 1,
      Restaurant: r.name,
      "Total TR (€)": r2(r.trAmount),
      "Commandes TR": r.trOrderCount,
      "CA Uber TTC (€)": r2(r.uberRevenueTTC),
      "Commandes Uber": r.uberOrderCount,
      "% CA Uber": r2(r.trShareOfUber),
    };
    for (const p of MEAL_VOUCHER_PROVIDERS) {
      row[`${p} (€)`] = r2(r.byProvider[p].amount);
      row[`${p} (cmds)`] = r.byProvider[p].orderCount;
    }
    row["Émetteurs manquants"] = MEAL_VOUCHER_PROVIDERS.filter((p) => r.byProvider[p].amount === 0).length;
    return row;
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(synthese), "Synthèse");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emetteurs), "Par émetteur");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Restaurant x émetteur");
  XLSX.writeFile(wb, `titres-restaurant_${startDate}_${endDate}.xlsx`);
}
