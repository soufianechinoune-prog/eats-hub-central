import { useCallback } from "react";
import jsPDF from "jspdf";
import { getMetricStatus } from "@/lib/performanceThresholds";

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

interface PdfOptions {
  periodStart: string;
  periodEnd: string;
}

const STATUS_COLORS = {
  good: [16, 185, 129] as [number, number, number],     // emerald
  warning: [245, 158, 11] as [number, number, number],  // amber
  critical: [239, 68, 68] as [number, number, number],   // red
  neutral: [107, 114, 128] as [number, number, number],  // gray
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatVariation = (v: number | null): string => {
  if (v === null) return "";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
};

export function useReportPdfExport() {

  const generateReportPdf = useCallback((kpi: ReportKPIs, options: PdfOptions): Blob => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentW = pw - margin * 2;
    let y = 0;

    // ========== HEADER ==========
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, pw, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CS Delivery", margin, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Rapport de Performance", margin, 18);
    
    // Restaurant name + period
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.restaurant_name, margin, 25);
    
    const periodText = `${options.periodStart} — ${options.periodEnd}`;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(periodText, pw - margin - doc.getTextWidth(periodText), 25);

    y = 35;

    // ========== KPI SECTIONS ==========
    const drawSection = (title: string, emoji: string, items: { label: string; value: string; variation?: string; status?: "good" | "warning" | "critical" | "neutral" }[]) => {
      // Section title
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(`${emoji}  ${title}`, margin, y);
      y += 2;

      // Underline
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y, margin + contentW, y);
      y += 6;

      for (const item of items) {
        // Label
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.text(item.label, margin + 4, y);

        // Value
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const color = item.status ? STATUS_COLORS[item.status] : STATUS_COLORS.neutral;
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(item.value, margin + 65, y);

        // Variation
        if (item.variation) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          const isPositive = item.variation.startsWith("+");
          const varColor = isPositive ? STATUS_COLORS.good : STATUS_COLORS.critical;
          doc.setTextColor(varColor[0], varColor[1], varColor[2]);
          const arrow = isPositive ? "▲" : "▼";
          doc.text(`${arrow} ${item.variation}`, margin + 110, y);
        }

        y += 7;
      }

      y += 4;
    };

    // 1. CA & Commandes
    drawSection("Chiffre d'Affaires & Commandes", "💰", [
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

    // 2. Satisfaction
    const ratingStatus = kpi.average_rating !== null ? getMetricStatus("rating", kpi.average_rating) : "neutral" as const;
    drawSection("Satisfaction Client", "⭐", [
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

    // 3. Opérations
    const prepStatus = kpi.avg_prep_time !== null ? getMetricStatus("prepTime", kpi.avg_prep_time) : "neutral" as const;
    drawSection("Temps Opérationnels", "⏱️", [
      {
        label: "Temps de préparation",
        value: kpi.avg_prep_time !== null ? `${Math.round(kpi.avg_prep_time)} min` : "--",
        status: prepStatus === "neutral" ? "neutral" : prepStatus,
      },
      {
        label: "Attente coursier",
        value: kpi.avg_courier_wait !== null ? `${Math.round(kpi.avg_courier_wait)} min` : "--",
        status: "neutral",
      },
    ]);

    // 4. Erreurs
    const errorStatus = kpi.error_rate !== null ? getMetricStatus("errorRate", kpi.error_rate) : "neutral" as const;
    drawSection("Erreurs", "❌", [
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

    // 5. Disponibilité (downtime)
    const downtimeHours = kpi.downtime_minutes != null ? kpi.downtime_minutes / 60 : null;
    const downtimeStatus = downtimeHours !== null ? getMetricStatus("downtime", downtimeHours) : "neutral" as const;
    const downtimeVariation = (kpi.downtime_minutes != null && kpi.prev_downtime_minutes != null && kpi.prev_downtime_minutes > 0)
      ? ((kpi.downtime_minutes - kpi.prev_downtime_minutes) / kpi.prev_downtime_minutes) * 100
      : null;

    drawSection("Disponibilité", "📶", [
      {
        label: "Temps d'inactivité",
        value: kpi.downtime_minutes != null ? `${kpi.downtime_minutes} min` : "--",
        variation: downtimeVariation !== null ? formatVariation(-downtimeVariation) : undefined, // invert: less downtime = positive
        status: downtimeStatus === "neutral" ? "neutral" : downtimeStatus,
      },
    ]);

    // ========== FOOTER ==========
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, ph - 10, pw - margin, ph - 10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.text(`Généré le ${now}`, margin, ph - 5);
    doc.text("CS Delivery Performance", pw - margin - doc.getTextWidth("CS Delivery Performance"), ph - 5);

    return doc.output("blob");
  }, []);

  return { generateReportPdf };
}
