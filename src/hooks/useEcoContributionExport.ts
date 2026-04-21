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

interface DetailLine {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  payout_reference_id: string | null;
  payout_date: string | null;
  description: string | null;
  amount: number;
  platform?: "uber_eats" | "deliveroo";
}

interface RepEntry {
  filiere: string;
  org: string;
  start: string;
  end: string | null;
  isActive: boolean;
  idu?: string;
}

interface RepInfo {
  status: string;
  orgs: string[];
  entries: RepEntry[];
}

interface ExportParams {
  restaurants: EcoRestaurantRow[];
  monthlyData: MonthlyRow[];
  totals: { refund: number; charge: number; net: number; lineCount: number };
  yearLabel: string;
  detailLines?: DetailLine[];
  repByRestaurant?: Map<string, RepInfo>;
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const fmt = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "";

export function useEcoContributionExport() {
  const exportExcel = useCallback(({ restaurants, monthlyData, totals, yearLabel, detailLines, repByRestaurant }: ExportParams) => {
    const wb = XLSX.utils.book_new();

    // Build REP info lookup
    const getRepSummary = (restaurantId: string) => {
      if (!repByRestaurant) return { status: "", idus: "", orgs: "", details: "" };
      const rep = repByRestaurant.get(restaurantId);
      if (!rep || rep.status === "unchecked") return { status: "", idus: "", orgs: "", details: "" };
      
      const status = rep.status === "inscrit" ? "Inscrit" : rep.status === "non_trouve" ? "Non trouvé" : rep.status === "sans_siret" ? "Sans SIRET" : rep.status;
      const idus = rep.entries.filter(e => e.idu).map(e => `IDU ${e.filiere} : ${e.idu}`).join(" | ");
      const orgs = rep.orgs.join(", ");
      const details = rep.entries.map(e => {
        const endLabel = e.end ? fmtDate(e.end) : "En cours";
        return `${e.filiere}·${e.idu || "—"}·${e.org}·du ${e.start} au ${endLabel}`;
      }).join(" | ");
      
      return { status, idus, orgs, details };
    };

    // Sheet 1: Par restaurant (with REP columns if available)
    const hasRep = repByRestaurant && repByRestaurant.size > 0;
    const restoRows = restaurants.map(r => {
      const rep = getRepSummary(r.restaurant_id);
      const base: Record<string, string | number> = {
        Restaurant: r.name,
        "Remboursements (€)": r.refund,
        "Prélèvements (€)": r.charge,
        "Solde net (€)": r.net,
        Lignes: r.count,
      };
      if (hasRep) {
        base["Statut REP"] = rep.status;
        base["IDU"] = rep.idus;
        base["Éco-organismes"] = rep.orgs;
        base["Détail filières"] = rep.details;
      }
      return base;
    });
    restoRows.push({
      Restaurant: "TOTAL",
      "Remboursements (€)": totals.refund,
      "Prélèvements (€)": totals.charge,
      "Solde net (€)": totals.net,
      Lignes: totals.lineCount,
      ...(hasRep ? { "Statut REP": "", "IDU": "", "Éco-organismes": "", "Détail filières": "" } : {}),
    });
    const ws1 = XLSX.utils.json_to_sheet(restoRows);
    ws1["!cols"] = hasRep
      ? [{ wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 30 }, { wch: 25 }, { wch: 60 }]
      : [{ wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
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

    // Sheet 3: Détail des lignes
    if (detailLines && detailLines.length > 0) {
      const restaurantNameMap = new Map<string, string>();
      restaurants.forEach(r => restaurantNameMap.set(r.restaurant_id, r.name));

      const detailRows = detailLines
        .sort((a, b) => {
          const nameA = restaurantNameMap.get(a.restaurant_id) || "";
          const nameB = restaurantNameMap.get(b.restaurant_id) || "";
          const cmp = nameA.localeCompare(nameB);
          if (cmp !== 0) return cmp;
          return (a.payout_date || "").localeCompare(b.payout_date || "");
        })
        .map(l => ({
          Restaurant: restaurantNameMap.get(l.restaurant_id) || l.restaurant_name || l.restaurant_id.slice(0, 8),
          Date: fmtDate(l.payout_date),
          Plateforme: l.platform === "deliveroo" ? "Deliveroo" : "Uber Eats",
          Description: l.description || "",
          "Référence versement": l.payout_reference_id || "",
          "Montant (€)": l.amount,
        }));
      const ws3 = XLSX.utils.json_to_sheet(detailRows);
      ws3["!cols"] = [{ wch: 40 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 24 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Détail lignes");
    }

    XLSX.writeFile(wb, `eco-contribution_${yearLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, []);

  const exportPDF = useCallback(({ restaurants, monthlyData, totals, yearLabel, repByRestaurant }: ExportParams) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const hasRep = repByRestaurant && repByRestaurant.size > 0;
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

    // Table — adapt columns based on whether REP data is available
    y = 56;
    const colWidths = hasRep
      ? [55, 22, 22, 22, 14, 50, 65] // Restaurant, Remb, Prél, Solde, Lignes, IDU, Adhésions
      : [70, 30, 30, 30, 22];
    const headers = hasRep
      ? ["Restaurant", "Remb.", "Prél.", "Solde", "Lignes", "IDU", "Adhésions"]
      : ["Restaurant", "Remb.", "Prél.", "Solde", "Lignes"];
    const headerH = 7;
    const rowH = hasRep ? 8 : 6;

    const drawHeader = () => {
      doc.setFillColor(16, 185, 129);
      doc.rect(margin, y, pageW - margin * 2, headerH, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      let x = margin + 2;
      headers.forEach((h, i) => {
        const isNumeric = i >= 1 && i <= 4;
        if (isNumeric) {
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

      // Numeric values
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

      // REP columns: IDU + Adhésions (filière + dates)
      if (hasRep) {
        const rep = repByRestaurant!.get(r.restaurant_id);
        const idus = rep?.entries
          .filter(e => e.idu)
          .map(e => `${e.filiere}: ${e.idu}`)
          .join(" | ") || (rep?.status === "inscrit" ? "Adh. annuelle" : "—");
        const adhesions = rep?.entries
          .map(e => `${e.filiere} (${e.start} → ${e.end ? fmtDate(e.end) : "en cours"})`)
          .join(" | ") || "—";

        const truncate = (s: string, w: number) => {
          const maxW = w - 3;
          if (doc.getTextWidth(s) <= maxW) return s;
          return s.substring(0, Math.floor(s.length * maxW / doc.getTextWidth(s))) + "…";
        };

        doc.setFontSize(6);
        doc.text(truncate(idus, colWidths[5]), x, y + 4.2);
        x += colWidths[5];
        doc.text(truncate(adhesions, colWidths[6]), x, y + 4.2);
        doc.setFontSize(6.5);
      }

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
