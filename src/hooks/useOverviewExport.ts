import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

interface RestaurantMetric {
  id: string;
  name: string;
  rating: number;
  prepTime: number;
  errorRate: number;
  profitability: number;
  revenue: number;
}

interface ExportData {
  title: string;
  period: string;
  globalMetrics: {
    avgRating: number;
    avgPrepTime: number;
    avgErrorRate: number;
    avgProfitability: number;
  };
  topRestaurants: RestaurantMetric[];
  flopRestaurants: RestaurantMetric[];
  rankingType: string;
}

export function useOverviewExport() {
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
        orientation: "landscape",
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
      pdf.text(data.title, margin, 12);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("CS Delivery Performance - Vue d'ensemble", margin, 19);

      // Meta info
      pdf.setFillColor(249, 250, 251);
      pdf.rect(0, 25, pageWidth, 12, "F");
      
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(9);
      pdf.text(`Période: ${data.period}`, margin, 32);
      
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
      pdf.text("CS Delivery Performance - Vue d'ensemble", margin, pageHeight - 4);
      pdf.text("Page 1/1", pageWidth - margin - pdf.getTextWidth("Page 1/1"), pageHeight - 4);

      pdf.save(`vue_ensemble_${data.period.replace(/\s+/g, "_")}.pdf`);
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

      // Global Metrics Sheet
      const globalData = [
        ["CS Delivery Performance - Vue d'ensemble"],
        ["Période", data.period],
        ["Généré le", new Date().toLocaleString("fr-FR")],
        [],
        ["Métriques Globales"],
        ["Note moyenne", data.globalMetrics.avgRating.toFixed(1)],
        ["Temps de préparation moyen", `${data.globalMetrics.avgPrepTime.toFixed(0)} min`],
        ["Taux d'erreur moyen", `${data.globalMetrics.avgErrorRate.toFixed(1)}%`],
        ["Rentabilité moyenne", `${data.globalMetrics.avgProfitability.toFixed(1)}%`],
      ];
      const globalSheet = XLSX.utils.aoa_to_sheet(globalData);
      XLSX.utils.book_append_sheet(workbook, globalSheet, "Métriques Globales");

      // Top 5 Restaurants Sheet
      const topHeaders = ["Rang", "Restaurant", "Note", "Temps prépa (min)", "Taux d'erreur (%)", "Rentabilité (%)", "CA (€)"];
      const topRows = data.topRestaurants.map((r, idx) => [
        idx + 1,
        r.name,
        r.rating.toFixed(1),
        r.prepTime.toFixed(0),
        r.errorRate.toFixed(1),
        r.profitability.toFixed(1),
        r.revenue.toFixed(2),
      ]);
      const topSheet = XLSX.utils.aoa_to_sheet([
        [`Top 5 Restaurants - ${data.rankingType}`],
        [],
        topHeaders,
        ...topRows,
      ]);
      XLSX.utils.book_append_sheet(workbook, topSheet, `Top 5 ${data.rankingType}`);

      // Flop 5 Restaurants Sheet
      const flopHeaders = ["Rang", "Restaurant", "Note", "Temps prépa (min)", "Taux d'erreur (%)", "Rentabilité (%)", "CA (€)"];
      const flopRows = data.flopRestaurants.map((r, idx) => [
        idx + 1,
        r.name,
        r.rating.toFixed(1),
        r.prepTime.toFixed(0),
        r.errorRate.toFixed(1),
        r.profitability.toFixed(1),
        r.revenue.toFixed(2),
      ]);
      const flopSheet = XLSX.utils.aoa_to_sheet([
        [`Points d'attention - ${data.rankingType}`],
        [],
        flopHeaders,
        ...flopRows,
      ]);
      XLSX.utils.book_append_sheet(workbook, flopSheet, `Flop 5 ${data.rankingType}`);

      XLSX.writeFile(workbook, `vue_ensemble_${data.period.replace(/\s+/g, "_")}.xlsx`);
    } catch (error) {
      console.error("Error exporting Excel:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToPdf, exportToExcel, isExporting };
}
