import { useCallback } from "react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

interface EcoRestaurantRow {
  restaurant_id: string;
  name: string;
  refund: number;
  charge: number;
  net: number;
  count: number;
}

interface MonthlyRow {
  year: number;
  month: number;
  refund: number;
  charge: number;
  net: number;
  count: number;
}

interface ExportParams {
  restaurants: EcoRestaurantRow[];
  monthlyData: MonthlyRow[];
  totals: { refund: number; charge: number; net: number; lineCount: number };
  yearLabel: string;
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const fmt = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export function useEcoContributionExport() {
  const exportExcel = useCallback(({ restaurants, monthlyData, totals, yearLabel }: ExportParams) => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Par restaurant
    const restoRows = restaurants.map(r => ({
      Restaurant: r.name,
      "Remboursements (€)": r.refund,
      "Prélèvements (€)": r.charge,
      "Solde net (€)": r.net,
      Lignes: r.count,
    }));
    restoRows.push({
      Restaurant: "TOTAL",
      "Remboursements (€)": totals.refund,
      "Prélèvements (€)": totals.charge,
      "Solde net (€)": totals.net,
      Lignes: totals.lineCount,
    });
    const ws1 = XLSX.utils.json_to_sheet(restoRows);
    ws1["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Par restaurant");

    // Sheet 2: Évolution mensuelle
    const monthRows = monthlyData.map(d => ({
      Mois: `${MONTHS[d.month - 1]} ${d.year}`,
      "Remboursements (€)": d.refund,
      "Prélèvements (€)": d.charge,
      "Solde net (€)": d.net,
    }));
    const ws2 = XLSX.utils.json_to_sheet(monthRows);
    ws2["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Mensuel");

    XLSX.writeFile(wb, `eco-contribution_${yearLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, []);

  const exportPDF = useCallback(({ restaurants, monthlyData, totals, yearLabel }: ExportParams) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Éco-Contribution", margin, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Période : ${yearLabel} · Export du ${new Date().toLocaleDateString("fr-FR")}`, margin, 26);

    // KPIs
    let y = 34;
    doc.setFillColor(240, 253, 244);
    doc.rect(margin, y, 55, 14, "F");
    doc.setFillColor(254, 242, 242);
    doc.rect(margin + 58, y, 55, 14, "F");
    doc.setFillColor(248, 250, 252);
    doc.rect(margin + 116, y, 55, 14, "F");

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Remboursements", margin + 3, y + 5);
    doc.text("Prélèvements", margin + 61, y + 5);
    doc.text("Solde Net", margin + 119, y + 5);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text(fmt(totals.refund), margin + 3, y + 11);
    doc.setTextColor(239, 68, 68);
    doc.text(fmt(totals.charge), margin + 61, y + 11);
    doc.setTextColor(totals.net >= 0 ? 22 : 239, totals.net >= 0 ? 163 : 68, totals.net >= 0 ? 74 : 68);
    doc.text(fmt(totals.net), margin + 119, y + 11);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    // Table
    y = 56;
    const colWidths = [70, 30, 30, 30, 22];
    const headers = ["Restaurant", "Remb.", "Prél.", "Solde", "Lignes"];
    const headerH = 7;
    const rowH = 6;

    const drawHeader = () => {
      doc.setFillColor(16, 185, 129);
      doc.rect(margin, y, pageW - margin * 2, headerH, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      let x = margin + 2;
      headers.forEach((h, i) => {
        if (i >= 1) {
          doc.text(h, x + colWidths[i] - 3, y + 5, { align: "right" });
        } else {
          doc.text(h, x, y + 5);
        }
        x += colWidths[i];
      });
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      y += headerH;
    };

    drawHeader();

    restaurants.forEach((r, idx) => {
      if (y + rowH > pageH - 12) {
        doc.addPage();
        y = margin;
        drawHeader();
      }

      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageW - margin * 2, rowH, "F");
      }

      let x = margin + 2;
      // Name
      const maxNameW = colWidths[0] - 4;
      const nameStr = doc.getTextWidth(r.name) > maxNameW
        ? r.name.substring(0, Math.floor(r.name.length * maxNameW / doc.getTextWidth(r.name))) + "…"
        : r.name;
      doc.text(nameStr, x, y + 4.2);
      x += colWidths[0];

      // Values
      const vals = [fmt(r.refund), fmt(r.charge), fmt(r.net), String(r.count)];
      vals.forEach((v, i) => {
        if (i === 0) doc.setTextColor(22, 163, 74);
        else if (i === 1) doc.setTextColor(239, 68, 68);
        else if (i === 2) doc.setTextColor(r.net >= 0 ? 22 : 239, r.net >= 0 ? 163 : 68, r.net >= 0 ? 74 : 68);
        else doc.setTextColor(100, 100, 100);
        doc.text(v, x + colWidths[i + 1] - 3, y + 4.2, { align: "right" });
        x += colWidths[i + 1];
      });

      doc.setTextColor(0, 0, 0);
      y += rowH;
    });

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`CS Delivery Performance - Page ${p}/${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
    }

    doc.save(`eco-contribution_${yearLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, []);

  return { exportPDF, exportExcel };
}
