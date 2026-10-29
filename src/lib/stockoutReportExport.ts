import { getChainName, loadChainLogoBase64 } from "./pdfLogoHelper";
import { reportDate, reportHours, stockoutRestaurantSections, stockoutReportMethod, type StockoutReport } from "./stockoutReport";

const filename = (r: StockoutReport) => `bilan_ruptures_${r.restaurantId ? "restaurant" : "reseau"}_${r.start}_${r.end}`;
const targetName = (r: StockoutReport) => r.restaurants.find(x => x.id === r.restaurantId)?.name ?? "Ensemble du réseau";

// Read the shared theme tokens for document graphics too, rather than a separate report palette.
function tokenRgb(token: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = `hsl(var(--${token}))`;
  document.body.appendChild(probe);
  const values = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  probe.remove();
  return [values[0], values[1], values[2]];
}

export async function exportStockoutExcel(r: StockoutReport, chainId: string) {
  const [XLSX, name] = await Promise.all([import("xlsx-js-style"), getChainName(chainId)]);
  const wb = XLSX.utils.book_new();
  const append = (title: string, data: Record<string, string | number>[]) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const columns = Object.keys(data[0] ?? {});
    ws["!cols"] = columns.map(key => ({ wch: Math.min(65, Math.max(18, key.length + 2, ...data.map(row => String(row[key] ?? "").length))) }));
    const header = tokenRgb("primary").map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
    const foreground = tokenRgb("primary-foreground").map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
    columns.forEach((_, i) => {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
      if (cell) cell.s = { font: { bold: true, color: { rgb: foreground } }, fill: { fgColor: { rgb: header } }, alignment: { wrapText: true } };
    });
    if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
    XLSX.utils.book_append_sheet(wb, ws, title);
  };
  append("Synthèse produits", r.products.map(x => ({ Produit: x.name, "Ruptures enregistrées": x.events, "Heures-produit": x.minutes / 60, "Restaurants concernés": x.restaurants, "Restaurants concernés réseau": x.networkRestaurants, "Part du périmètre réseau (%)": x.networkShare })));
  const journal = (rows: StockoutReport["rows"]) => rows.map(x => ({ Restaurant: x.restaurant_name, Produit: x.product_name, Catégorie: x.category ?? "", "Référence Splash": x.item_id, "Début réel (Paris)": reportDate(x.started_at), "Fin réelle (Paris)": x.ended_at ? reportDate(x.ended_at) : "En cours", "Début compté (Paris)": reportDate(x.from), "Fin comptée (Paris)": reportDate(x.to), "Minutes dans la période": x.minutes, "Statut en fin de période": x.ended_at && Date.parse(x.ended_at) <= x.to ? "Résolue" : "Ouverte" }));
  stockoutRestaurantSections(r).forEach((section, i) => append(`${String(i + 1).padStart(2, "0")} ${section.name.replace(/Chicken Street - |Tasty Crousty - /g, "").replace(/[\\/?:*\[\]]/g, " ")}`.slice(0, 31), journal(section.rows)));
  append("Comparatif restaurants", r.restaurants.map(x => ({ Restaurant: x.name, "Restaurant ID": x.id, "Ruptures enregistrées": x.events, "Produits concernés": x.products, "Heures-produit sur période": x.minutes / 60, Observation: x.observed ? "Événements enregistrés" : "Aucun événement — couverture non certifiée" })));
  append("Évolution quotidienne", r.days.map(x => ({ Date: x.date, "Ruptures chevauchant le jour": x.events, "Heures-produit": x.minutes / 60 })));
  append("Journal chronologique", journal([...r.rows].sort((a, b) => a.from - b.from)));
  append("Périmètre & méthode", [
    { Rubrique: "Enseigne", Valeur: name }, { Rubrique: "Cible", Valeur: targetName(r) },
    { Rubrique: "Période", Valeur: `${r.start} au ${r.end}` }, { Rubrique: "Produit", Valeur: r.product ?? "Tous les produits" },
    { Rubrique: "Généré le (Paris)", Valeur: reportDate(r.generatedAt) },
    { Rubrique: "Restaurants du périmètre", Valeur: r.scopeCount },
    { Rubrique: "Restaurants avec événement", Valeur: r.observedCount },
    ...stockoutReportMethod.map((Valeur, i) => ({ Rubrique: `Méthode ${i + 1}`, Valeur })),
  ]);
  XLSX.writeFile(wb, `${filename(r)}.xlsx`);
}

export async function exportStockoutPdf(r: StockoutReport, chainId: string) {
  const [{ jsPDF }, name, logo] = await Promise.all([import("jspdf"), getChainName(chainId), loadChainLogoBase64(chainId)]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const colors = { fg: tokenRgb("foreground"), muted: tokenRgb("muted-foreground"), bg: tokenRgb("background"), primary: tokenRgb("primary"), border: tokenRgb("border") };
  const clean = (s: string) => s.replace(/[\u202f\u00a0]/g, " ").replace(/’/g, "'").replace(/—|→/g, "-").replace(/[^\u0020-\u007e\u00a0-\u00ff\n]/gu, "");
  const text = (s: string, x: number, y: number, size = 9, bold = false, muted = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...(muted ? colors.muted : colors.fg)); doc.text(clean(s), x, y);
  };
  const wrapped = (s: string, x: number, y: number, width: number, size = 9) => {
    doc.setFontSize(size); const lines = doc.splitTextToSize(clean(s), width) as string[];
    lines.forEach((line, i) => text(line, x, y + i * 4.3, size)); return lines.length;
  };
  const header = (title: string, continuation = false) => {
    doc.setFillColor(...colors.bg); doc.rect(0, 0, 210, 297, "F");
    doc.setLineWidth(0.2);
    if (logo) { try { doc.addImage(logo, 15, 12, 13, 13); } catch { /* Name is retained. */ } }
    text(name, logo ? 32 : 15, 17, 11, true); text("Ruptures & Disponibilité", logo ? 32 : 15, 23, 9, false, true);
    doc.setDrawColor(...colors.primary); doc.setLineWidth(0.8); doc.line(15, 30, 195, 30);
    const lines = wrapped(`${title}${continuation ? " (suite)" : ""}`, 15, 42, 180, 17);
    const y = 42 + lines * 6;
    text(`${r.start} au ${r.end}${r.product ? ` | ${r.product}` : ""}`, 15, y + 4, 9, false, true);
    return y + 15;
  };
  const stats = (items: [string, string][], y: number) => {
    items.forEach(([label, value], i) => { const x = 15 + i * 61; doc.setDrawColor(...colors.border); doc.setLineWidth(0.2); doc.line(x, y, x + 55, y); text(label, x, y + 7, 8, false, true); text(value, x, y + 17, 17, true); });
    return y + 23;
  };
  const tableHead = (columns: [string, number][], y: number) => { doc.setDrawColor(...colors.border); columns.forEach(([label, x]) => text(label, x, y, 8, true)); doc.line(15, y + 3, 195, y + 3); return y + 10; };
  let y = header(r.restaurantId ? `Synthèse produits - ${targetName(r)}` : "Synthèse produits réseau");
  y = stats([["Ruptures enregistrées", String(r.total.events)], ["Produits concernés", String(r.total.products)], ["Heures-produit", reportHours(r.total.minutes)]], y);
  text(`${r.observedCount}/${r.scopeCount} restaurants avec événements enregistrés`, 15, y, 9, false, true); y += 9;
  const summaryColumns: [string, number][] = [["Produit", 15], ["Ruptures", 113], ["Restos", 139], ["Durée cumulée", 164]];
  y = tableHead(summaryColumns, y);
  r.products.forEach(product => {
    doc.setFontSize(8); const lines = doc.splitTextToSize(clean(product.name), 91) as string[];
    const height = Math.max(5, lines.length * 4.3 + 0.7);
    if (y + height > 259) { doc.addPage(); y = tableHead(summaryColumns, header("Synthèse produits", true)); }
    wrapped(product.name, 15, y, 91, 8); text(String(product.events), 113, y, 8); text(String(product.restaurants), 139, y, 8); text(reportHours(product.minutes), 164, y, 8);
    y += height; doc.setDrawColor(...colors.border); doc.setLineWidth(0.15); doc.line(15, y - 1, 195, y - 1);
  });
  const disclaimer = "Couverture Splash partielle : aucun événement ne signifie pas absence de rupture. Les durées sont des heures-produit, pas des heures de fermeture. Les désactivations avant lancement peuvent être volontaires.";
  wrapped(disclaimer, 15, 265, 180, 8);
  const sections = stockoutRestaurantSections(r);
  sections.forEach(section => {
    doc.addPage(); y = header(section.name);
    const openCount = section.rows.filter(row => !row.ended_at || Date.parse(row.ended_at) > row.to).length;
    y = stats([["Produits concernés", String(section.products)], ["Ruptures sur période", String(section.events)], ["Heures-produit", reportHours(section.minutes)]], y);
    text(`${openCount} ouvertes en fin de période | ${section.events - openCount} résolues`, 15, y, 9, false, true); y += 10;
    const columns: [string, number][] = [["Produit", 15], ["Début réel", 85], ["Remise en stock", 126], ["Durée période", 168]];
    y = tableHead(columns, y);
    section.rows.forEach(row => {
      doc.setFontSize(8); const lines = doc.splitTextToSize(clean(row.product_name), 65) as string[];
      const height = Math.max(8.7, lines.length * 4.3 + 2);
      if (y + height > 259) { doc.addPage(); y = tableHead(columns, header(section.name, true)); }
      wrapped(row.product_name, 15, y, 65, 8);
      wrapped(reportDate(row.started_at), 85, y, 36, 8);
      const endLabel = row.ended_at && Date.parse(row.ended_at) <= row.to ? reportDate(row.ended_at) : "Ouverte en fin de période";
      wrapped(endLabel, 126, y, 36, 8); text(reportHours(row.minutes), 168, y, 8);
      y += height; doc.setDrawColor(...colors.border); doc.line(15, y - 4, 195, y - 4);
    });
    wrapped("Dates de rupture réelles, durées limitées à la période choisie. Confirmer les ruptures volontaires et vérifier les produits toujours désactivés avec le restaurant.", 15, 263, 180, 8);
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { doc.setPage(page); text(`MIJOTEK | ${reportDate(r.generatedAt)} | ${page}/${pages}`, 15, 288, 8, false, true); }
  doc.save(`${filename(r)}.pdf`);
}
