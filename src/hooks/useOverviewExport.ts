import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import csLogoBase64 from "@/assets/cs-logo.jpeg";

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

interface PlatformMetrics {
  rating: number | null;
  prepTime: number | null;
  errorRate: number | null;
  incorrectOrderRate: number | null;
  profitability: number | null;
  downtime: number | null;
}

interface ExportData {
  title: string;
  period: string;
  totalRestaurants: number;
  globalMetrics: PlatformMetrics;
  uberMetrics: PlatformMetrics;
  deliverooMetrics: PlatformMetrics;
  rankings: {
    rating: { top: RestaurantMetric[]; flop: RestaurantMetric[] };
    revenue: { top: RestaurantMetric[]; flop: RestaurantMetric[] };
    profitability: { top: RestaurantMetric[]; flop: RestaurantMetric[] };
    conversion: { top: RestaurantMetric[]; flop: RestaurantMetric[] };
  };
}

// Legacy interface for Excel export
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

// Helper to format numbers without weird characters
const formatNumber = (value: number, decimals: number = 0): string => {
  if (value == null || isNaN(value)) return "--";
  const fixed = value.toFixed(decimals);
  // Add space as thousands separator
  const parts = fixed.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(",");
};

// Helper to format time in minutes
const formatMinutes = (minutes: number | null): string => {
  if (minutes == null || isNaN(minutes)) return "--";
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins} min ${secs} s`;
};

// Helper to format hours
const formatHours = (hours: number | null): string => {
  if (hours == null || isNaN(hours)) return "--";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (h === 0) return `${mins}min`;
  if (mins === 0) return `${h}h`;
  return `${h}h ${mins}min`;
};

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
      const totalPages = 5; // 1 overview + 4 rankings

      const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Colors
      const emerald = { r: 16, g: 185, b: 129 };
      const orange = { r: 249, g: 115, b: 22 };
      const teal = { r: 20, g: 184, b: 166 };
      const gray = { r: 107, g: 114, b: 128 };
      const darkGray = { r: 55, g: 65, b: 81 };
      const lightGray = { r: 243, g: 244, b: 246 };

      // Draw header with logo
      const drawHeader = (pageNum: number, subtitle: string) => {
        // Green gradient header
        pdf.setFillColor(emerald.r, emerald.g, emerald.b);
        pdf.rect(0, 0, pageWidth, 28, "F");

        // Add logo
        try {
          pdf.addImage(csLogoBase64, "JPEG", margin, 4, 20, 20);
        } catch (e) {
          console.log("Could not add logo");
        }

        // Title
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("CHICKEN STREET", margin + 25, 12);

        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.text(subtitle, margin + 25, 20);

        // Page indicator
        pdf.setFontSize(10);
        const pageText = `${pageNum} / ${totalPages}`;
        pdf.text(pageText, pageWidth - margin - pdf.getTextWidth(pageText), 16);

        // Meta bar
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 28, pageWidth, 12, "F");
        
        pdf.setTextColor(gray.r, gray.g, gray.b);
        pdf.setFontSize(9);
        pdf.text(`Periode: ${data.period}`, margin, 36);
        pdf.text(`${data.totalRestaurants} restaurants`, margin + 80, 36);
        
        const genText = `Genere le ${dateStr}`;
        pdf.text(genText, pageWidth - margin - pdf.getTextWidth(genText), 36);
      };

      const drawFooter = (pageNum: number) => {
        pdf.setDrawColor(229, 231, 235);
        pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
        
        pdf.setFontSize(8);
        pdf.setTextColor(gray.r, gray.g, gray.b);
        pdf.text("CS Delivery Performance - Rapport Hebdomadaire", margin, pageHeight - 5);
        pdf.text(`Page ${pageNum}/${totalPages}`, pageWidth - margin - 20, pageHeight - 5);
      };

      // ========== PAGE 1: Overview with Global / Uber Eats / Deliveroo ==========
      drawHeader(1, "Vue d'ensemble - Toutes plateformes");

      const startY = 48;
      const cardWidth = (pageWidth - margin * 2 - 20) / 3;
      const cardHeight = 110;

      const drawPlatformCard = (
        title: string,
        subtitle: string,
        metrics: PlatformMetrics,
        x: number,
        y: number,
        color: { r: number; g: number; b: number },
        showAll: boolean = true
      ) => {
        // Card background with colored top border
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "F");
        
        // Colored top accent
        pdf.setFillColor(color.r, color.g, color.b);
        pdf.rect(x, y, cardWidth, 4, "F");
        
        // Card shadow/border
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "S");

        // Title
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
        pdf.text(title, x + 8, y + 16);

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(gray.r, gray.g, gray.b);
        pdf.text(subtitle, x + 8, y + 24);

        // Metrics
        const metricsData = [
          { label: "Note moyenne", value: metrics.rating != null ? `${formatNumber(metrics.rating, 1)}/5` : "--", color: color },
          { label: "Temps preparation", value: formatMinutes(metrics.prepTime), color: color },
          { label: "Commandes incorrectes", value: metrics.incorrectOrderRate != null ? `${formatNumber(metrics.incorrectOrderRate, 1)}%` : "--", color: orange },
          { label: "Rentabilite", value: metrics.profitability != null ? `${formatNumber(metrics.profitability, 1)}%` : "--", color: color },
          { label: "Temps inactivite", value: formatHours(metrics.downtime), color: orange },
        ];

        let metricY = y + 34;
        metricsData.forEach((m) => {
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
          pdf.text(m.label, x + 8, metricY);

          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(m.color.r, m.color.g, m.color.b);
          const valueText = m.value;
          pdf.text(valueText, x + cardWidth - 8 - pdf.getTextWidth(valueText), metricY);

          metricY += 14;
        });
      };

      // Draw 3 platform cards
      drawPlatformCard("Global", "Toutes plateformes", data.globalMetrics, margin, startY, emerald);
      drawPlatformCard("Uber Eats", data.period, data.uberMetrics, margin + cardWidth + 10, startY, emerald);
      drawPlatformCard("Deliveroo", data.period, data.deliverooMetrics, margin + (cardWidth + 10) * 2, startY, teal);

      drawFooter(1);

      // ========== PAGES 2-5: Rankings ==========
      const views = [
        { key: "rating", label: "Note", metric: "rating", unit: "/5" },
        { key: "revenue", label: "Chiffre d'Affaires", metric: "revenue", unit: " EUR" },
        { key: "profitability", label: "Rentabilite", metric: "profitability", unit: "%" },
        { key: "conversion", label: "Conversion", metric: "conversion", unit: "%" },
      ] as const;

      const formatMetricValue = (value: number | undefined, metric: string, unit: string): string => {
        if (value == null || isNaN(value)) return "--";
        if (metric === "rating") return `${formatNumber(value, 1)}${unit}`;
        if (metric === "revenue") return `${formatNumber(value, 0)}${unit}`;
        return `${formatNumber(value, 1)}${unit}`;
      };

      const drawRankingTable = (
        title: string,
        restaurants: RestaurantMetric[],
        startX: number,
        startY: number,
        metric: string,
        unit: string,
        isTop: boolean
      ) => {
        const tableWidth = (pageWidth - margin * 2 - 15) / 2;
        const rowHeight = 12;
        const colWidths = [15, tableWidth - 70, 55];

        // Title with icon
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        if (isTop) {
          pdf.setTextColor(emerald.r, emerald.g, emerald.b);
        } else {
          pdf.setTextColor(orange.r, orange.g, orange.b);
        }
        pdf.text(title, startX, startY);

        const tableStartY = startY + 6;

        // Header row
        pdf.setFillColor(lightGray.r, lightGray.g, lightGray.b);
        pdf.rect(startX, tableStartY, tableWidth, rowHeight, "F");
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
        pdf.text("#", startX + 5, tableStartY + 8);
        pdf.text("Restaurant", startX + colWidths[0] + 5, tableStartY + 8);
        
        const colHeader = metric === "revenue" ? "CA" : metric === "profitability" ? "Rentabilite" : metric === "conversion" ? "Conversion" : "Note";
        pdf.text(colHeader, startX + colWidths[0] + colWidths[1] + 5, tableStartY + 8);

        // Data rows
        pdf.setFont("helvetica", "normal");
        
        restaurants.slice(0, 5).forEach((resto, idx) => {
          const rowY = tableStartY + rowHeight * (idx + 1);
          
          // Alternate row background
          if (idx % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(249, 250, 251);
          }
          pdf.rect(startX, rowY, tableWidth, rowHeight, "F");

          pdf.setFontSize(10);
          pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
          
          // Rank
          pdf.setFont("helvetica", "bold");
          pdf.text(String(idx + 1), startX + 5, rowY + 8);
          
          // Restaurant name - truncate if needed
          pdf.setFont("helvetica", "normal");
          let name = resto.name || "";
          const maxNameWidth = colWidths[1] - 10;
          if (pdf.getTextWidth(name) > maxNameWidth) {
            while (pdf.getTextWidth(name + "...") > maxNameWidth && name.length > 0) {
              name = name.slice(0, -1);
            }
            name += "...";
          }
          pdf.text(name, startX + colWidths[0] + 5, rowY + 8);

          // Value
          const value = metric === "rating" ? resto.rating 
            : metric === "revenue" ? resto.revenue 
            : metric === "profitability" ? resto.profitability 
            : (resto.conversion ?? resto.conversionRate);
          
          pdf.setFont("helvetica", "bold");
          if (isTop) {
            pdf.setTextColor(emerald.r, emerald.g, emerald.b);
          } else {
            pdf.setTextColor(orange.r, orange.g, orange.b);
          }
          pdf.text(formatMetricValue(value, metric, unit), startX + colWidths[0] + colWidths[1] + 5, rowY + 8);
        });

        // Table border
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(startX, tableStartY, tableWidth, rowHeight * 6, 2, 2, "S");
      };

      views.forEach((view, pageIndex) => {
        pdf.addPage();
        drawHeader(pageIndex + 2, `Classement par ${view.label}`);

        const ranking = data.rankings[view.key];
        const tableY = 52;
        const tableWidth = (pageWidth - margin * 2 - 15) / 2;

        // Top 5 table (left)
        drawRankingTable("TOP 5", ranking.top, margin, tableY, view.metric, view.unit, true);
        
        // Flop 5 table (right)
        drawRankingTable("POINTS D'ATTENTION", ranking.flop, margin + tableWidth + 15, tableY, view.metric, view.unit, false);

        drawFooter(pageIndex + 2);
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

      const globalData = [
        ["CS Delivery Performance - Vue d'ensemble"],
        ["Periode", data.period],
        ["Genere le", new Date().toLocaleString("fr-FR")],
        [],
        ["Metriques Globales"],
        ["Note moyenne", data.globalMetrics.avgRating.toFixed(1)],
        ["Temps de preparation moyen", `${data.globalMetrics.avgPrepTime.toFixed(0)} min`],
        ["Taux d'erreur moyen", `${data.globalMetrics.avgErrorRate.toFixed(1)}%`],
        ["Rentabilite moyenne", `${data.globalMetrics.avgProfitability.toFixed(1)}%`],
      ];
      const globalSheet = XLSX.utils.aoa_to_sheet(globalData);
      XLSX.utils.book_append_sheet(workbook, globalSheet, "Metriques Globales");

      const topHeaders = ["Rang", "Restaurant", "Note", "Temps prepa (min)", "Taux d'erreur (%)", "Rentabilite (%)", "CA (EUR)"];
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

      const flopHeaders = ["Rang", "Restaurant", "Note", "Temps prepa (min)", "Taux d'erreur (%)", "Rentabilite (%)", "CA (EUR)"];
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
