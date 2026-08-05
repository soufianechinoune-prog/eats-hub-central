import * as XLSX from "xlsx";
import { MonthAggregate, RestaurantAggregate, deltaPct } from "./useSplashOnsiteMonthly";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const pct = (c: number, p: number) => {
  const d = deltaPct(c, p);
  return d === null ? "--" : Number(d.toFixed(1));
};

export function exportOnsiteSalesExcel(params: {
  year: number;
  networkMonths: MonthAggregate[];
  restaurants: RestaurantAggregate[];
  totals: { current: number; previous: number; lflCurrent: number; lflPrevious: number; lflRestaurants: number };
  chainName?: string;
}) {
  const { year, networkMonths, restaurants, totals, chainName } = params;
  const prev = year - 1;

  const synthese = networkMonths.map((m) => ({
    Mois: MONTHS[m.month - 1] + (m.isPartial ? " (partiel)" : ""),
    [`CA sur place ${year}`]: Math.round(m.current),
    [`CA sur place ${prev}`]: Math.round(m.previous),
    "Évol. brute (%)": pct(m.current, m.previous),
    [`CA LFL ${year}`]: Math.round(m.lflCurrent),
    [`CA LFL ${prev}`]: Math.round(m.lflPrevious),
    "Évol. LFL (%)": pct(m.lflCurrent, m.lflPrevious),
    "Restaurants LFL": m.lflRestaurants,
  }));
  synthese.push({
    Mois: "TOTAL",
    [`CA sur place ${year}`]: Math.round(totals.current),
    [`CA sur place ${prev}`]: Math.round(totals.previous),
    "Évol. brute (%)": pct(totals.current, totals.previous),
    [`CA LFL ${year}`]: Math.round(totals.lflCurrent),
    [`CA LFL ${prev}`]: Math.round(totals.lflPrevious),
    "Évol. LFL (%)": pct(totals.lflCurrent, totals.lflPrevious),
    "Restaurants LFL": totals.lflRestaurants,
  } as any);

  const parResto = restaurants.map((r) => ({
    Restaurant: r.name,
    [`CA sur place ${year}`]: Math.round(r.current),
    [`CA sur place ${prev}`]: Math.round(r.previous),
    "Évol. brute (%)": pct(r.current, r.previous),
    [`CA LFL ${year}`]: Math.round(r.lflCurrent),
    [`CA LFL ${prev}`]: Math.round(r.lflPrevious),
    "Évol. LFL (%)": pct(r.lflCurrent, r.lflPrevious),
    "Mois LFL": r.lflMonths,
  }));

  const detail = restaurants.flatMap((r) =>
    r.months.map((m) => ({
      Restaurant: r.name,
      Mois: MONTHS[m.month - 1],
      [`CA ${year}`]: Math.round(m.current),
      [`CA ${prev}`]: Math.round(m.previous),
      "Évol. (%)": pct(m.current, m.previous),
      "Périmètre constant": m.lflRestaurants > 0 ? "Oui" : "Non",
      Partiel: m.isPartial ? "Oui" : "Non",
    }))
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(synthese), "Synthèse mensuelle");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parResto), "Par restaurant");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Détail resto x mois");
  XLSX.writeFile(wb, `ventes-sur-place_${(chainName || "reseau").replace(/\s+/g, "-").toLowerCase()}_${year}-vs-${prev}.xlsx`);
}
