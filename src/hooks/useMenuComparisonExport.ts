import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

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

      // Build all data in one sheet
      const sheetData: (string | number)[][] = [];
      
      // Title row
      sheetData.push([title]);
      sheetData.push([`Généré le ${dateStr}`]);
      sheetData.push([]);
      
      // Stats row
      sheetData.push([
        `${data.stats.totalProducts} produits`,
        `${data.stats.productsWithDiff} avec écarts`,
        `Écart moyen: ${data.stats.avgDiff}%`
      ]);
      sheetData.push([]);

      // Headers
      const showDiff = data.restaurants.length === 2;
      const headers = ["Produit", "Catégorie", ...data.restaurants];
      if (showDiff) {
        headers.push("Écart %");
        headers.push("Écart €");
      }
      sheetData.push(headers);

      // Data rows - add placeholder for formulas
      const headerRowIndex = sheetData.length; // 0-indexed row where headers are (will be row 6 in Excel, 1-indexed)
      
      data.rows.forEach((row) => {
        const rowData: (string | number | null)[] = [
          row.product,
          row.category,
          // Parse prices as numbers for formulas to work
          ...row.prices.map(p => {
            const parsed = parseFloat(p.price.replace(",", ".").replace("€", "").trim());
            return isNaN(parsed) ? p.price : parsed;
          }),
        ];
        if (showDiff) {
          rowData.push(null); // Placeholder for % formula
          rowData.push(null); // Placeholder for € formula
        }
        sheetData.push(rowData);
      });

      const sheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Add formulas for differences if 2 restaurants
      if (showDiff) {
        const priceCol1 = "C"; // First restaurant price column
        const priceCol2 = "D"; // Second restaurant price column
        const pctCol = "E";    // Écart % column
        const euroCol = "F";   // Écart € column
        
        // Data starts after header row (headerRowIndex is 0-indexed, Excel is 1-indexed)
        const dataStartRow = headerRowIndex + 2; // +1 for 0-to-1 index, +1 because header is at headerRowIndex+1
        
        data.rows.forEach((_, idx) => {
          const excelRow = dataStartRow + idx;
          
          // Écart % formula: (D-C)/C formatted as percentage
          const pctCellRef = `${pctCol}${excelRow}`;
          sheet[pctCellRef] = {
            t: "n",
            f: `IF(${priceCol1}${excelRow}=0,0,(${priceCol2}${excelRow}-${priceCol1}${excelRow})/${priceCol1}${excelRow})`,
            z: "0.0%"
          };
          
          // Écart € formula: D-C
          const euroCellRef = `${euroCol}${excelRow}`;
          sheet[euroCellRef] = {
            t: "n",
            f: `${priceCol2}${excelRow}-${priceCol1}${excelRow}`,
            z: '#,##0.00" €"'
          };
        });
        
        // Update the range to include formula columns
        const lastRow = headerRowIndex + 1 + data.rows.length;
        sheet["!ref"] = `A1:F${lastRow}`;
      }

      // Set column widths
      const colWidths = [
        { wch: 35 }, // Produit
        { wch: 18 }, // Catégorie
        ...data.restaurants.map(() => ({ wch: 14 })), // Price columns
      ];
      if (showDiff) {
        colWidths.push({ wch: 10 }); // Écart %
        colWidths.push({ wch: 10 }); // Écart €
      }
      sheet["!cols"] = colWidths;

      // Apply styles via cell formatting
      // Title cell merge (row 1)
      const totalCols = headers.length;
      sheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }, // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } }, // Date
      ];

      XLSX.utils.book_append_sheet(workbook, sheet, "Comparatif");

      const filename = `comparatif_${data.restaurants.join("_").toLowerCase()}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("Error exporting Excel:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToPdf, exportToExcel, isExporting };
}
