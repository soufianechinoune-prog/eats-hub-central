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

      // Summary Sheet
      const summaryData = [
        ["Comparaison des prix - " + data.platform],
        ["Généré le", new Date().toLocaleString("fr-FR")],
        [],
        ["Statistiques"],
        ["Total produits", data.stats.totalProducts],
        ["Produits avec écarts", data.stats.productsWithDiff],
        ["Écart moyen", `${data.stats.avgDiff}%`],
        [],
        ["Restaurants comparés"],
        ...data.restaurants.map(r => [r])
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Résumé");

      // Prices Sheet
      const headers = ["Produit", "Catégorie", ...data.restaurants, "Écart"];
      const priceRows = data.rows.map((row) => [
        row.product,
        row.category,
        ...row.prices.map(p => p.price),
        row.difference,
      ]);
      const pricesSheet = XLSX.utils.aoa_to_sheet([headers, ...priceRows]);
      XLSX.utils.book_append_sheet(workbook, pricesSheet, "Détail des prix");

      XLSX.writeFile(workbook, `comparaison_prix_${data.platform}_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (error) {
      console.error("Error exporting Excel:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToPdf, exportToExcel, isExporting };
}
