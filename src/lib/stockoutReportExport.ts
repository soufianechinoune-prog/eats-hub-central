import { getChainName, loadChainLogoBase64 } from "./pdfLogoHelper";
import { reportDate, reportHours, stockoutReportMethod, type StockoutReport } from "./stockoutReport";

const filename = (r: StockoutReport) => `bilan_ruptures_${r.restaurantId ? "restaurant" : "reseau"}_${r.start}_${r.end}`;
const targetName = (r: StockoutReport) => r.restaurants.find(x => x.id === r.restaurantId)?.name ?? "Réseau sélectionné";

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
  append("Périmètre & méthode", [
    { Rubrique: "Enseigne", Valeur: name }, { Rubrique: "Cible", Valeur: targetName(r) },
    { Rubrique: "Période", Valeur: `${r.start} au ${r.end}` }, { Rubrique: "Produit", Valeur: r.product ?? "Tous les produits" },
    { Rubrique: "Généré le (Paris)", Valeur: reportDate(r.generatedAt) },
    { Rubrique: "Restaurants du périmètre", Valeur: r.scopeCount },
    { Rubrique: "Restaurants avec événement", Valeur: r.observedCount },
    ...stockoutReportMethod.map((Valeur, i) => ({ Rubrique: `Méthode ${i + 1}`, Valeur })),
  ]);
  append("Comparatif restaurants", r.restaurants.map(x => ({ Restaurant: x.name, "Restaurant ID": x.id, "Cible du rapport": !r.restaurantId || r.restaurantId === x.id ? "Oui" : "Comparatif", "Ruptures enregistrées": x.events, "Produits concernés": x.products, "Heures-produit sur période": x.minutes / 60, "Part des ruptures réseau (%)": r.restaurants.reduce((s, x) => s + x.events, 0) ? x.events / r.restaurants.reduce((s, x) => s + x.events, 0) * 100 : 0, Observation: x.observed ? "Événements enregistrés" : "Aucun événement — couverture non certifiée" })));
  append("Produits", r.products.map(x => ({ Produit: x.name, "Ruptures cible": x.events, "Heures-produit cible": x.minutes / 60, "Restaurants concernés cible": x.restaurants, "Restaurants concernés réseau": x.networkRestaurants, "Part du périmètre réseau (%)": x.networkShare })));
  append("Évolution quotidienne", r.days.map(x => ({ Date: x.date, "Ruptures chevauchant le jour": x.events, "Heures-produit": x.minutes / 60 })));
  append("Journal chronologique", [...r.rows].sort((a, b) => a.from - b.from).map(x => ({ Restaurant: x.restaurant_name, Produit: x.product_name, Catégorie: x.category ?? "", "Référence Splash": x.item_id, "Début réel (Paris)": reportDate(x.started_at), "Fin réelle (Paris)": x.ended_at ? reportDate(x.ended_at) : "En cours", "Début compté (Paris)": reportDate(x.from), "Fin comptée (Paris)": reportDate(x.to), "Minutes dans la période": x.minutes, "Statut en fin de période": x.ended_at && Date.parse(x.ended_at) <= x.to ? "Résolue" : "Ouverte" })));
  XLSX.writeFile(wb, `${filename(r)}.xlsx`);
}

export async function exportStockoutPdf(r: StockoutReport, chainId: string) {
  const [{ jsPDF }, name, logo] = await Promise.all([import("jspdf"), getChainName(chainId), loadChainLogoBase64(chainId)]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const colors = { fg: tokenRgb("foreground"), muted: tokenRgb("muted-foreground"), bg: tokenRgb("background"), primary: tokenRgb("primary"), border: tokenRgb("border"), accent: tokenRgb("chart-2") };
  // Helvetica's PDF character set supports French accents, but not narrow nonbreaking spaces.
  const clean = (text: string) => text.replace(/[\u202f\u00a0]/g, " ").replace(/’/g, "'").replace(/—/g, "-");
  const text = (s: string, x: number, y: number, size = 10, bold = false, muted = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...(muted ? colors.muted : colors.fg)); doc.text(clean(s), x, y);
  };
  const paragraph = (s: string, y: number, width = 180, size = 9) => {
    doc.setFontSize(size); const lines = doc.splitTextToSize(clean(s), width) as string[];
    lines.forEach((line, i) => text(line, 15, y + i * 4.2, size, false, true));
    return y + lines.length * 4.2;
  };
  const header = (page: number) => {
    doc.setFillColor(...colors.bg); doc.rect(0, 0, 210, 297, "F");
    if (logo) { try { doc.addImage(logo, 15, 12, 13, 13); } catch { /* Chain name remains visible. */ } }
    text(name, logo ? 32 : 15, 17, 11, true);
    text("Ruptures & Disponibilité", logo ? 32 : 15, 23, 9, false, true);
    doc.setDrawColor(...colors.primary); doc.setLineWidth(0.8); doc.line(15, 30, 195, 30);
    text(`MIJOTEK  |  ${reportDate(r.generatedAt)}  |  ${page}/2`, 15, 288, 8, false, true);
  };
  header(1);
  text(r.restaurantId ? "Bilan restaurant" : "Bilan réseau", 15, 43, 22, true);
  let y = paragraph(`${targetName(r)} | ${r.start} au ${r.end}${r.product ? ` | ${r.product}` : ""}`, 51, 180, 10) + 5;
  const stats = [["Ruptures enregistrées", String(r.total.events)], ["Produits concernés", String(r.total.products)], ["Heures-produit", reportHours(r.total.minutes)]];
  stats.forEach(([label, value], i) => {
    const x = 15 + i * 61;
    doc.setDrawColor(...colors.border); doc.rect(x, y, 57, 25);
    text(label, x + 4, y + 7, 8, false, true); text(value, x + 4, y + 19, 19, true);
  });
  y += 36;
  text("Évolution des heures-produit", 15, y, 13, true); y += 7;
  const max = Math.max(1, ...r.days.map(d => d.minutes));
  const chartH = 34, chartW = 180;
  doc.setDrawColor(...colors.border); doc.line(15, y + chartH, 195, y + chartH);
  r.days.forEach((d, i) => {
    const width = chartW / Math.max(1, r.days.length), height = d.minutes / max * chartH;
    doc.setFillColor(...colors.primary); doc.rect(15 + i * width, y + chartH - height, Math.max(0.3, width * 0.75), height, "F");
  });
  text(reportHours(max), 15, y - 1, 8, false, true);
  text(r.start, 15, y + chartH + 5, 8, false, true); text(r.end, 173, y + chartH + 5, 8, false, true);
  y += chartH + 17;
  text("Comparatif des restaurants", 15, y, 13, true); y += 8;
  const ranking = r.restaurants.filter(x => x.observed).slice(0, 5);
  const rankMax = Math.max(1, ...ranking.map(x => x.minutes));
  ranking.forEach(x => {
    const label = doc.splitTextToSize(clean(x.name), 95) as string[];
    text(label[0] ?? x.name, 15, y, 9, x.id === r.restaurantId);
    doc.setFillColor(...colors.accent); doc.rect(113, y - 3, x.minutes / rankMax * 48, 3, "F");
    text(reportHours(x.minutes), 165, y, 9); y += 8;
  });
  y += 3;
  if (r.restaurantId && r.medianMinutes !== null) y = paragraph(`Restaurant : ${reportHours(r.total.minutes)} | Médiane des ${r.observedCount} restaurants avec événements : ${reportHours(r.medianMinutes)}. Comparaison descriptive, sans correction du catalogue ni des horaires.`, y);
  paragraph(`${r.observedCount}/${r.scopeCount} restaurants avec au moins une rupture enregistrée. Couverture encore partielle : absence d'événement ne signifie pas absence de rupture.`, y + 4);
  doc.addPage(); header(2);
  text("Produits & suivi opérationnel", 15, 44, 18, true);
  y = 55;
  text("Produits", 15, y, 9, true); text("Heures-produit", 116, y, 9, true); text("Restos réseau", 160, y, 9, true); y += 7;
  r.products.slice(0, 7).forEach(x => {
    const lines = doc.splitTextToSize(clean(x.name), 94) as string[];
    lines.forEach((line, i) => text(line, 15, y + i * 4.2, 9));
    text(reportHours(x.minutes), 116, y, 9); text(`${x.networkRestaurants}/${r.scopeCount} (${x.networkShare.toFixed(1)} %)`, 160, y, 9);
    y += Math.max(8, lines.length * 4.2 + 3);
  });
  if (r.products.length > 7) { text(`+ ${r.products.length - 7} produits dans le classeur Excel`, 15, y, 8, false, true); y += 6; }
  y += 6; text("Remise en stock", 15, y, 13, true); y += 8;
  y = paragraph(`${r.resolvedCount} ruptures résolues | Durée moyenne complète : ${r.resolvedAverage === null ? "non disponible" : reportHours(r.resolvedAverage)} | Moins de 3 h : ${r.quick} | Plus de 24 h : ${r.prolonged}`, y);
  y += 8; text("Points de suivi", 15, y, 13, true); y += 8;
  y = paragraph("Vérifier les références les plus longtemps désactivées ; confirmer les ruptures volontaires liées à un lancement ; contrôler la remise en stock et les correspondances de caisses avec le restaurant.", y);
  y += 8; text("Périmètre & méthode", 15, y, 12, true); y += 7;
  stockoutReportMethod.forEach(line => { y = paragraph(line, y, 180, 8) + 2; });
  doc.save(`${filename(r)}.pdf`);
}