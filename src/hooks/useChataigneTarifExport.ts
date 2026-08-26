import { useCallback } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import type { MarkupRow, PriceAlertRow } from "@/hooks/useChataigneTarification";

const today = () => new Date().toISOString().slice(0, 10);
const eur = (v: number) => (v ?? 0).toFixed(2).replace(".", ",") + " €";
const pct = (v: number) => `${v > 0 ? "+" : ""}${(v ?? 0).toFixed(1)} %`;

export interface MarkupStore {
  id: string;
  name: string | null;
  avg: number;
  items: MarkupRow[];
}

export function useChataigneTarifExport() {
  const exportAlertsXlsx = useCallback((rows: PriceAlertRow[]) => {
    const data = rows.map((r) => ({
      Restaurant: r.restaurant_name ?? "—",
      Version: r.version ?? "À affecter",
      Produit: r.item_name,
      "Prix emport observé": Number(r.prix_emport_observe.toFixed(2)),
      "Prix grille": Number(r.prix_grille.toFixed(2)),
      Écart: Number(r.ecart.toFixed(2)),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 34 }, { wch: 12 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Écarts prix");
    XLSX.writeFile(wb, `chataigne_ecarts_prix_${today()}.xlsx`);
  }, []);

  const exportMarkupXlsx = useCallback((stores: MarkupStore[]) => {
    const wb = XLSX.utils.book_new();

    const summary = stores.map((s) => ({
      Restaurant: s.name ?? "—",
      "Produits comparés": s.items.length,
      "Markup moyen (%)": Number(s.avg.toFixed(1)),
    }));
    const wsS = XLSX.utils.json_to_sheet(summary);
    wsS["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsS, "Synthèse");

    const detail = stores.flatMap((s) =>
      s.items.map((it) => ({
        Restaurant: s.name ?? "—",
        Produit: it.item_name,
        "Prix emport": Number(it.prix_emport.toFixed(2)),
        "Prix livraison": Number(it.prix_livraison.toFixed(2)),
        "Markup (%)": Number(it.markup_pct.toFixed(1)),
        "Nb livraison": it.nb_livraison,
      }))
    );
    const wsD = XLSX.utils.json_to_sheet(detail);
    wsD["!cols"] = [{ wch: 34 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsD, "Détail produits");

    XLSX.writeFile(wb, `chataigne_markup_${today()}.xlsx`);
  }, []);

  const exportPdf = useCallback(
    (opts: { alerts: PriceAlertRow[]; stores: MarkupStore[]; scopeLabel: string }) => {
      const { alerts, stores, scopeLabel } = opts;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      let y = 18;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Chataigne — Écarts & Markup", margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${scopeLabel} — Export du ${new Date().toLocaleDateString("fr-FR")}`,
        margin,
        y
      );
      y += 8;

      const table = (
        title: string,
        headers: string[],
        widths: number[],
        rows: string[][],
        aligns: ("left" | "right")[]
      ) => {
        const rowH = 6.5;
        const headerH = 7.5;

        const drawTitle = () => {
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(title, margin, y);
          y += 5;
        };
        const drawHeader = () => {
          doc.setFillColor(16, 185, 129);
          doc.rect(margin, y, pageW - margin * 2, headerH, "F");
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(255, 255, 255);
          let x = margin + 2;
          headers.forEach((h, i) => {
            const right = aligns[i] === "right";
            doc.text(h, right ? x + widths[i] - 4 : x, y + 5, right ? { align: "right" } : undefined);
            x += widths[i];
          });
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          y += headerH;
        };

        if (y + 30 > pageH - 12) {
          doc.addPage();
          y = 16;
        }
        drawTitle();
        drawHeader();

        rows.forEach((row, idx) => {
          if (y + rowH > pageH - 12) {
            doc.addPage();
            y = 16;
            drawHeader();
          }
          if (idx % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y, pageW - margin * 2, rowH, "F");
          }
          let x = margin + 2;
          row.forEach((val, i) => {
            const maxW = widths[i] - 4;
            let text = val ?? "";
            if (doc.getTextWidth(text) > maxW) {
              text =
                text.substring(0, Math.max(1, Math.floor((text.length * maxW) / doc.getTextWidth(text)))) +
                "…";
            }
            const right = aligns[i] === "right";
            doc.text(text, right ? x + widths[i] - 4 : x, y + 4.5, right ? { align: "right" } : undefined);
            x += widths[i];
          });
          y += rowH;
        });
        y += 8;
      };

      table(
        "Écarts de prix EMPORT vs grille",
        ["Restaurant", "Version", "Produit", "Prix emport observé", "Prix grille", "Écart"],
        [70, 24, 64, 40, 34, 30],
        alerts.map((r) => [
          r.restaurant_name ?? "—",
          r.version ?? "À affecter",
          r.item_name,
          eur(r.prix_emport_observe),
          eur(r.prix_grille),
          `${r.ecart > 0 ? "+" : ""}${eur(r.ecart)}`,
        ]),
        ["left", "left", "left", "right", "right", "right"]
      );

      table(
        "Markup livraison par point de vente",
        ["Restaurant", "Produits comparés", "Markup moyen"],
        [120, 70, 70],
        stores.map((s) => [s.name ?? "—", String(s.items.length), pct(s.avg)]),
        ["left", "right", "right"]
      );

      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `CS Delivery Performance — Page ${p}/${totalPages}`,
          pageW - margin,
          pageH - 6,
          { align: "right" }
        );
      }

      doc.save(`chataigne_tarification_${today()}.pdf`);
    },
    []
  );

  return { exportAlertsXlsx, exportMarkupXlsx, exportPdf };
}
