import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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

// Style constants
const HEADER_STYLE = {
  fill: { fgColor: { rgb: "1E3A5F" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  alignment: { horizontal: "center", vertical: "center" },
  border: {
    bottom: { style: "thin", color: { rgb: "000000" } },
  },
};

const TITLE_STYLE = {
  font: { bold: true, sz: 14, color: { rgb: "1E3A5F" } },
  alignment: { horizontal: "left" },
};

const DATE_STYLE = {
  font: { italic: true, sz: 10, color: { rgb: "666666" } },
};

const STATS_STYLE = {
  font: { sz: 10, color: { rgb: "333333" } },
  fill: { fgColor: { rgb: "F3F4F6" } },
};

const CELL_STYLE = {
  alignment: { horizontal: "left", vertical: "center" },
  border: {
    bottom: { style: "thin", color: { rgb: "E5E7EB" } },
  },
};

const PRICE_CELL_STYLE = {
  alignment: { horizontal: "right", vertical: "center" },
  border: {
    bottom: { style: "thin", color: { rgb: "E5E7EB" } },
  },
};

const HIGHER_PRICE_STYLE = {
  ...PRICE_CELL_STYLE,
  fill: { fgColor: { rgb: "DCFCE7" } }, // Light green
};

const MANQUANT_STYLE = {
  ...CELL_STYLE,
  font: { italic: true, color: { rgb: "9CA3AF" } },
  alignment: { horizontal: "center", vertical: "center" },
};

export function useMenuComparisonExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = useCallback(async (
    contentRef: HTMLElement | null,
    data: ExportData
  ) => {
    if (!contentRef) return;

    setIsExporting(true);

    try {
      const canvas = await html2canvas(contentRef, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Header
      pdf.setFillColor(16, 185, 129);
      pdf.rect(0, 0, pageWidth, 25, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Comparaison des prix", margin, 12);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Plateforme: ${data.platform}`, margin, 19);

      // Meta info
      pdf.setFillColor(249, 250, 251);
      pdf.rect(0, 25, pageWidth, 12, "F");
      
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(9);
      pdf.text(`Restaurants: ${data.restaurants.join(", ")}`, margin, 32);
      
      const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      pdf.text(`Généré le ${dateStr}`, pageWidth - margin - pdf.getTextWidth(`Généré le ${dateStr}`), 32);

      // Content
      const contentY = 42;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - contentY - margin;
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;

      const xOffset = margin + (contentWidth - scaledWidth) / 2;
      
      pdf.addImage(imgData, "PNG", xOffset, contentY, scaledWidth, scaledHeight);

      // Footer
      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
      
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("CS Delivery - Comparaison des prix", margin, pageHeight - 4);
      pdf.text("Page 1/1", pageWidth - margin - pdf.getTextWidth("Page 1/1"), pageHeight - 4);

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
      const workbook = XLSX.utils.book_new();

      // Build title
      const title = `Comparatif ${data.restaurants.join(" - ")} (${data.platform})`;
      const dateStr = new Date().toLocaleString("fr-FR");

      // Helper to parse price
      const parsePrice = (priceStr: string): number | null => {
        if (!priceStr) return null;
        const lower = priceStr.toLowerCase().trim();
        if (lower === "-" || lower === "manquant" || lower.includes("manquant")) {
          return null;
        }
        const cleaned = priceStr.replace(/€/g, "").replace(/\s/g, "").replace(",", ".").trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      };

      // Build sheet data
      const showDiff = data.restaurants.length === 2;
      const headers: string[] = ["Produit", "Catégorie", ...data.restaurants];
      if (showDiff) {
        headers.push("Écart %");
        headers.push("Écart €");
      }

      // Create worksheet with AOA
      const aoa: (string | number | null)[][] = [];
      
      // Row 1: Title
      aoa.push([title, ...Array(headers.length - 1).fill(null)]);
      // Row 2: Date
      aoa.push([`Généré le ${dateStr}`, ...Array(headers.length - 1).fill(null)]);
      // Row 3: Empty
      aoa.push(Array(headers.length).fill(null));
      // Row 4: Stats
      aoa.push([
        `${data.stats.totalProducts} produits`,
        `${data.stats.productsWithDiff} avec écarts`,
        `Écart moyen: ${data.stats.avgDiff}%`,
        ...Array(Math.max(0, headers.length - 3)).fill(null)
      ]);
      // Row 5: Empty
      aoa.push(Array(headers.length).fill(null));
      // Row 6: Headers
      aoa.push(headers);

      // Track price data for styling
      const rowPriceData: { price1: number | null; price2: number | null }[] = [];

      // Data rows (starting row 7)
      data.rows.forEach((row) => {
        const parsedPrices = row.prices.map(p => parsePrice(p.price));
        const price1 = parsedPrices[0] ?? null;
        const price2 = parsedPrices[1] ?? null;
        rowPriceData.push({ price1, price2 });

        const rowData: (string | number | null)[] = [
          row.product,
          row.category,
          price1 !== null ? price1 : "Manquant",
          price2 !== null ? price2 : "Manquant",
        ];
        
        if (showDiff) {
          rowData.push(null);
          rowData.push(null);
        }
        aoa.push(rowData);
      });

      const sheet = XLSX.utils.aoa_to_sheet(aoa);

      // Apply styles
      const dataStartRow = 7;

      // Style title (A1)
      if (sheet["A1"]) sheet["A1"].s = TITLE_STYLE;
      // Style date (A2)
      if (sheet["A2"]) sheet["A2"].s = DATE_STYLE;
      // Style stats row (row 4)
      ["A4", "B4", "C4"].forEach(ref => {
        if (sheet[ref]) sheet[ref].s = STATS_STYLE;
      });

      // Style headers (row 6)
      headers.forEach((_, colIdx) => {
        const colLetter = XLSX.utils.encode_col(colIdx);
        const ref = `${colLetter}6`;
        if (sheet[ref]) {
          sheet[ref].s = HEADER_STYLE;
        }
      });

      // Style data rows and add formulas
      data.rows.forEach((_, idx) => {
        const excelRow = dataStartRow + idx;
        const { price1, price2 } = rowPriceData[idx];
        const bothValid = price1 !== null && price2 !== null;

        // Column A (Product)
        const cellA = `A${excelRow}`;
        if (sheet[cellA]) sheet[cellA].s = CELL_STYLE;

        // Column B (Category)
        const cellB = `B${excelRow}`;
        if (sheet[cellB]) sheet[cellB].s = CELL_STYLE;

        // Column C (Price 1)
        const cellC = `C${excelRow}`;
        if (sheet[cellC]) {
          if (price1 === null) {
            sheet[cellC].s = MANQUANT_STYLE;
          } else {
            sheet[cellC].z = '#,##0.00" €"';
            // Highlight if higher than price2
            if (bothValid && price1 > price2) {
              sheet[cellC].s = HIGHER_PRICE_STYLE;
            } else {
              sheet[cellC].s = PRICE_CELL_STYLE;
            }
          }
        }

        // Column D (Price 2)
        const cellD = `D${excelRow}`;
        if (sheet[cellD]) {
          if (price2 === null) {
            sheet[cellD].s = MANQUANT_STYLE;
          } else {
            sheet[cellD].z = '#,##0.00" €"';
            // Highlight if higher than price1
            if (bothValid && price2 > price1) {
              sheet[cellD].s = HIGHER_PRICE_STYLE;
            } else {
              sheet[cellD].s = PRICE_CELL_STYLE;
            }
          }
        }

        // Add formulas only if both prices valid
        if (showDiff && bothValid) {
          // Écart % (Column E)
          sheet[`E${excelRow}`] = {
            t: "n",
            f: `IF(C${excelRow}=0,0,(D${excelRow}-C${excelRow})/C${excelRow})`,
            z: "0.0%",
            s: PRICE_CELL_STYLE,
          };

          // Écart € (Column F)
          sheet[`F${excelRow}`] = {
            t: "n",
            f: `D${excelRow}-C${excelRow}`,
            z: '#,##0.00" €"',
            s: PRICE_CELL_STYLE,
          };
        }
      });

      // Set column widths
      sheet["!cols"] = [
        { wch: 42 }, // Produit
        { wch: 18 }, // Catégorie
        { wch: 14 }, // Price 1
        { wch: 14 }, // Price 2
        ...(showDiff ? [{ wch: 10 }, { wch: 10 }] : []),
      ];

      // Merge cells for title and date
      sheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      ];

      // Update range
      const lastRow = dataStartRow - 1 + data.rows.length;
      sheet["!ref"] = `A1:${XLSX.utils.encode_col(headers.length - 1)}${lastRow}`;

      XLSX.utils.book_append_sheet(workbook, sheet, "Comparatif");

      const filename = `comparatif_${data.restaurants.join("_").toLowerCase().replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("Error exporting Excel:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToPdf, exportToExcel, isExporting };
}
