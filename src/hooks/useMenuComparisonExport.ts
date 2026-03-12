import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import XLSX from "xlsx-js-style";

interface PriceRow {
  product: string;
  category: string;
  prices: { restaurant: string; price: string }[];
  difference: string;
}

interface ExportData {
  platform: string;
  restaurants: string[];
  rows: PriceRow[];
  stats: {
    totalProducts: number;
    productsWithDiff: number;
    avgDiff: number;
  };
}

const parsePrice = (priceStr: string): number | null => {
  if (!priceStr) return null;
  const lower = priceStr.toLowerCase().trim();
  if (lower === "-" || lower === "manquant" || lower.includes("manquant")) return null;
  if (lower === "gratuit" || lower.includes("gratuit")) return 0;
  const cleaned = priceStr.replace(/€/g, "").replace(/\s/g, "").replace(",", ".").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

// Style constants for Excel
const HEADER_STYLE = {
  fill: { fgColor: { rgb: "1E3A5F" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
  border: { bottom: { style: "thin" as const, color: { rgb: "000000" } } },
};

const TITLE_STYLE = {
  font: { bold: true, sz: 14, color: { rgb: "1E3A5F" } },
  alignment: { horizontal: "left" as const },
};

const DATE_STYLE = {
  font: { italic: true, sz: 10, color: { rgb: "666666" } },
};

const STATS_STYLE = {
  font: { sz: 10, color: { rgb: "333333" } },
  fill: { fgColor: { rgb: "F3F4F6" } },
};

const CELL_STYLE = {
  alignment: { horizontal: "left" as const, vertical: "center" as const },
  border: { bottom: { style: "thin" as const, color: { rgb: "E5E7EB" } } },
};

const PRICE_CELL_STYLE = {
  alignment: { horizontal: "right" as const, vertical: "center" as const },
  border: { bottom: { style: "thin" as const, color: { rgb: "E5E7EB" } } },
};

const BEST_PRICE_STYLE = {
  ...PRICE_CELL_STYLE,
  fill: { fgColor: { rgb: "DCFCE7" } },
};

const WORST_PRICE_STYLE = {
  ...PRICE_CELL_STYLE,
  fill: { fgColor: { rgb: "FEF3C7" } },
};

const MANQUANT_STYLE = {
  ...CELL_STYLE,
  font: { italic: true, color: { rgb: "9CA3AF" } },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
};

export function useMenuComparisonExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = useCallback(async (
    _contentRef: HTMLElement | null,
    data: ExportData
  ) => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const numR = data.restaurants.length;
      const showDiff = numR === 2;

      const availableWidth = pageWidth - margin * 2;
      let colWidths: number[];
      let headers: string[];

      if (showDiff) {
        colWidths = [90, 50, 35, 35, 25, 25];
        headers = ["Produit", "Catégorie", data.restaurants[0], data.restaurants[1], "Écart %", "Écart €"];
      } else {
        const productW = Math.min(80, availableWidth * 0.3);
        const catW = Math.min(40, availableWidth * 0.15);
        const priceW = Math.min(35, (availableWidth - productW - catW) / numR);
        colWidths = [productW, catW, ...Array(numR).fill(priceW)];
        headers = ["Produit", "Catégorie", ...data.restaurants.map(r => r.length > 12 ? r.substring(0, 10) + "…" : r)];
      }

      const rowH = 6;
      const headerH = 8;
      let currentY = 0;
      let currentPage = 1;

      const drawHeader = () => {
        pdf.setFillColor(16, 185, 129);
        pdf.rect(0, 0, pageWidth, 18, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Comparaison des prix", margin, 8);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Plateforme: ${data.platform}`, margin, 14);

        pdf.setFillColor(249, 250, 251);
        pdf.rect(0, 18, pageWidth, 10, "F");
        pdf.setTextColor(107, 114, 128);
        pdf.setFontSize(8);
        pdf.text(`Restaurants: ${data.restaurants.join(", ")}`, margin, 24);
        const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
        pdf.text(`Généré le ${dateStr}`, pageWidth - margin - pdf.getTextWidth(`Généré le ${dateStr}`), 24);

        pdf.setFontSize(8);
        pdf.setTextColor(75, 85, 99);
        pdf.text(`${data.stats.totalProducts} produits | ${data.stats.productsWithDiff} avec écarts | Écart moyen: ${data.stats.avgDiff.toFixed(1)}%`, margin, 32);
        return 36;
      };

      const drawTableHeader = (y: number) => {
        const totalW = colWidths.reduce((a, b) => a + b, 0);
        pdf.setFillColor(30, 58, 95);
        pdf.rect(margin, y, totalW, headerH, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        let x = margin + 2;
        headers.forEach((h, i) => {
          if (i >= 2) {
            pdf.text(h, x + colWidths[i] - 4, y + 5.5, { align: "right" });
          } else {
            pdf.text(h, x, y + 5.5);
          }
          x += colWidths[i];
        });
        return y + headerH;
      };

      const drawFooter = (pageNum: number, totalPages: number) => {
        pdf.setFontSize(7);
        pdf.setTextColor(156, 163, 175);
        pdf.text("CS Delivery - Comparaison des prix", margin, pageHeight - 4);
        pdf.text(`Page ${pageNum}/${totalPages}`, pageWidth - margin - 15, pageHeight - 4);
      };

      const rowsPerPage = Math.floor((pageHeight - 36 - headerH - 15) / rowH);
      const totalPages = Math.ceil(data.rows.length / rowsPerPage);

      currentY = drawHeader();
      currentY = drawTableHeader(currentY);

      data.rows.forEach((row, idx) => {
        if (currentY + rowH > pageHeight - 12) {
          drawFooter(currentPage, totalPages);
          pdf.addPage();
          currentPage++;
          currentY = drawHeader();
          currentY = drawTableHeader(currentY);
        }

        const parsedPrices = row.prices.map(p => parsePrice(p.price));
        const validPrices = parsedPrices.filter(p => p !== null) as number[];
        const minP = validPrices.length > 0 ? Math.min(...validPrices) : null;
        const maxP = validPrices.length > 0 ? Math.max(...validPrices) : null;

        if (idx % 2 === 0) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, currentY, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        let x = margin + 2;

        // Product
        pdf.setTextColor(31, 41, 55);
        let pName = row.product;
        while (pdf.getTextWidth(pName) > colWidths[0] - 6 && pName.length > 3) pName = pName.slice(0, -1);
        if (pName !== row.product) pName += "…";
        pdf.text(pName, x, currentY + 4);
        x += colWidths[0];

        // Category
        pdf.setTextColor(107, 114, 128);
        let cat = row.category;
        while (pdf.getTextWidth(cat) > colWidths[1] - 6 && cat.length > 3) cat = cat.slice(0, -1);
        if (cat !== row.category) cat += "…";
        pdf.text(cat, x, currentY + 4);
        x += colWidths[1];

        // Prices
        parsedPrices.forEach((price, pi) => {
          const cw = colWidths[2 + pi] || 35;
          if (price !== null) {
            if (validPrices.length > 1 && price === minP && minP !== maxP) {
              pdf.setFillColor(220, 252, 231);
              pdf.rect(x - 2, currentY, cw, rowH, "F");
            } else if (validPrices.length > 1 && price === maxP && minP !== maxP) {
              pdf.setFillColor(254, 243, 199);
              pdf.rect(x - 2, currentY, cw, rowH, "F");
            }
            pdf.setTextColor(31, 41, 55);
            pdf.text(`${price.toFixed(2)} €`, x + cw - 4, currentY + 4, { align: "right" });
          } else {
            pdf.setTextColor(156, 163, 175);
            pdf.setFont("helvetica", "italic");
            pdf.text("-", x + cw - 4, currentY + 4, { align: "right" });
            pdf.setFont("helvetica", "normal");
          }
          x += cw;
        });

        // Diff columns (only 2 restaurants)
        if (showDiff) {
          const p1 = parsedPrices[0], p2 = parsedPrices[1];
          if (p1 !== null && p2 !== null) {
            const diffP = ((p2 - p1) / p1) * 100;
            const diffE = p2 - p1;
            pdf.setTextColor(diffP > 0 ? 239 : diffP < 0 ? 34 : 107, diffP > 0 ? 68 : diffP < 0 ? 197 : 114, diffP > 0 ? 68 : diffP < 0 ? 94 : 128);
            pdf.text(`${diffP >= 0 ? "+" : ""}${diffP.toFixed(1)}%`, x + colWidths[4] - 4, currentY + 4, { align: "right" });
            x += colWidths[4];
            pdf.text(`${diffE >= 0 ? "+" : ""}${diffE.toFixed(2)} €`, x + colWidths[5] - 4, currentY + 4, { align: "right" });
          }
        }

        currentY += rowH;
      });

      drawFooter(currentPage, totalPages);
      pdf.save(`comparaison_prix_${data.platform}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportToExcel = useCallback((data: ExportData) => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const numR = data.restaurants.length;
      const showDiff = numR === 2;
      const dateStr = new Date().toLocaleString("fr-FR");
      const title = `Comparatif ${data.restaurants.join(" - ")} (${data.platform})`;

      const headers: string[] = ["Produit", "Catégorie", ...data.restaurants];
      if (showDiff) headers.push("Écart %", "Écart €");

      const aoa: (string | number | null)[][] = [];
      aoa.push([title, ...Array(headers.length - 1).fill(null)]);
      aoa.push([`Généré le ${dateStr}`, ...Array(headers.length - 1).fill(null)]);
      aoa.push(Array(headers.length).fill(null));
      aoa.push([
        `${data.stats.totalProducts} produits`,
        `${data.stats.productsWithDiff} avec écarts`,
        `Écart moyen: ${data.stats.avgDiff.toFixed(1)}%`,
        ...Array(Math.max(0, headers.length - 3)).fill(null),
      ]);
      aoa.push(Array(headers.length).fill(null));
      aoa.push(headers);

      data.rows.forEach((row) => {
        const parsedPrices = row.prices.map(p => parsePrice(p.price));
        const rowData: (string | number | null)[] = [row.product, row.category];
        parsedPrices.forEach(p => rowData.push(p !== null ? p : "Manquant"));
        if (showDiff) { rowData.push(null); rowData.push(null); }
        aoa.push(rowData);
      });

      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      const dataStartRow = 7;

      // Styles
      if (sheet["A1"]) sheet["A1"].s = TITLE_STYLE;
      if (sheet["A2"]) sheet["A2"].s = DATE_STYLE;
      ["A4", "B4", "C4"].forEach(ref => { if (sheet[ref]) sheet[ref].s = STATS_STYLE; });

      headers.forEach((_, ci) => {
        const ref = `${XLSX.utils.encode_col(ci)}6`;
        if (sheet[ref]) sheet[ref].s = HEADER_STYLE;
      });

      data.rows.forEach((row, idx) => {
        const excelRow = dataStartRow + idx;
        const parsedPrices = row.prices.map(p => parsePrice(p.price));
        const validPrices = parsedPrices.filter(p => p !== null) as number[];
        const minP = validPrices.length > 0 ? Math.min(...validPrices) : null;
        const maxP = validPrices.length > 0 ? Math.max(...validPrices) : null;

        // Product & category
        const cellA = `A${excelRow}`;
        if (sheet[cellA]) sheet[cellA].s = CELL_STYLE;
        const cellB = `B${excelRow}`;
        if (sheet[cellB]) sheet[cellB].s = CELL_STYLE;

        // Price columns
        parsedPrices.forEach((price, pi) => {
          const col = XLSX.utils.encode_col(2 + pi);
          const ref = `${col}${excelRow}`;
          if (!sheet[ref]) return;
          if (price === null) {
            sheet[ref].s = MANQUANT_STYLE;
          } else {
            sheet[ref].z = '#,##0.00" €"';
            if (validPrices.length > 1 && price === maxP && minP !== maxP) {
              sheet[ref].s = WORST_PRICE_STYLE;
            } else if (validPrices.length > 1 && price === minP && minP !== maxP) {
              sheet[ref].s = BEST_PRICE_STYLE;
            } else {
              sheet[ref].s = PRICE_CELL_STYLE;
            }
          }
        });

        // Diff formulas (only 2 restaurants)
        if (showDiff && parsedPrices[0] !== null && parsedPrices[1] !== null) {
          const eCol = XLSX.utils.encode_col(2 + numR);
          const fCol = XLSX.utils.encode_col(3 + numR);
          sheet[`${eCol}${excelRow}`] = {
            t: "n", f: `IF(C${excelRow}=0,0,(D${excelRow}-C${excelRow})/C${excelRow})`,
            z: "0.0%", s: PRICE_CELL_STYLE,
          };
          sheet[`${fCol}${excelRow}`] = {
            t: "n", f: `D${excelRow}-C${excelRow}`,
            z: '#,##0.00" €"', s: PRICE_CELL_STYLE,
          };
        }
      });

      // Column widths
      sheet["!cols"] = [
        { wch: 42 },
        { wch: 18 },
        ...Array(numR).fill({ wch: 14 }),
        ...(showDiff ? [{ wch: 10 }, { wch: 10 }] : []),
      ];

      sheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      ];

      const lastRow = dataStartRow - 1 + data.rows.length;
      sheet["!ref"] = `A1:${XLSX.utils.encode_col(headers.length - 1)}${lastRow}`;

      XLSX.utils.book_append_sheet(wb, sheet, "Comparatif");
      const filename = `comparatif_${data.restaurants.join("_").toLowerCase().replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error("Error exporting Excel:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportToCsv = useCallback((data: ExportData) => {
    setIsExporting(true);
    try {
      const numR = data.restaurants.length;
      const showDiff = numR === 2;
      const headers = ["Produit", "Catégorie", ...data.restaurants];
      if (showDiff) headers.push("Écart %", "Écart €");

      const csvRows: string[] = [headers.map(h => `"${h}"`).join(";")];

      data.rows.forEach((row) => {
        const parsedPrices = row.prices.map(p => parsePrice(p.price));
        const values: string[] = [
          `"${row.product.replace(/"/g, '""')}"`,
          `"${row.category.replace(/"/g, '""')}"`,
        ];
        parsedPrices.forEach(p => {
          values.push(p !== null ? `"${p.toFixed(2).replace(".", ",")}"` : `""`);
        });
        if (showDiff && parsedPrices[0] !== null && parsedPrices[1] !== null) {
          const diffP = ((parsedPrices[1]! - parsedPrices[0]!) / parsedPrices[0]!) * 100;
          const diffE = parsedPrices[1]! - parsedPrices[0]!;
          values.push(`"${diffP.toFixed(1).replace(".", ",")}%"`);
          values.push(`"${diffE.toFixed(2).replace(".", ",")} €"`);
        } else if (showDiff) {
          values.push(`""`, `""`);
        }
        csvRows.push(values.join(";"));
      });

      const csv = csvRows.join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comparatif_${data.restaurants.join("_").toLowerCase().replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToPdf, exportToExcel, exportToCsv, isExporting };
}
