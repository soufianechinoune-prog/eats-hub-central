import { useCallback } from "react";
import jsPDF from "jspdf";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { getMetricStatus } from "@/lib/performanceThresholds";
import { supabase } from "@/integrations/supabase/client";
import { extractCityName } from "@/lib/restaurantUtils";
import csLogoUrl from "@/assets/cs-logo.jpeg";

interface ReportKPIs {
  restaurant_name: string;
  order_count: number;
  revenue: number;
  average_basket: number;
  order_variation: number | null;
  revenue_variation: number | null;
  average_rating: number | null;
  review_count: number;
  avg_prep_time: number | null;
  avg_courier_wait: number | null;
  error_rate: number | null;
  error_count: number;
  downtime_minutes?: number | null;
  prev_downtime_minutes?: number | null;
}

type ReportType = "ai_global" | "revenue" | "rating" | "operations" | "errors" | "downtime" | "promotions";

interface PdfOptions {
  periodStart: string;
  periodEnd: string;
  reportType?: ReportType;
  restaurant_id?: string;
}

const STATUS_COLORS = {
  good: [16, 185, 129] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  critical: [239, 68, 68] as [number, number, number],
  neutral: [107, 114, 128] as [number, number, number],
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatVariation = (v: number | null): string => {
  if (v === null) return "";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
};

const formatMinutesToHM = (minutes: number): string => {
  if (minutes === 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const SECTION_LABELS: Record<string, string> = {
  revenue: "[CA]",
  rating: "[AVIS]",
  operations: "[OPS]",
  errors: "[ERR]",
  downtime: "[DISPO]",
};

const REPORT_TITLES: Record<ReportType, string> = {
  ai_global: "Rapport de Performance",
  revenue: "Rapport CA & Commandes",
  rating: "Rapport Satisfaction Client",
  operations: "Rapport Temps Operationnels",
  errors: "Rapport Erreurs",
  downtime: "Rapport Disponibilite",
  promotions: "Rapport Promotions",
};

// ========== BAR CHART HELPER (same as useDowntimeExport) ==========
const drawBarChart = (
  doc: jsPDF,
  x: number,
  y: number,
  chartWidth: number,
  maxBarHeight: number,
  labels: string[],
  values: number[],
  options?: { showPercentLabel?: boolean; fontSize?: number }
) => {
  const barCount = labels.length;
  if (barCount === 0) return y;

  const gap = Math.max(1, Math.min(3, chartWidth / barCount * 0.15));
  const barWidth = Math.max(2, (chartWidth - gap * (barCount + 1)) / barCount);
  const fontSize = options?.fontSize || (barCount > 16 ? 6 : 7);
  const showPercent = options?.showPercentLabel !== false;

  const baselineY = y + maxBarHeight;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(x, baselineY, x + chartWidth, baselineY);

  // 95% threshold line
  const thresholdY = baselineY - (maxBarHeight * 0.95);
  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(x, thresholdY, x + chartWidth, thresholdY);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(5);
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.text("95%", x - 1, thresholdY + 1.5, { align: "right" });

  labels.forEach((label, i) => {
    const barX = x + gap + i * (barWidth + gap);
    const rate = Math.min(100, Math.max(0, values[i]));
    const barH = (rate / 100) * maxBarHeight;

    if (rate >= 95) {
      doc.setFillColor(16, 185, 129);
    } else {
      doc.setFillColor(239, 68, 68);
    }

    if (barH > 0.5) {
      doc.rect(barX, baselineY - barH, barWidth, barH, "F");
    }

    if (showPercent) {
      doc.setFontSize(fontSize - 1);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "bold");
      const pctText = rate === 100 ? "100" : rate.toFixed(0);
      doc.text(pctText, barX + barWidth / 2, baselineY - barH - 1.5, { align: "center" });
    }

    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(label, barX + barWidth / 2, baselineY + 4, { align: "center" });
  });

  return baselineY + 8;
};

// ========== FETCH HOURLY AVAILABILITY ==========
async function fetchHourlyAvailability(restaurantId: string, startDate: string, endDate: string) {
  const allRows: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from("hourly_availability")
      .select("hour_start, online_minutes, offline_minutes")
      .eq("restaurant_id", restaurantId)
      .eq("platform", "uber_eats")
      .gte("hour_start", startDate)
      .lte("hour_start", endDate)
      .order("hour_start")
      .range(from, from + batchSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  
  return allRows;
}

export function useReportPdfExport() {

  // Load logo as base64 once
  const loadLogoBase64 = async (): Promise<string | null> => {
    try {
      const response = await fetch(csLogoUrl);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const generateReportPdf = useCallback(async (kpi: ReportKPIs, options: PdfOptions): Promise<Blob> => {
    const reportType = options.reportType || "ai_global";
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pw - margin * 2;
    let y = 0;

    // ========== HEADER (white + logo + emerald line) ==========
    const cityName = extractCityName(kpi.restaurant_name);
    const logoBase64 = await loadLogoBase64();

    // Logo
    const logoSize = 14;
    let textStartX = margin;
    if (logoBase64) {
      doc.addImage(logoBase64, "JPEG", margin, 8, logoSize, logoSize, undefined, "FAST");
      textStartX = margin + logoSize + 4;
    }

    // Title
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Rapport CS ${cityName}`, textStartX, 15);

    // Subtitle (report type)
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(REPORT_TITLES[reportType], textStartX, 21);

    // Period (right-aligned)
    const formatPeriodDate = (dateStr: string) => {
      try {
        const d = parseISO(dateStr);
        return format(d, "d MMM yyyy", { locale: fr });
      } catch { return dateStr; }
    };
    const periodText = `${formatPeriodDate(options.periodStart)} — ${formatPeriodDate(options.periodEnd)}`;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(periodText, pw - margin, 15, { align: "right" });

    // Emerald separation line
    y = 26;
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pw - margin, y);

    y = 33;

    // ========== DOWNTIME REPORT WITH CHARTS ==========
    if (reportType === "downtime" && options.restaurant_id) {
      try {
        // Parse period dates for fetching
        // We need ISO dates for Supabase query - derive from the formatted period strings
        const rows = await fetchHourlyAvailability(
          options.restaurant_id,
          options.periodStart,
          options.periodEnd
        );

        // Compute aggregates
        let totalOnline = 0;
        let totalOffline = 0;
        const dailyMap: Record<string, { online: number; offline: number }> = {};
        const hourlyByDay: Record<string, Record<number, { online: number; offline: number }>> = {};

        for (const row of rows) {
          totalOnline += row.online_minutes;
          totalOffline += row.offline_minutes;
          
          const dateObj = new Date(row.hour_start);
          const dayKey = format(dateObj, "yyyy-MM-dd");
          const hour = dateObj.getHours();
          
          if (!dailyMap[dayKey]) dailyMap[dayKey] = { online: 0, offline: 0 };
          dailyMap[dayKey].online += row.online_minutes;
          dailyMap[dayKey].offline += row.offline_minutes;
          
          if (!hourlyByDay[dayKey]) hourlyByDay[dayKey] = {};
          if (!hourlyByDay[dayKey][hour]) hourlyByDay[dayKey][hour] = { online: 0, offline: 0 };
          hourlyByDay[dayKey][hour].online += row.online_minutes;
          hourlyByDay[dayKey][hour].offline += row.offline_minutes;
        }

        const totalMinutes = totalOnline + totalOffline;
        const availabilityRate = totalMinutes > 0 ? (totalOnline / totalMinutes) * 100 : 100;
        
        // Count incidents (consecutive offline hours > 15min)
        let incidentCount = 0;
        for (const row of rows) {
          if (row.offline_minutes > 15) incidentCount++;
        }

        // ===== 4 KPI CARDS (white bg + colored text) =====
        const kpiCardWidth = (contentW - 15) / 4;
        const kpiCardHeight = 28;

        const kpiCards = [
          {
            label: "Taux de disponibilite",
            value: `${availabilityRate.toFixed(1)}%`,
            color: availabilityRate >= 99 ? [16, 185, 129] : availabilityRate >= 95 ? [245, 158, 11] : [239, 68, 68],
            subtitle: "Moyenne sur la periode",
          },
          {
            label: "Heures en ligne",
            value: formatMinutesToHM(totalOnline),
            color: [16, 185, 129] as number[],
            subtitle: "Temps de fonctionnement",
          },
          {
            label: "Heures hors ligne",
            value: formatMinutesToHM(totalOffline),
            color: totalOffline > 0 ? [239, 68, 68] : [16, 185, 129],
            subtitle: "Temps d'indisponibilite",
          },
          {
            label: "Incidents >15min",
            value: `${incidentCount}`,
            color: incidentCount > 0 ? [239, 68, 68] : [16, 185, 129],
            subtitle: "Periodes hors ligne significatives",
          },
        ];

        console.log("[PDF] Drawing KPI cards with NEW white design v2");
        kpiCards.forEach((card, index) => {
          const x = margin + index * (kpiCardWidth + 5);
          
          // White background with light gray border
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.5);
          doc.roundedRect(x, y, kpiCardWidth, kpiCardHeight, 2, 2, "FD");
          
          // Label in dark gray at top
          doc.setTextColor(75, 85, 99);
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.text(card.label, x + 3, y + 7);
          
          // Value in status color - large and bold
          doc.setTextColor(card.color[0], card.color[1], card.color[2]);
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text(card.value, x + 3, y + 17);
          
          // Subtitle in light gray at bottom
          doc.setTextColor(156, 163, 175);
          doc.setFontSize(5.5);
          doc.setFont("helvetica", "normal");
          doc.text(card.subtitle, x + 3, y + 23);
        });

        y += kpiCardHeight + 12;

        // ===== DAILY BAR CHART (always displayed) =====
        // Generate all days in the period, even if no data
        const allPeriodDays: string[] = [];
        {
          const startD = parseISO(options.periodStart);
          const endD = parseISO(options.periodEnd);
          let cur = startD;
          while (cur <= endD) {
            allPeriodDays.push(format(cur, "yyyy-MM-dd"));
            cur = new Date(cur.getTime() + 86400000);
          }
        }

        const sortedDays = allPeriodDays.length > 0 ? allPeriodDays : Object.keys(dailyMap).sort();

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Disponibilite journaliere", margin, y);
        y += 6;

        const chartWidth = contentW;
        const maxBarHeight = sortedDays.length > 14 ? 35 : 45;
        const labels = sortedDays.map(d => format(parseISO(d), "dd/MM"));
        const values = sortedDays.map(d => {
          const dayData = dailyMap[d];
          if (!dayData) return 100; // No data = 100% available
          const total = dayData.online + dayData.offline;
          return total > 0 ? (dayData.online / total) * 100 : 100;
        });

        y = drawBarChart(doc, margin, y, chartWidth, maxBarHeight, labels, values);
        y += 8;

        // ===== HOURLY BAR CHARTS PER DAY (only for days with <100% availability) =====
        if (rows.length > 0 && sortedDays.length <= 14) {
          // Check if a day has any offline time
          const daysWithIssues = sortedDays.filter(dateStr => {
            const hourlyForDay = hourlyByDay[dateStr];
            if (!hourlyForDay) return false;
            return Object.values(hourlyForDay).some(hd => hd.offline > 0);
          });

          if (daysWithIssues.length === 0) {
            // All days are 100% — show a simple confirmation message
            doc.setTextColor(16, 185, 129);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("✓  Tous les jours de la periode ont un taux de disponibilite de 100%.", margin, y);
            y += 8;
          } else {
            for (const dateStr of daysWithIssues) {
              const hourlyForDay = hourlyByDay[dateStr]!;

              const neededHeight = 50;
              if (y + neededHeight > ph - 15) {
                doc.addPage();
                y = margin;
              }

              const dateObj = parseISO(dateStr);
              const dayLabel = format(dateObj, "EEEE dd/MM", { locale: fr });
              const capitalizedDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

              doc.setTextColor(0, 0, 0);
              doc.setFontSize(9);
              doc.setFont("helvetica", "bold");
              doc.text(`Detail horaire - ${capitalizedDay}`, margin, y);
              y += 4;

              const hourLabels: string[] = [];
              const hourValues: number[] = [];
              for (let h = 0; h < 24; h++) {
                hourLabels.push(`${h}h`);
                const hd = hourlyForDay[h];
                if (hd) {
                  const total = hd.online + hd.offline;
                  hourValues.push(total > 0 ? (hd.online / total) * 100 : 100);
                } else {
                  hourValues.push(100);
                }
              }

              y = drawBarChart(doc, margin, y, chartWidth, 30, hourLabels, hourValues, { fontSize: 5 });
              y += 4;
            }
          }
        }

      } catch (err) {
        console.error("Error fetching downtime data for PDF:", err);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.text("Erreur lors du chargement des donnees de disponibilite", margin, y + 10);
        y += 20;
      }

      // Footer
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, ph - 10, pw - margin, ph - 10);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(156, 163, 175);
      const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
      doc.text(`Genere le ${now}`, margin, ph - 5);
      doc.text("CS Delivery Performance", pw - margin - doc.getTextWidth("CS Delivery Performance"), ph - 5);

      return doc.output("blob");
    }

    // ========== NON-DOWNTIME REPORTS (existing logic) ==========
    const drawSection = (title: string, label: string, items: { label: string; value: string; variation?: string; status?: "good" | "warning" | "critical" | "neutral" }[]) => {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(`${label}  ${title}`, margin, y);
      y += 2;

      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y, margin + contentW, y);
      y += 6;

      for (const item of items) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.text(item.label, margin + 4, y);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const color = item.status ? STATUS_COLORS[item.status] : STATUS_COLORS.neutral;
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(item.value, margin + 65, y);

        if (item.variation) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          const isPositive = item.variation.startsWith("+");
          const varColor = isPositive ? STATUS_COLORS.good : STATUS_COLORS.critical;
          doc.setTextColor(varColor[0], varColor[1], varColor[2]);
          doc.text(`${isPositive ? "+" : "-"} ${item.variation}`, margin + 110, y);
        }

        y += 7;
      }

      y += 4;
    };

    const showAll = reportType === "ai_global";

    if (showAll || reportType === "revenue") {
      drawSection("Chiffre d'Affaires & Commandes", SECTION_LABELS.revenue, [
        {
          label: "Chiffre d'affaires",
          value: formatCurrency(kpi.revenue),
          variation: formatVariation(kpi.revenue_variation),
          status: kpi.revenue_variation !== null ? (kpi.revenue_variation >= 0 ? "good" : "critical") : "neutral",
        },
        {
          label: "Commandes",
          value: `${kpi.order_count}`,
          variation: formatVariation(kpi.order_variation),
          status: kpi.order_variation !== null ? (kpi.order_variation >= 0 ? "good" : "critical") : "neutral",
        },
        {
          label: "Panier moyen",
          value: formatCurrency(kpi.average_basket),
          status: "neutral",
        },
      ]);
    }

    if (showAll || reportType === "rating") {
      const ratingStatus = kpi.average_rating !== null ? getMetricStatus("rating", kpi.average_rating) : "neutral" as const;
      drawSection("Satisfaction Client", SECTION_LABELS.rating, [
        {
          label: "Note moyenne",
          value: kpi.average_rating !== null ? kpi.average_rating.toFixed(2) : "--",
          status: ratingStatus === "neutral" ? "neutral" : ratingStatus,
        },
        {
          label: "Nombre d'avis",
          value: `${kpi.review_count}`,
          status: "neutral",
        },
      ]);
    }

    if (showAll || reportType === "operations") {
      const prepStatus = kpi.avg_prep_time !== null ? getMetricStatus("prepTime", kpi.avg_prep_time) : "neutral" as const;
      drawSection("Temps Operationnels", SECTION_LABELS.operations, [
        {
          label: "Temps de preparation",
          value: kpi.avg_prep_time !== null ? `${Math.round(kpi.avg_prep_time)} min` : "--",
          status: prepStatus === "neutral" ? "neutral" : prepStatus,
        },
        {
          label: "Attente coursier",
          value: kpi.avg_courier_wait !== null ? `${Math.round(kpi.avg_courier_wait)} min` : "--",
          status: "neutral",
        },
      ]);
    }

    if (showAll || reportType === "errors") {
      const errorStatus = kpi.error_rate !== null ? getMetricStatus("errorRate", kpi.error_rate) : "neutral" as const;
      drawSection("Erreurs", SECTION_LABELS.errors, [
        {
          label: "Taux d'erreur",
          value: kpi.error_rate !== null ? `${kpi.error_rate.toFixed(1)}%` : "--",
          status: errorStatus === "neutral" ? "neutral" : errorStatus,
        },
        {
          label: "Nombre d'erreurs",
          value: `${kpi.error_count}`,
          status: "neutral",
        },
      ]);
    }

    if (reportType === "promotions") {
      drawSection("Promotions", "[PROMO]", [
        {
          label: "Donnees",
          value: "Voir rapport WhatsApp",
          status: "neutral",
        },
      ]);
    }

    // Footer
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, ph - 10, pw - margin, ph - 10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.text(`Genere le ${now}`, margin, ph - 5);
    doc.text("CS Delivery Performance", pw - margin - doc.getTextWidth("CS Delivery Performance"), ph - 5);

    return doc.output("blob");
  }, []);

  return { generateReportPdf };
}
