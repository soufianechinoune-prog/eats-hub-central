import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx-js-style";
import { loadChainLogoBase64, getChainName } from "@/lib/pdfLogoHelper";

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
  chainId?: string | null;
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

// Comprehensive export data with full comparison table (simplified without rankings)
export interface ComprehensiveExportData {
  title: string;
  period: string;
  totalRestaurants: number;
  globalMetrics: PlatformMetrics;
  uberMetrics: PlatformMetrics;
  deliverooMetrics: PlatformMetrics;
  restaurantComparison: RestaurantComparisonRow[];
  networkTotals: NetworkTotals;
  showN1: boolean;
}

interface RestaurantComparisonRow {
  id: string;
  name: string;
  city: string | null;
  revenue: number;
  orders: number;
  avgBasket: number;
  netPayout: number;
  rating: number | null;
  profitability: number | null;
  prepTime: number | null;
  totalDeliveryTime: number | null;
  errorRate: number | null;
  downtime: number | null;
  revenueVariation?: number | null;
}

interface NetworkTotals {
  totalRevenue: number;
  totalOrders: number;
  avgBasket: number;
  totalNetPayout: number;
  avgRating: number | null;
  avgProfitability: number | null;
  avgPrepTime: number | null;
  avgTotalDeliveryTime: number | null;
  avgErrorRate: number | null;
  totalDowntime: number | null;
  revenueVariation?: number | null;
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

// Helper to format total delivery time (simple minutes)
const formatTotalDeliveryTime = (minutes: number | null): string => {
  if (minutes == null || isNaN(minutes)) return "--";
  return `${Math.round(minutes)}min`;
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

  // New comprehensive export function with comparison table
  const exportComprehensivePdf = useCallback(async (data: ComprehensiveExportData) => {
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
      const totalPages = 6; // 1 overview + 1 comparison table + 4 rankings

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
      const gray = { r: 107, g: 114, b: 128 };
      const darkGray = { r: 55, g: 65, b: 81 };
      const lightGray = { r: 243, g: 244, b: 246 };

      // Draw header with logo
      const drawHeader = (pageNum: number, subtitle: string) => {
        pdf.setFillColor(emerald.r, emerald.g, emerald.b);
        pdf.rect(0, 0, pageWidth, 28, "F");

        try {
          pdf.addImage(csLogoBase64, "JPEG", margin, 4, 20, 20);
        } catch (e) {
          console.log("Could not add logo");
        }

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("CHICKEN STREET", margin + 25, 12);

        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.text(subtitle, margin + 25, 20);

        pdf.setFontSize(10);
        const pageText = `${pageNum} / ${totalPages}`;
        pdf.text(pageText, pageWidth - margin - pdf.getTextWidth(pageText), 16);

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

      // ========== PAGE 1: Overview with KPIs ==========
      drawHeader(1, "Vue d'ensemble - Toutes plateformes");
      
      const kpiStartY = 55;
      const cardWidth = (pageWidth - margin * 2 - 20) / 3;
      const cardHeight = 50;
      
      // Helper to draw a KPI card
      const drawKpiCard = (x: number, y: number, width: number, height: number, title: string, metrics: { label: string; value: string; color?: { r: number; g: number; b: number } }[]) => {
        // Card background with subtle border
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(x, y, width, height, 3, 3, "FD");
        
        // Title
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
        pdf.text(title, x + 8, y + 12);
        
        // Metrics
        const metricStartY = y + 22;
        const metricSpacing = 12;
        
        metrics.forEach((metric, idx) => {
          const metricY = metricStartY + idx * metricSpacing;
          
          // Label
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(gray.r, gray.g, gray.b);
          pdf.text(metric.label, x + 8, metricY);
          
          // Value
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          if (metric.color) {
            pdf.setTextColor(metric.color.r, metric.color.g, metric.color.b);
          } else {
            pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
          }
          pdf.text(metric.value, x + width - 8, metricY, { align: "right" });
        });
      };
      
      // Global metrics card
      drawKpiCard(margin, kpiStartY, cardWidth, cardHeight, "RÉSEAU GLOBAL", [
        { label: "Note moyenne", value: data.globalMetrics.rating != null ? data.globalMetrics.rating.toFixed(1) : "--" },
        { label: "Temps de préparation", value: data.globalMetrics.prepTime != null ? formatMinutes(data.globalMetrics.prepTime) : "--" },
        { label: "Taux d'erreur", value: data.globalMetrics.errorRate != null ? `${data.globalMetrics.errorRate.toFixed(1)}%` : "--", color: data.globalMetrics.errorRate != null && data.globalMetrics.errorRate > 5 ? orange : emerald },
      ]);
      
      // Uber metrics card
      drawKpiCard(margin + cardWidth + 10, kpiStartY, cardWidth, cardHeight, "UBER EATS", [
        { label: "Note moyenne", value: data.uberMetrics.rating != null ? data.uberMetrics.rating.toFixed(1) : "--" },
        { label: "Temps de préparation", value: data.uberMetrics.prepTime != null ? formatMinutes(data.uberMetrics.prepTime) : "--" },
        { label: "Taux d'erreur", value: data.uberMetrics.errorRate != null ? `${data.uberMetrics.errorRate.toFixed(1)}%` : "--", color: data.uberMetrics.errorRate != null && data.uberMetrics.errorRate > 5 ? orange : emerald },
      ]);
      
      // Deliveroo metrics card
      drawKpiCard(margin + (cardWidth + 10) * 2, kpiStartY, cardWidth, cardHeight, "DELIVEROO", [
        { label: "Note moyenne", value: data.deliverooMetrics.rating != null ? data.deliverooMetrics.rating.toFixed(1) : "--" },
        { label: "Temps de préparation", value: data.deliverooMetrics.prepTime != null ? formatMinutes(data.deliverooMetrics.prepTime) : "--" },
        { label: "Taux d'erreur", value: data.deliverooMetrics.errorRate != null ? `${data.deliverooMetrics.errorRate.toFixed(1)}%` : "--", color: data.deliverooMetrics.errorRate != null && data.deliverooMetrics.errorRate > 5 ? orange : emerald },
      ]);
      
      // Network summary section
      const summaryY = kpiStartY + cardHeight + 15;
      const summaryHeight = 55;
      
      // Draw summary card with border
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(229, 231, 235);
      pdf.roundedRect(margin, summaryY, pageWidth - margin * 2, summaryHeight, 3, 3, "FD");
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
      pdf.text("Synthèse du réseau", margin + 10, summaryY + 12);
      
      // Summary metrics in 2 rows
      const summaryMetrics = [
        { label: "Chiffre d'affaires total", value: `${formatNumber(data.networkTotals.totalRevenue, 0)} €` },
        { label: "Versement total", value: `${formatNumber(data.networkTotals.totalNetPayout, 0)} €` },
        { label: "Rentabilité moyenne", value: data.networkTotals.avgProfitability != null ? `${data.networkTotals.avgProfitability.toFixed(1)}%` : "--" },
        { label: "Commandes", value: formatNumber(data.networkTotals.totalOrders, 0) },
        { label: "Panier moyen", value: `${data.networkTotals.avgBasket.toFixed(2)} €` },
        { label: "Inactivité totale", value: formatHours(data.networkTotals.totalDowntime) },
      ];
      
      const colCount = 3;
      const rowCount = 2;
      const metricWidth = (pageWidth - margin * 2 - 20) / colCount;
      
      summaryMetrics.forEach((metric, idx) => {
        const col = idx % colCount;
        const row = Math.floor(idx / colCount);
        const x = margin + 10 + col * metricWidth;
        const y = summaryY + 22 + row * 16;
        
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(gray.r, gray.g, gray.b);
        pdf.text(metric.label, x, y);
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(emerald.r, emerald.g, emerald.b);
        pdf.text(metric.value, x + metricWidth - 10, y, { align: "right" });
      });
      
      // Bottom decorative bar
      const bottomBarY = summaryY + summaryHeight + 20;
      pdf.setFillColor(emerald.r, emerald.g, emerald.b);
      pdf.rect(margin, bottomBarY, pageWidth - margin * 2, 4, "F");
      
      // Small note text
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(gray.r, gray.g, gray.b);
      pdf.text("Données consolidées sur la période sélectionnée - Toutes plateformes confondues", margin, bottomBarY + 12);
      
      drawFooter(1);

      // ========== PAGE 2: Comparison Table ==========
      pdf.addPage();
      drawHeader(2, "Tableau comparatif des restaurants");

      const tableStartY = 48;
      const rowHeight = 10;
      // New column order: #, Restaurant, CA, Versement, Rentab, Cmds, Panier, Note, Erreurs, Prépa+Livr, Inactiv
      const colWidths = data.showN1 
        ? [8, 45, 28, 20, 28, 18, 18, 22, 15, 18, 22, 18]  // With N-1
        : [8, 50, 32, 32, 24, 20, 24, 18, 20, 24, 20];     // Without N-1

      const headers = data.showN1
        ? ["#", "Restaurant", "CA (EUR)", "vs N-1", "Versement", "Rentab.", "Cmds", "Panier", "Note", "Erreurs", "Prepa+Livr", "Inactiv."]
        : ["#", "Restaurant", "CA (EUR)", "Versement", "Rentab.", "Cmds", "Panier", "Note", "Erreurs", "Prepa+Livr", "Inactiv."];

      // Draw header row
      let currentX = margin;
      pdf.setFillColor(lightGray.r, lightGray.g, lightGray.b);
      pdf.rect(margin, tableStartY, pageWidth - margin * 2, rowHeight, "F");
      
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
      
      headers.forEach((header, i) => {
        pdf.text(header, currentX + 2, tableStartY + 7);
        currentX += colWidths[i];
      });

      // Draw data rows
      pdf.setFont("helvetica", "normal");
      data.restaurantComparison.slice(0, 12).forEach((resto, idx) => {
        const rowY = tableStartY + rowHeight * (idx + 1);
        
        if (idx % 2 === 0) {
          pdf.setFillColor(255, 255, 255);
        } else {
          pdf.setFillColor(249, 250, 251);
        }
        pdf.rect(margin, rowY, pageWidth - margin * 2, rowHeight, "F");

        currentX = margin;
        pdf.setFontSize(8);
        pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);

        const values = data.showN1
          ? [
              String(idx + 1),
              resto.name.substring(0, 20),
              formatNumber(resto.revenue, 0),
              resto.revenueVariation != null ? `${resto.revenueVariation > 0 ? "+" : ""}${resto.revenueVariation.toFixed(1)}%` : "--",
              `${formatNumber(resto.netPayout, 0)} EUR`,
              resto.profitability != null ? `${resto.profitability.toFixed(1)}%` : "--",
              String(resto.orders),
              `${resto.avgBasket.toFixed(2)} EUR`,
              resto.rating != null ? resto.rating.toFixed(1) : "--",
              resto.errorRate != null ? `${resto.errorRate.toFixed(1)}%` : "--",
              formatTotalDeliveryTime(resto.totalDeliveryTime),
              formatHours(resto.downtime),
            ]
          : [
              String(idx + 1),
              resto.name.substring(0, 22),
              formatNumber(resto.revenue, 0),
              `${formatNumber(resto.netPayout, 0)} EUR`,
              resto.profitability != null ? `${resto.profitability.toFixed(1)}%` : "--",
              String(resto.orders),
              `${resto.avgBasket.toFixed(2)} EUR`,
              resto.rating != null ? resto.rating.toFixed(1) : "--",
              resto.errorRate != null ? `${resto.errorRate.toFixed(1)}%` : "--",
              formatTotalDeliveryTime(resto.totalDeliveryTime),
              formatHours(resto.downtime),
            ];

        values.forEach((val, i) => {
          pdf.text(val, currentX + 2, rowY + 7);
          currentX += colWidths[i];
        });
      });

      // Draw totals row
      const totalsRowY = tableStartY + rowHeight * (Math.min(data.restaurantComparison.length, 12) + 1);
      pdf.setFillColor(emerald.r, emerald.g, emerald.b);
      pdf.rect(margin, totalsRowY, pageWidth - margin * 2, rowHeight, "F");
      
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      currentX = margin;

      const totalsValues = data.showN1
        ? [
            "",
            "RESEAU",
            formatNumber(data.networkTotals.totalRevenue, 0),
            data.networkTotals.revenueVariation != null ? `${data.networkTotals.revenueVariation > 0 ? "+" : ""}${data.networkTotals.revenueVariation.toFixed(1)}%` : "--",
            `${formatNumber(data.networkTotals.totalNetPayout, 0)} EUR`,
            data.networkTotals.avgProfitability != null ? `${data.networkTotals.avgProfitability.toFixed(1)}%` : "--",
            String(data.networkTotals.totalOrders),
            `${data.networkTotals.avgBasket.toFixed(2)} EUR`,
            data.networkTotals.avgRating != null ? data.networkTotals.avgRating.toFixed(1) : "--",
            data.networkTotals.avgErrorRate != null ? `${data.networkTotals.avgErrorRate.toFixed(1)}%` : "--",
            formatTotalDeliveryTime(data.networkTotals.avgTotalDeliveryTime),
            formatHours(data.networkTotals.totalDowntime),
          ]
        : [
            "",
            "RESEAU",
            formatNumber(data.networkTotals.totalRevenue, 0),
            `${formatNumber(data.networkTotals.totalNetPayout, 0)} EUR`,
            data.networkTotals.avgProfitability != null ? `${data.networkTotals.avgProfitability.toFixed(1)}%` : "--",
            String(data.networkTotals.totalOrders),
            `${data.networkTotals.avgBasket.toFixed(2)} EUR`,
            data.networkTotals.avgRating != null ? data.networkTotals.avgRating.toFixed(1) : "--",
            data.networkTotals.avgErrorRate != null ? `${data.networkTotals.avgErrorRate.toFixed(1)}%` : "--",
            formatTotalDeliveryTime(data.networkTotals.avgTotalDeliveryTime),
            formatHours(data.networkTotals.totalDowntime),
          ];

      totalsValues.forEach((val, i) => {
        pdf.text(val, currentX + 2, totalsRowY + 7);
        currentX += colWidths[i];
      });

      drawFooter(2);

      pdf.save(`vue_ensemble_complete_${data.period.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      console.error("Error exporting comprehensive PDF:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  // New comprehensive Excel export with comparison table
  const exportComprehensiveExcel = useCallback((data: ComprehensiveExportData) => {
    setIsExporting(true);

    try {
      const workbook = XLSX.utils.book_new();

      // Styles
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { fgColor: { rgb: "2D7D46" } }, // Emerald green
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "CCCCCC" } },
          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } },
        },
      };

      const titleStyle = {
        font: { bold: true, sz: 16, color: { rgb: "1F2937" } },
        alignment: { horizontal: "left" },
      };

      const subtitleStyle = {
        font: { sz: 11, color: { rgb: "6B7280" } },
        alignment: { horizontal: "left" },
      };

      const dataStyle = {
        font: { sz: 10 },
        alignment: { horizontal: "right", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
      };

      const dataStyleLeft = { ...dataStyle, alignment: { horizontal: "left", vertical: "center" } };

      const totalsStyle = {
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "059669" } }, // Emerald 600
        alignment: { horizontal: "right", vertical: "center" },
        border: {
          top: { style: "medium", color: { rgb: "047857" } },
          bottom: { style: "medium", color: { rgb: "047857" } },
          left: { style: "thin", color: { rgb: "047857" } },
          right: { style: "thin", color: { rgb: "047857" } },
        },
      };

      const totalsStyleLeft = { ...totalsStyle, alignment: { horizontal: "left", vertical: "center" } };

      const currencyStyle = {
        ...dataStyle,
        numFmt: '#,##0.00" €"',
      };

      const currencyStyleTotals = {
        ...totalsStyle,
        numFmt: '#,##0.00" €"',
      };

      // Sheet 1: Comparison Table with styling
      // New column order: Restaurant - CA - Versement - Rentab - Commandes - Panier - Notes - Erreur - Prépa+Livr - Inactiv
      const comparisonHeaders = data.showN1
        ? ["#", "Restaurant", "CA (€)", "vs N-1 (%)", "Versement (€)", "Rentab. (%)", "Cmds", "Panier (€)", "Note", "Erreurs (%)", "Prépa+Livr", "Inactiv."]
        : ["#", "Restaurant", "CA (€)", "Versement (€)", "Rentab. (%)", "Cmds", "Panier (€)", "Note", "Erreurs (%)", "Prépa+Livr", "Inactiv."];

      const comparisonRows = data.restaurantComparison.map((r, idx) => {
        const baseRow: (string | number)[] = [
          idx + 1,
          r.name,
          Math.round(r.revenue * 100) / 100,
        ];

        if (data.showN1) {
          baseRow.push(r.revenueVariation != null ? Math.round(r.revenueVariation * 10) / 10 : "");
        }

        return [
          ...baseRow,
          Math.round(r.netPayout * 100) / 100,
          r.profitability != null ? Math.round(r.profitability * 10) / 10 : "",
          r.orders,
          Math.round(r.avgBasket * 100) / 100,
          r.rating != null ? Math.round(r.rating * 10) / 10 : "",
          r.errorRate != null ? Math.round(r.errorRate * 10) / 10 : "",
          r.totalDeliveryTime != null ? `${Math.round(r.totalDeliveryTime)} min` : "",
          r.downtime != null ? `${r.downtime.toFixed(1)}h` : "",
        ];
      });

      // Add network totals row
      const totalsRowData: (string | number)[] = data.showN1
        ? [
            "",
            "RÉSEAU",
            Math.round(data.networkTotals.totalRevenue * 100) / 100,
            data.networkTotals.revenueVariation != null ? Math.round(data.networkTotals.revenueVariation * 10) / 10 : "",
            Math.round(data.networkTotals.totalNetPayout * 100) / 100,
            data.networkTotals.avgProfitability != null ? Math.round(data.networkTotals.avgProfitability * 10) / 10 : "",
            data.networkTotals.totalOrders,
            Math.round(data.networkTotals.avgBasket * 100) / 100,
            data.networkTotals.avgRating != null ? Math.round(data.networkTotals.avgRating * 10) / 10 : "",
            data.networkTotals.avgErrorRate != null ? Math.round(data.networkTotals.avgErrorRate * 10) / 10 : "",
            data.networkTotals.avgTotalDeliveryTime != null ? `${Math.round(data.networkTotals.avgTotalDeliveryTime)} min` : "",
            data.networkTotals.totalDowntime != null ? `${data.networkTotals.totalDowntime.toFixed(1)}h` : "",
          ]
        : [
            "",
            "RÉSEAU",
            Math.round(data.networkTotals.totalRevenue * 100) / 100,
            Math.round(data.networkTotals.totalNetPayout * 100) / 100,
            data.networkTotals.avgProfitability != null ? Math.round(data.networkTotals.avgProfitability * 10) / 10 : "",
            data.networkTotals.totalOrders,
            Math.round(data.networkTotals.avgBasket * 100) / 100,
            data.networkTotals.avgRating != null ? Math.round(data.networkTotals.avgRating * 10) / 10 : "",
            data.networkTotals.avgErrorRate != null ? Math.round(data.networkTotals.avgErrorRate * 10) / 10 : "",
            data.networkTotals.avgTotalDeliveryTime != null ? `${Math.round(data.networkTotals.avgTotalDeliveryTime)} min` : "",
            data.networkTotals.totalDowntime != null ? `${data.networkTotals.totalDowntime.toFixed(1)}h` : "",
          ];

      // Create sheet data with proper structure
      const sheetData = [
        [{ v: "CS Delivery Performance - Tableau Comparatif", s: titleStyle }],
        [{ v: `Période: ${data.period}`, s: subtitleStyle }],
        [{ v: `Généré le: ${new Date().toLocaleString("fr-FR")}`, s: subtitleStyle }],
        [],
        comparisonHeaders.map(h => ({ v: h, s: headerStyle })),
        ...comparisonRows.map((row, rowIdx) => 
          row.map((cell, colIdx) => ({
            v: cell,
            s: rowIdx % 2 === 0 
              ? (colIdx <= 1 ? dataStyleLeft : dataStyle)
              : { ...(colIdx <= 1 ? dataStyleLeft : dataStyle), fill: { fgColor: { rgb: "F9FAFB" } } },
          }))
        ),
        totalsRowData.map((cell, colIdx) => ({
          v: cell,
          s: colIdx <= 1 ? totalsStyleLeft : totalsStyle,
        })),
      ];

      const comparisonSheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Set column widths (without Ville column)
      const baseColWidths = [
        { wch: 4 },   // #
        { wch: 28 },  // Restaurant
        { wch: 14 },  // CA
      ];
      
      if (data.showN1) {
        baseColWidths.push({ wch: 10 }); // vs N-1
      }
      
      baseColWidths.push(
        { wch: 14 },  // Versement
        { wch: 12 },  // Rentabilite
        { wch: 10 },  // Commandes
        { wch: 12 },  // Panier
        { wch: 8 },   // Note
        { wch: 12 },  // Erreurs
        { wch: 10 },  // Temps Prepa
        { wch: 10 },  // Inactivite
      );

      comparisonSheet["!cols"] = baseColWidths;

      XLSX.utils.book_append_sheet(workbook, comparisonSheet, "Tableau Comparatif");

      // Sheet 2: KPIs Platform
      const kpiData = [
        ["CS Delivery Performance - KPIs Plateforme"],
        [`Periode: ${data.period}`],
        [],
        ["", "Global", "Uber Eats", "Deliveroo"],
        ["Note moyenne", data.globalMetrics.rating?.toFixed(1) ?? "--", data.uberMetrics.rating?.toFixed(1) ?? "--", data.deliverooMetrics.rating?.toFixed(1) ?? "--"],
        ["Temps preparation", formatMinutes(data.globalMetrics.prepTime), formatMinutes(data.uberMetrics.prepTime), formatMinutes(data.deliverooMetrics.prepTime)],
        ["Commandes incorrectes (%)", data.globalMetrics.incorrectOrderRate?.toFixed(1) ?? "--", data.uberMetrics.incorrectOrderRate?.toFixed(1) ?? "--", data.deliverooMetrics.incorrectOrderRate?.toFixed(1) ?? "--"],
        ["Rentabilite (%)", data.globalMetrics.profitability?.toFixed(1) ?? "--", data.uberMetrics.profitability?.toFixed(1) ?? "--", data.deliverooMetrics.profitability?.toFixed(1) ?? "--"],
        ["Temps inactivite", formatHours(data.globalMetrics.downtime), formatHours(data.uberMetrics.downtime), formatHours(data.deliverooMetrics.downtime)],
      ];
      const kpiSheet = XLSX.utils.aoa_to_sheet(kpiData);
      XLSX.utils.book_append_sheet(workbook, kpiSheet, "KPIs Plateforme");

      XLSX.writeFile(workbook, `vue_ensemble_complete_${data.period.replace(/\s+/g, "_")}.xlsx`);
    } catch (error) {
      console.error("Error exporting comprehensive Excel:", error);
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

  return { exportToPdf, exportToExcel, exportComprehensivePdf, exportComprehensiveExcel, isExporting };
}
