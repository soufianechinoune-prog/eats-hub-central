import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

interface RestaurantMetric {
  id: string;
  name: string;
  rating?: number;
  prepTime?: number;
  errorRate?: number;
  profitability?: number;
  revenue?: number;
  conversion?: number;
  conversionRate?: number;
  city?: string;
  visits?: number;
  orders?: number;
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
  rankings: {
    rating: { top: RestaurantMetric[]; flop: RestaurantMetric[] };
    revenue: { top: RestaurantMetric[]; flop: RestaurantMetric[] };
    profitability: { top: RestaurantMetric[]; flop: RestaurantMetric[] };
    conversion: { top: RestaurantMetric[]; flop: RestaurantMetric[] };
  };
}

// Legacy interface for Excel export (still uses old structure)
interface LegacyExportData {
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

  const exportToPdf = useCallback(async (data: ExportData) => {
    setIsExporting(true);

    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const totalPages = 4;

      const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const views = [
        { key: "rating", label: "Note", metric: "rating", unit: "★" },
        { key: "revenue", label: "Chiffre d'Affaires", metric: "revenue", unit: "€" },
        { key: "profitability", label: "Rentabilité", metric: "profitability", unit: "%" },
        { key: "conversion", label: "Conversion", metric: "conversion", unit: "%" },
      ] as const;

      const formatValue = (value: number | undefined, metric: string, unit: string): string => {
        if (value == null || isNaN(value)) return "—";
        if (metric === "rating") return `${value.toFixed(1)} ${unit}`;
        if (metric === "revenue") return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${unit}`;
        return `${value.toFixed(1)} ${unit}`;
      };

      const drawHeader = (pageNum: number, viewLabel: string) => {
        // Green header bar
        pdf.setFillColor(16, 185, 129);
        pdf.rect(0, 0, pageWidth, 22, "F");

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(data.title, margin, 10);

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Classement par ${viewLabel}`, margin, 17);

        // Page indicator on right
        pdf.setFontSize(9);
        const pageText = `Page ${pageNum}/${totalPages}`;
        pdf.text(pageText, pageWidth - margin - pdf.getTextWidth(pageText), 14);

        // Gray meta bar
        pdf.setFillColor(249, 250, 251);
        pdf.rect(0, 22, pageWidth, 10, "F");
        
        pdf.setTextColor(107, 114, 128);
        pdf.setFontSize(8);
        pdf.text(`Période: ${data.period}`, margin, 28);
        pdf.text(`Généré le ${dateStr}`, pageWidth - margin - pdf.getTextWidth(`Généré le ${dateStr}`), 28);
      };

      const drawFooter = () => {
        pdf.setDrawColor(229, 231, 235);
        pdf.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
        
        pdf.setFontSize(7);
        pdf.setTextColor(156, 163, 175);
        pdf.text("CS Delivery Performance - Vue d'ensemble", margin, pageHeight - 4);
      };

      const drawTable = (
        title: string,
        restaurants: RestaurantMetric[],
        startX: number,
        startY: number,
        metric: string,
        unit: string
      ) => {
        const colWidths = [8, 75, 35];
        const tableWidth = colWidths.reduce((a, b) => a + b, 0);
        const rowHeight = 7;

        // Title
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(55, 65, 81);
        pdf.text(title, startX, startY);

        const tableStartY = startY + 5;

        // Header row
        pdf.setFillColor(243, 244, 246);
        pdf.rect(startX, tableStartY, tableWidth, rowHeight, "F");
        
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(75, 85, 99);
        pdf.text("#", startX + 3, tableStartY + 5);
        pdf.text("Restaurant", startX + colWidths[0] + 3, tableStartY + 5);
        pdf.text(metric === "revenue" ? "CA" : metric === "profitability" ? "Rent." : metric === "conversion" ? "Conv." : "Note", startX + colWidths[0] + colWidths[1] + 3, tableStartY + 5);

        // Data rows
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(55, 65, 81);
        
        restaurants.slice(0, 5).forEach((resto, idx) => {
          const rowY = tableStartY + rowHeight * (idx + 1);
          
          // Alternate row background
          if (idx % 2 === 1) {
            pdf.setFillColor(249, 250, 251);
            pdf.rect(startX, rowY, tableWidth, rowHeight, "F");
          }

          pdf.setFontSize(8);
          pdf.text(String(idx + 1), startX + 3, rowY + 5);
          
          // Truncate long names
          let name = resto.name;
          if (pdf.getTextWidth(name) > colWidths[1] - 6) {
            while (pdf.getTextWidth(name + "...") > colWidths[1] - 6 && name.length > 0) {
              name = name.slice(0, -1);
            }
            name += "...";
          }
          pdf.text(name, startX + colWidths[0] + 3, rowY + 5);

          const value = metric === "rating" ? resto.rating 
            : metric === "revenue" ? resto.revenue 
            : metric === "profitability" ? resto.profitability 
            : (resto.conversion ?? resto.conversionRate);
          pdf.text(formatValue(value, metric, unit), startX + colWidths[0] + colWidths[1] + 3, rowY + 5);
        });

        // Table border
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(startX, tableStartY, tableWidth, rowHeight * 6, "S");
      };

      const drawGlobalMetrics = (startY: number) => {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(55, 65, 81);
        pdf.text("Métriques Globales", margin, startY);

        const metricsY = startY + 8;
        const metrics = [
          { label: "Note moyenne", value: data.globalMetrics.avgRating.toFixed(1), unit: "★" },
          { label: "Temps prépa.", value: data.globalMetrics.avgPrepTime.toFixed(0), unit: "min" },
          { label: "Taux d'erreur", value: data.globalMetrics.avgErrorRate.toFixed(1), unit: "%" },
          { label: "Rentabilité", value: data.globalMetrics.avgProfitability.toFixed(1), unit: "%" },
        ];

        const boxWidth = (pageWidth - margin * 2) / 4 - 3;
        
        metrics.forEach((m, idx) => {
          const boxX = margin + idx * (boxWidth + 4);
          
          pdf.setFillColor(243, 244, 246);
          pdf.roundedRect(boxX, metricsY, boxWidth, 18, 2, 2, "F");
          
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(107, 114, 128);
          pdf.text(m.label, boxX + 4, metricsY + 6);
          
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(16, 185, 129);
          pdf.text(`${m.value} ${m.unit}`, boxX + 4, metricsY + 14);
        });

        return metricsY + 25;
      };

      // Generate each page
      views.forEach((view, pageIndex) => {
        if (pageIndex > 0) pdf.addPage();

        drawHeader(pageIndex + 1, view.label);
        
        let contentY = 38;
        
        // Only show global metrics on first page
        if (pageIndex === 0) {
          contentY = drawGlobalMetrics(contentY);
        }

        const ranking = data.rankings[view.key];
        const tableY = contentY + 5;
        const halfWidth = (pageWidth - margin * 2) / 2;

        // Top 5 table (left)
        drawTable("🏆 Top 5", ranking.top, margin, tableY, view.metric, view.unit);
        
        // Flop 5 table (right)
        drawTable("⚠️ Points d'attention", ranking.flop, margin + halfWidth + 5, tableY, view.metric, view.unit);

        drawFooter();
      });

      pdf.save(`vue_ensemble_${data.period.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportToExcel = useCallback((data: LegacyExportData) => {
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
        (r.rating ?? 0).toFixed(1),
        (r.prepTime ?? 0).toFixed(0),
        (r.errorRate ?? 0).toFixed(1),
        (r.profitability ?? 0).toFixed(1),
        (r.revenue ?? 0).toFixed(2),
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
        (r.rating ?? 0).toFixed(1),
        (r.prepTime ?? 0).toFixed(0),
        (r.errorRate ?? 0).toFixed(1),
        (r.profitability ?? 0).toFixed(1),
        (r.revenue ?? 0).toFixed(2),
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
