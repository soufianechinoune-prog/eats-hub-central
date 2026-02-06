import { useState } from "react";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface RestaurantRating {
  rank: number;
  name: string;
  avgRating: number;
  totalReviews: number;
}

interface RatingsExportData {
  periodLabel: string;
  globalStats: {
    avgRating: number;
    totalReviews: number;
    uberAvg: number;
    uberCount: number;
    deliverooAvg: number;
    deliverooCount: number;
  };
  distribution: { star: string; count: number }[];
  restaurants: RestaurantRating[];
}

const getStatusLabel = (rating: number): string => {
  if (rating >= 4.7) return "Excellent";
  if (rating >= 4.5) return "Très bien";
  if (rating >= 4.2) return "Bon";
  return "À surveiller";
};

const getStatusColor = (rating: number): [number, number, number] => {
  if (rating >= 4.7) return [16, 185, 129]; // emerald-500
  if (rating >= 4.5) return [34, 197, 94]; // green-500
  if (rating >= 4.2) return [245, 158, 11]; // amber-500
  return [239, 68, 68]; // red-500
};

// Helper to format numbers without non-breaking spaces (jsPDF doesn't render \u00A0 correctly)
const formatNumber = (num: number): string => {
  // jsPDF has issues with any space character in large fonts, so we use no separator
  // and just output the raw number for clean rendering
  return num.toString();
};

export const useRatingsExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async (data: RatingsExportData) => {
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

      // Colors
      const primaryColor: [number, number, number] = [16, 185, 129]; // emerald
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
      pdf.text("Rapport Notes Réseau", margin, 35);

      // Subtitle
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Période : ${data.periodLabel}`, margin, 48);

      // Generation date
      pdf.setFontSize(10);
      pdf.text(
        `Généré le ${format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`,
        pageWidth - margin,
        48,
        { align: "right" }
      );

      // KPIs Section
      let yPos = 80;

      pdf.setTextColor(...textColor);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Indicateurs clés", margin, yPos);

      yPos += 15;

      // KPI Cards
      const kpiCardWidth = (contentWidth - 10) / 2;
      const kpiCardHeight = 35;

      const drawKPICard = (x: number, y: number, label: string, value: string, subtext?: string) => {
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(x, y, kpiCardWidth, kpiCardHeight, 3, 3, "F");
        
        pdf.setTextColor(...mutedColor);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(label, x + 8, y + 12);
        
        pdf.setTextColor(...textColor);
        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        pdf.text(value, x + 8, y + 26);

        if (subtext) {
          pdf.setTextColor(...mutedColor);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.text(subtext, x + kpiCardWidth - 8, y + 26, { align: "right" });
        }
      };

      drawKPICard(margin, yPos, "Note moyenne globale", `${data.globalStats.avgRating.toFixed(2)} / 5`);
      drawKPICard(margin + kpiCardWidth + 10, yPos, "Total avis", formatNumber(data.globalStats.totalReviews));

      yPos += kpiCardHeight + 10;

      if (data.globalStats.uberCount > 0) {
        drawKPICard(margin, yPos, "Uber Eats", `${data.globalStats.uberAvg.toFixed(2)} / 5`, `${formatNumber(data.globalStats.uberCount)} avis`);
      }
      
      if (data.globalStats.deliverooCount > 0) {
        drawKPICard(margin + kpiCardWidth + 10, yPos, "Deliveroo", `${data.globalStats.deliverooAvg.toFixed(2)} / 5`, `${formatNumber(data.globalStats.deliverooCount)} avis`);
      }

      yPos += kpiCardHeight + 25;

      // Distribution section
      pdf.setTextColor(...textColor);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Distribution des notes", margin, yPos);

      yPos += 12;

      const maxCount = Math.max(...data.distribution.map(d => d.count));
      const barHeight = 12;
      const barMaxWidth = contentWidth - 50;

      data.distribution.reverse().forEach((item) => {
        const barWidth = maxCount > 0 ? (item.count / maxCount) * barMaxWidth : 0;
        
        // Label
        pdf.setTextColor(...textColor);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(item.star, margin, yPos + 8);

        // Bar
        const starNum = parseInt(item.star);
        const barColor: [number, number, number] = starNum >= 4 
          ? [16, 185, 129] 
          : starNum >= 3 
            ? [245, 158, 11] 
            : [239, 68, 68];
        
        pdf.setFillColor(...barColor);
        pdf.roundedRect(margin + 25, yPos, barWidth, barHeight, 2, 2, "F");

        // Count
        pdf.setTextColor(...mutedColor);
        pdf.text(formatNumber(item.count), margin + 30 + barWidth, yPos + 8);

        yPos += barHeight + 5;
      });

      yPos += 15;

      // Top 5 / Flop 5
      pdf.setTextColor(...textColor);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Top 5 & À surveiller", margin, yPos);

      yPos += 12;

      const top5 = data.restaurants.slice(0, 5);
      const flop5 = data.restaurants.slice(-5).reverse();

      const drawMiniTable = (title: string, items: RestaurantRating[], startY: number, isTop: boolean) => {
        pdf.setFillColor(isTop ? 236 : 254, isTop ? 253 : 242, isTop ? 245 : 242);
        pdf.roundedRect(margin, startY, contentWidth, 8 + items.length * 10, 3, 3, "F");

        pdf.setTextColor(isTop ? 16 : 239, isTop ? 185 : 68, isTop ? 129 : 68);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, margin + 5, startY + 6);

        let itemY = startY + 14;
        items.forEach((item) => {
          pdf.setTextColor(...textColor);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.text(`#${item.rank}`, margin + 5, itemY);
          pdf.text(item.name, margin + 20, itemY);
          pdf.text(`${item.avgRating.toFixed(2)}`, margin + contentWidth - 40, itemY);
          pdf.setTextColor(...mutedColor);
          pdf.text(`(${formatNumber(item.totalReviews)} avis)`, margin + contentWidth - 20, itemY);
          itemY += 10;
        });

        return startY + 12 + items.length * 10;
      };

      yPos = drawMiniTable("🏆 Top 5", top5, yPos, true);
      yPos += 5;
      drawMiniTable("⚠️ À surveiller", flop5, yPos, false);

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
        pdf.text("Note", margin + 120, y + 8);
        pdf.text("Avis", margin + 145, y + 8);
        pdf.text("Statut", margin + 165, y + 8);

        return y + headerHeight;
      };

      const drawPageHeader = () => {
        pdf.setFillColor(...primaryColor);
        pdf.rect(0, 0, pageWidth, 20, "F");

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Rapport Notes Réseau", margin, 13);

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
          pdf.text("Classement détaillé", margin, yPos);
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
          const name = item.name.length > 30 ? item.name.substring(0, 28) + "..." : item.name;
          pdf.text(name, margin + 20, yPos + 5.5);
          
          pdf.setFont("helvetica", "bold");
          pdf.text(item.avgRating.toFixed(2), margin + 120, yPos + 5.5);
          
          pdf.setFont("helvetica", "normal");
          pdf.text(item.totalReviews.toString(), margin + 145, yPos + 5.5);

          // Status with color
          const [r, g, b] = getStatusColor(item.avgRating);
          pdf.setTextColor(r, g, b);
          pdf.text(getStatusLabel(item.avgRating), margin + 165, yPos + 5.5);

          yPos += rowHeight;
        });

        drawPageFooter(currentPage, totalDetailPages + 1);
        currentPage++;
      }

      // Save PDF
      const fileName = `rapport-notes-reseau-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error("Erreur export PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportToPDF, isExporting };
};
