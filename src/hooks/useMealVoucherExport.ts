import * as XLSX from "xlsx-js-style";
import { MEAL_VOUCHER_PROVIDERS, type MealVoucherRestaurantRow } from "./useMealVoucherBreakdown";

const r2 = (v: number) => Math.round(v * 100) / 100;

const FONT = "Arial";
const MONEY_FMT = '#,##0.00\\ "€"';
const PCT_FMT = '0.0"%"';

// Palette de codes couleur (classique Excel)
// - En-têtes : bleu nuit
// - Montant 0 € : rouge
// - Montant > 0 € : vert
// - Émetteurs manquants : orange
const headerStyle: XLSX.CellStyle = {
  font: { name: FONT, sz: 11, bold: true, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: "1F2A44" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { bottom: { style: "thin", color: { rgb: "1F2A44" } } },
};
const baseStyle: XLSX.CellStyle = {
  font: { name: FONT, sz: 11, color: { rgb: "000000" } },
  alignment: { vertical: "center" },
};
const boldStyle: XLSX.CellStyle = {
  font: { name: FONT, sz: 11, bold: true, color: { rgb: "000000" } },
  alignment: { vertical: "center" },
};
const zeroStyle: XLSX.CellStyle = {
  font: { name: FONT, sz: 11, bold: true, color: { rgb: "9C0006" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFC7CE" } },
  alignment: { horizontal: "right", vertical: "center" },
};
const posStyle: XLSX.CellStyle = {
  font: { name: FONT, sz: 11, color: { rgb: "006100" } },
  fill: { patternType: "solid", fgColor: { rgb: "C6EFCE" } },
  alignment: { horizontal: "right", vertical: "center" },
};
const warnStyle: XLSX.CellStyle = {
  font: { name: FONT, sz: 11, bold: true, color: { rgb: "9C6500" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFEB9C" } },
  alignment: { horizontal: "right", vertical: "center" },
};
const legendCell = (s: XLSX.CellStyle): XLSX.CellStyle => ({ ...s, alignment: { horizontal: "center", vertical: "center" } });

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

function styleSheet(
  ws: XLSX.WorkSheet,
  opts: {
    boldFirstCol?: boolean;
    moneyCols?: number[];
    pctCols?: number[];
    redZeroCols?: number[];
    greenPositiveCols?: number[];
    warnPositiveCols?: number[];
  }
) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  // En-têtes
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    if (cell) cell.s = headerStyle;
  }
  // Corps
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (!cell) continue;
      let style: XLSX.CellStyle | undefined;
      if (opts.redZeroCols?.includes(c)) {
        style = cell.v === 0 ? zeroStyle : opts.greenPositiveCols?.includes(c) ? posStyle : baseStyle;
      } else if (opts.greenPositiveCols?.includes(c)) {
        style = posStyle;
      }
      if (!style && opts.warnPositiveCols?.includes(c)) {
        style = (cell.v as number) > 0 ? warnStyle : baseStyle;
      }
      cell.s = style ?? (opts.boldFirstCol && c === 0 ? boldStyle : baseStyle);
      if (opts.moneyCols?.includes(c)) cell.z = MONEY_FMT;
      if (opts.pctCols?.includes(c)) cell.z = PCT_FMT;
    }
  }
}

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

  // --- Synthèse + légende des couleurs ---
  const wsSynthese = XLSX.utils.json_to_sheet(synthese, { header: ["Indicateur", "Valeur"] });
  setColWidths(wsSynthese, [30, 46]);
  const legendStart = synthese.length + 2; // 1 ligne vide
  XLSX.utils.sheet_add_aoa(
    wsSynthese,
    [
      ["Légende des couleurs", ""],
      ["0,00 €", "Émetteur avec 0 € sur la période"],
      ["1 234,56 €", "Montant encaissé (> 0 €)"],
      ["3", "Émetteurs manquants (nombre > 0)"],
    ],
    { origin: legendStart }
  );
  const legendRows = [
    { a: boldStyle },
    { a: legendCell(zeroStyle), b: baseStyle },
    { a: legendCell(posStyle), b: baseStyle },
    { a: legendCell(warnStyle), b: baseStyle },
  ];
  legendRows.forEach((lr, i) => {
    const r = legendStart + i;
    const aAddr = XLSX.utils.encode_cell({ r, c: 0 });
    const bAddr = XLSX.utils.encode_cell({ r, c: 1 });
    const a = wsSynthese[aAddr] as XLSX.CellObject | undefined;
    if (a) a.s = lr.a;
    const b = wsSynthese[bAddr] as XLSX.CellObject | undefined;
    if (b) b.s = lr.b;
  });
  // Corps synthèse : montants en €, % en pourcentage
  for (let r = 1; r <= synthese.length; r++) {
    const label = synthese[r - 1].Indicateur as string;
    const a = wsSynthese[XLSX.utils.encode_cell({ r, c: 0 })] as XLSX.CellObject | undefined;
    if (a) a.s = boldStyle;
    const b = wsSynthese[XLSX.utils.encode_cell({ r, c: 1 })] as XLSX.CellObject | undefined;
    if (!b) continue;
    b.s = baseStyle;
    if (label.includes("(€)")) b.z = MONEY_FMT;
    if (label.startsWith("%")) b.z = PCT_FMT;
  }
  for (let c = 0; c <= 1; c++) {
    const cell = wsSynthese[XLSX.utils.encode_cell({ r: 0, c })] as XLSX.CellObject | undefined;
    if (cell) cell.s = headerStyle;
  }
  XLSX.utils.book_append_sheet(wb, wsSynthese, "Synthèse");

  // --- Par émetteur ---
  const wsEmetteurs = XLSX.utils.json_to_sheet(emetteurs);
  setColWidths(wsEmetteurs, [18, 16, 20, 12, 13]);
  styleSheet(wsEmetteurs, {
    boldFirstCol: true,
    moneyCols: [1],
    pctCols: [2],
    redZeroCols: [1],
    greenPositiveCols: [1],
  });
  XLSX.utils.book_append_sheet(wb, wsEmetteurs, "Par émetteur");

  // --- Restaurant x émetteur ---
  const wsDetail = XLSX.utils.json_to_sheet(detail);
  const moneyCols: number[] = [2, 4];
  const pctCols: number[] = [6];
  const redZeroCols: number[] = [2];
  const greenPositiveCols: number[] = [2];
  const providerAmountCols: number[] = [];
  const providerCmdCols: number[] = [];
  let col = 7;
  for (const p of MEAL_VOUCHER_PROVIDERS) {
    providerAmountCols.push(col);
    providerCmdCols.push(col + 1);
    col += 2;
  }
  const warnCol = col; // Émetteurs manquants
  const detailWidths = [5, 34, 14, 13, 16, 15, 11];
  const detailHeaders = Object.keys(detail[0] ?? {});
  detailHeaders.forEach((h, c) => {
    if (c < 7) return;
    if (h.endsWith("(cmds)")) detailWidths.push(11);
    else if (h === "Émetteurs manquants") detailWidths.push(18);
    else detailWidths.push(14);
  });
  setColWidths(wsDetail, detailWidths);
  styleSheet(wsDetail, {
    boldFirstCol: false,
    moneyCols: [...moneyCols, ...providerAmountCols],
    pctCols,
    redZeroCols: [...redZeroCols, ...providerAmountCols],
    greenPositiveCols: [...greenPositiveCols, ...providerAmountCols],
    warnPositiveCols: [warnCol],
  });
  // Colonne Restaurant : gras
  for (let r = 1; r <= detail.length; r++) {
    const cell = wsDetail[XLSX.utils.encode_cell({ r, c: 1 })] as XLSX.CellObject | undefined;
    if (cell) cell.s = boldStyle;
  }
  XLSX.utils.book_append_sheet(wb, wsDetail, "Restaurant x émetteur");

  XLSX.writeFile(wb, `titres-restaurant_${startDate}_${endDate}.xlsx`);
}
