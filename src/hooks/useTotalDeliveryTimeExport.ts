import { useState } from "react";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface RestaurantTotalDeliveryTime {
  rank: number;
  name: string;
  avgTotalTime: number;
  orderCount: number;
}

interface TotalDeliveryTimeExportData {
  periodLabel: string;
  objective: number; // Dynamic objective threshold
  globalStats: {
    avgTotalTime: number;
    totalOrders: number;
    fastRestaurants: number;
    slowRestaurants: number;
    peakHour: { hour: number; avg: number } | null;
    peakWeekday: { day: number; avg: number } | null;
  };
  distribution: { label: string; count: number; color: string }[];
  restaurants: RestaurantTotalDeliveryTime[];
}

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  if (s === 0) return `${m}min`;
  return `${m}min ${s}s`;
};

// Dynamic status based on objective
const getStatusLabel = (totalTime: number, objective: number): string => {
  if (totalTime === 0) return "Aucune donnee";
  if (totalTime < objective - 5) return "Tres rapide";
  if (totalTime < objective) return "Rapide";
  if (totalTime < objective + 5) return "Lent";
  return "Tres lent";
};

const getStatusColor = (totalTime: number, objective: number): [number, number, number] => {
  if (totalTime === 0) return [120, 120, 120]; // muted
  if (totalTime < objective - 5) return [16, 185, 129]; // emerald-500
  if (totalTime < objective) return [34, 197, 94]; // green-500
  if (totalTime < objective + 5) return [249, 115, 22]; // orange-500
  return [239, 68, 68]; // red-500
};

// Helper to format numbers without non-breaking spaces
const formatNumber = (num: number): string => {
  return num.toString();
};

export const useTotalDeliveryTimeExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async (data: TotalDeliveryTimeExportData) => {
    setIsExporting(true);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      // Colors - Violet theme
      const primaryColor: [number, number, number] = [139, 92, 246]; // violet-500
      const textColor: [number, number, number] = [30, 30, 30];
      const mutedColor: [number, number, number] = [120, 120, 120];

      // =====================
      // PAGE 1 - COVER
      // =====================
      
      // Header gradient band
      pdf.setFillColor(...primaryColor);
      pdf.rect(0, 0, pageWidth, 60, "F");

      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text("Rapport Temps Prepa + Livraison", margin, 35);

      // Subtitle
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Periode : ${data.periodLabel}`, margin, 48);

      // Generation date
      pdf.setFontSize(10);
      pdf.text(
        `Genere le ${format(new Date(), "d MMMM yyyy 'a' HH:mm", { locale: fr })}`,
        pageWidth - margin,
        48,
        { align: "right" }
      );

      // KPIs Section
      let yPos = 75;

      pdf.setTextColor(...textColor);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Indicateurs cles", margin, yPos);

      yPos += 10;

      // KPI Cards - more compact
      const kpiCardWidth = (contentWidth - 10) / 2;
      const kpiCardHeight = 28;

      const drawKPICard = (x: number, y: number, label: string, value: string, subtext?: string) => {
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(x, y, kpiCardWidth, kpiCardHeight, 3, 3, "F");
        
        pdf.setTextColor(...mutedColor);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(label, x + 6, y + 10);
        
        pdf.setTextColor(...textColor);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(value, x + 6, y + 22);

        if (subtext) {
          pdf.setTextColor(...mutedColor);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.text(subtext, x + kpiCardWidth - 6, y + 22, { align: "right" });
        }
      };

      drawKPICard(margin, yPos, "Temps moyen reseau", formatMinutesToDisplay(data.globalStats.avgTotalTime));
      drawKPICard(margin + kpiCardWidth + 10, yPos, "Total commandes", formatNumber(data.globalStats.totalOrders));

      yPos += kpiCardHeight + 6;

      const fastLabel = `Rapide (< ${data.objective}min)`;
      const slowLabel = `Lent (>= ${data.objective}min)`;
      drawKPICard(margin, yPos, fastLabel, `${data.globalStats.fastRestaurants} restaurants`);
      drawKPICard(margin + kpiCardWidth + 10, yPos, slowLabel, `${data.globalStats.slowRestaurants} restaurants`);

      yPos += kpiCardHeight + 6;

      if (data.globalStats.peakHour) {
        drawKPICard(margin, yPos, "Heure la plus lente", `${data.globalStats.peakHour.hour}h - ${data.globalStats.peakHour.hour + 1}h`, formatMinutesToDisplay(data.globalStats.peakHour.avg));
      }
      
      if (data.globalStats.peakWeekday) {
        drawKPICard(margin + kpiCardWidth + 10, yPos, "Jour le plus lent", WEEKDAYS[data.globalStats.peakWeekday.day], formatMinutesToDisplay(data.globalStats.peakWeekday.avg));
      }

      yPos += kpiCardHeight + 15;

      // Distribution section - more compact
      pdf.setTextColor(...textColor);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Repartition par performance", margin, yPos);

      yPos += 10;

      const totalRestaurants = data.distribution.reduce((sum, d) => sum + d.count, 0);
      const barMaxWidth = contentWidth - 60;
      const barHeight = 8;

      data.distribution.forEach((item) => {
        const barWidth = totalRestaurants > 0 ? (item.count / totalRestaurants) * barMaxWidth : 0;
        
        // Label
        pdf.setTextColor(...textColor);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(item.label, margin, yPos + 5);

        // Bar with dynamic color
        let barColor: [number, number, number];
        if (item.label.includes("Tres rapide")) barColor = [16, 185, 129]; // emerald
        else if (item.label.includes("Rapide")) barColor = [34, 197, 94]; // green
        else if (item.label.includes("Lent") && !item.label.includes("Tres lent")) barColor = [249, 115, 22]; // orange
        else barColor = [239, 68, 68]; // red
        
        pdf.setFillColor(...barColor);
        if (barWidth > 0) {
          pdf.roundedRect(margin + 55, yPos, barWidth, barHeight, 2, 2, "F");
        }

        // Count
        pdf.setTextColor(...mutedColor);
        const percent = totalRestaurants > 0 ? Math.round((item.count / totalRestaurants) * 100) : 0;
        pdf.text(`${item.count} (${percent}%)`, margin + 60 + barWidth, yPos + 5);

        yPos += barHeight + 4;
      });

      // =====================
      // PAGES 2+ - DETAILED TABLE
      // =====================
      pdf.addPage();

      const rowsPerPage = 30;
      const headerHeight = 12;
      const rowHeight = 8;

      const drawTableHeader = (y: number) => {
        pdf.setFillColor(...primaryColor);
        pdf.rect(margin, y, contentWidth, headerHeight, "F");

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text("#", margin + 5, y + 8);
        pdf.text("Restaurant", margin + 20, y + 8);
        pdf.text("Temps", margin + 115, y + 8);
        pdf.text("Commandes", margin + 140, y + 8);
        pdf.text("Statut", margin + 165, y + 8);

        return y + headerHeight;
      };

      const drawPageHeader = () => {
        pdf.setFillColor(...primaryColor);
        pdf.rect(0, 0, pageWidth, 20, "F");

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Rapport Temps Prepa + Livraison", margin, 13);

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(data.periodLabel, pageWidth - margin, 13, { align: "right" });
      };

      const drawPageFooter = (pageNum: number, totalPages: number) => {
        pdf.setTextColor(...mutedColor);
        pdf.setFontSize(8);
        pdf.text(
          `Page ${pageNum} / ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      };

      // Calculate total pages for detailed table
      const totalDetailPages = Math.ceil(data.restaurants.length / rowsPerPage);
      let currentPage = 2;

      for (let pageIdx = 0; pageIdx < totalDetailPages; pageIdx++) {
        if (pageIdx > 0) {
          pdf.addPage();
        }

        drawPageHeader();

        let yPos = 30;
        
        if (pageIdx === 0) {
          pdf.setTextColor(...textColor);
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.text("Classement detaille", margin, yPos);
          yPos += 10;
        }

        yPos = drawTableHeader(yPos);

        const startIdx = pageIdx * rowsPerPage;
        const endIdx = Math.min(startIdx + rowsPerPage, data.restaurants.length);
        const pageData = data.restaurants.slice(startIdx, endIdx);

        pageData.forEach((item, idx) => {
          // Alternating row background
          if (idx % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, yPos, contentWidth, rowHeight, "F");
          }

          pdf.setTextColor(...textColor);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");

          pdf.text(`${item.rank}`, margin + 5, yPos + 5.5);
          
          // Truncate name if too long
          const name = item.name.length > 28 ? item.name.substring(0, 26) + "..." : item.name;
          pdf.text(name, margin + 20, yPos + 5.5);
          
          pdf.setFont("helvetica", "bold");
          pdf.text(formatMinutesToDisplay(item.avgTotalTime), margin + 115, yPos + 5.5);
          
          pdf.setFont("helvetica", "normal");
          pdf.text(item.orderCount.toString(), margin + 140, yPos + 5.5);

          // Status with color based on objective
          const [r, g, b] = getStatusColor(item.avgTotalTime, data.objective);
          pdf.setTextColor(r, g, b);
          pdf.text(getStatusLabel(item.avgTotalTime, data.objective), margin + 165, yPos + 5.5);

          yPos += rowHeight;
        });

        drawPageFooter(currentPage, totalDetailPages + 1);
        currentPage++;
      }

      // Save PDF
      const fileName = `rapport-temps-livraison-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error("Erreur export PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportToPDF, isExporting };
};
