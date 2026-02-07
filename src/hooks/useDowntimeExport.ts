import { useState } from "react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx-js-style";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { extractCityName } from "@/lib/restaurantUtils";

interface RestaurantStat {
  id: string;
  name: string;
  totalOfflineMinutes: number;
  availabilityRate: number;
  hourlyData?: Record<number, number>;
  weekdayData?: Record<number, number>;
  dailyData?: Record<string, number>;
}

interface ExportData {
  title: string;
  period: string;
  dateRange: { start: Date; end: Date };
  stats: RestaurantStat[];
  insights: {
    bestPerformer: { name: string; downtime: number };
    worstPerformer: { name: string; downtime: number };
    totalDowntime: number;
    avgAvailability: number;
    perfectCount: number;
  };
}

const formatMinutesToDisplay = (minutes: number): string => {
  if (minutes === 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export const useDowntimeExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = async (data: ExportData) => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Build restaurant page mapping (page 2 = first restaurant, etc.)
      const restaurantPages: Record<string, number> = {};
      data.stats.forEach((stat, index) => {
        restaurantPages[stat.id] = index + 2; // Page 1 is summary
      });

      // ============ PAGE 1: SUMMARY ============
      // Header
      doc.setFillColor(16, 185, 129); // Emerald
      doc.rect(0, 0, pageWidth, 35, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Comparaison Temps d'inactivite", margin, 18);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`${data.stats.length} restaurants | ${data.period}`, margin, 28);

      const exportDate = format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr });
      doc.setFontSize(9);
      doc.text(`Export: ${exportDate}`, pageWidth - margin, 28, { align: "right" });

      yPos = 50;

      // KPI Summary Cards
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Resume du reseau", margin, yPos);
      yPos += 10;

      const kpiWidth = (pageWidth - margin * 2 - 15) / 4;
      const kpiHeight = 22;

      const kpis = [
        {
          label: "Disponibilite moyenne",
          value: `${data.insights.avgAvailability.toFixed(1)}%`,
          color: data.insights.avgAvailability >= 99 ? [16, 185, 129] : data.insights.avgAvailability >= 95 ? [245, 158, 11] : [239, 68, 68],
        },
        {
          label: "Restaurants 100%",
          value: `${data.insights.perfectCount}`,
          color: [16, 185, 129],
        },
        {
          label: "Inactivite totale",
          value: formatMinutesToDisplay(data.insights.totalDowntime),
          color: [239, 68, 68],
        },
        {
          label: "Ecart max",
          value: formatMinutesToDisplay(data.insights.worstPerformer.downtime - data.insights.bestPerformer.downtime),
          color: [59, 130, 246],
        },
      ];

      kpis.forEach((kpi, index) => {
        const x = margin + index * (kpiWidth + 5);
        doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.roundedRect(x, yPos, kpiWidth, kpiHeight, 2, 2, "F");
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(kpi.label, x + 4, yPos + 7);
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(kpi.value, x + 4, yPos + 17);
      });

      yPos += kpiHeight + 15;

      // Table Header
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Classement par disponibilite", margin, yPos);
      
      // Clickable hint
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text("Cliquez sur un restaurant pour voir le detail journalier", margin, yPos + 5);
      yPos += 12;

      // Table
      const colWidths = [10, 70, 45, 55];
      const rowHeight = 8;
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const tableX = margin;

      // Table header
      doc.setFillColor(16, 185, 129);
      doc.rect(tableX, yPos, tableWidth, rowHeight, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");

      let colX = tableX + 3;
      doc.text("#", colX, yPos + 5.5);
      colX += colWidths[0];
      doc.text("Restaurant", colX, yPos + 5.5);
      colX += colWidths[1];
      doc.text("Disponibilite", colX, yPos + 5.5);
      colX += colWidths[2];
      doc.text("Temps hors ligne", colX, yPos + 5.5);

      yPos += rowHeight;

      // Table rows
      doc.setFont("helvetica", "normal");
      data.stats.forEach((stat, index) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
        }

        // Alternate row colors
        if (index % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(tableX, yPos, tableWidth, rowHeight, "F");
        }

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);

        colX = tableX + 3;
        doc.text((index + 1).toString(), colX, yPos + 5.5);
        colX += colWidths[0];
        
        // Restaurant name - clickable link (blue)
        const cityName = extractCityName(stat.name);
        const targetPage = restaurantPages[stat.id];
        doc.setTextColor(37, 99, 235); // Blue for link
        doc.setFont("helvetica", "bold");
        doc.text(cityName.substring(0, 35), colX, yPos + 5.5);
        // Add internal link to detail page
        doc.link(colX - 2, yPos, colWidths[1], rowHeight, { pageNumber: targetPage });
        
        colX += colWidths[1];

        // Color code availability
        if (stat.availabilityRate >= 99) {
          doc.setTextColor(16, 185, 129);
        } else if (stat.availabilityRate >= 95) {
          doc.setTextColor(245, 158, 11);
        } else {
          doc.setTextColor(239, 68, 68);
        }
        doc.text(`${stat.availabilityRate.toFixed(1)}%`, colX, yPos + 5.5);
        colX += colWidths[2];

        doc.setTextColor(107, 114, 128);
        doc.setFont("helvetica", "normal");
        doc.text(formatMinutesToDisplay(stat.totalOfflineMinutes), colX, yPos + 5.5);

        yPos += rowHeight;
      });

      // Footer on page 1
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Genere par CS Delivery Performance - ${exportDate}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );

      // ============ DETAIL PAGES: One per restaurant ============
      data.stats.forEach((stat) => {
        doc.addPage();
        let detailY = margin;

        // Header with restaurant info
        doc.setFillColor(16, 185, 129);
        doc.rect(0, 0, pageWidth, 30, "F");

        // Restaurant name
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(extractCityName(stat.name), margin, 14);

        // Stats summary
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Disponibilite: ${stat.availabilityRate.toFixed(1)}% | Hors ligne: ${formatMinutesToDisplay(stat.totalOfflineMinutes)}`, margin, 23);

        // Back link
        doc.setFontSize(9);
        doc.text("<- Retour synthese", pageWidth - margin - 35, 14);
        doc.link(pageWidth - margin - 40, 6, 45, 12, { pageNumber: 1 });

        // Period
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(data.period, pageWidth - margin, 23, { align: "right" });

        detailY = 40;

        // Daily breakdown table
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Detail journalier", margin, detailY);
        detailY += 8;

        const dailyEntries = Object.entries(stat.dailyData || {}).sort(([a], [b]) => a.localeCompare(b));

        if (dailyEntries.length === 0) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(107, 114, 128);
          doc.text("Aucune donnee disponible pour cette periode", margin, detailY + 10);
        } else {
          // Table header
          const detailColWidths = [35, 50, 40, 55];
          const detailTableWidth = detailColWidths.reduce((a, b) => a + b, 0);

          doc.setFillColor(16, 185, 129);
          doc.rect(margin, detailY, detailTableWidth, 8, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");

          let dColX = margin + 3;
          doc.text("Date", dColX, detailY + 5.5);
          dColX += detailColWidths[0];
          doc.text("Jour", dColX, detailY + 5.5);
          dColX += detailColWidths[1];
          doc.text("Temps offline", dColX, detailY + 5.5);
          dColX += detailColWidths[2];
          doc.text("Statut", dColX, detailY + 5.5);

          detailY += 8;

          // Daily rows
          dailyEntries.forEach(([dateStr, minutes], idx) => {
            if (detailY > pageHeight - 20) {
              doc.addPage();
              detailY = margin;
              
              // Repeat header on new page
              doc.setFillColor(16, 185, 129);
              doc.rect(margin, detailY, detailTableWidth, 8, "F");
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(9);
              doc.setFont("helvetica", "bold");
              
              let repColX = margin + 3;
              doc.text("Date", repColX, detailY + 5.5);
              repColX += detailColWidths[0];
              doc.text("Jour", repColX, detailY + 5.5);
              repColX += detailColWidths[1];
              doc.text("Temps offline", repColX, detailY + 5.5);
              repColX += detailColWidths[2];
              doc.text("Statut", repColX, detailY + 5.5);
              
              detailY += 8;
            }

            // Alternate row colors
            if (idx % 2 === 0) {
              doc.setFillColor(249, 250, 251);
              doc.rect(margin, detailY, detailTableWidth, 7, "F");
            }

            const dateObj = parseISO(dateStr);
            const dayName = format(dateObj, "EEEE", { locale: fr });

            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");

            dColX = margin + 3;
            doc.setTextColor(0, 0, 0);
            doc.text(format(dateObj, "dd/MM/yyyy"), dColX, detailY + 5);
            dColX += detailColWidths[0];

            doc.setTextColor(107, 114, 128);
            doc.text(dayName.charAt(0).toUpperCase() + dayName.slice(1), dColX, detailY + 5);
            dColX += detailColWidths[1];

            // Color based on offline time
            if (minutes === 0) {
              doc.setTextColor(16, 185, 129); // Green
            } else if (minutes < 30) {
              doc.setTextColor(245, 158, 11); // Orange
            } else {
              doc.setTextColor(239, 68, 68); // Red
            }
            doc.setFont("helvetica", "bold");
            doc.text(formatMinutesToDisplay(minutes), dColX, detailY + 5);
            dColX += detailColWidths[2];

            // Status text
            let status = "OK";
            if (minutes > 0 && minutes < 30) {
              status = "Attention";
            } else if (minutes >= 30) {
              status = "Critique";
            }
            doc.text(status, dColX, detailY + 5);

            detailY += 7;
          });
        }

        // Footer on detail page
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.setFont("helvetica", "normal");
        doc.text(
          `${extractCityName(stat.name)} - CS Delivery Performance`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      });

      const fileName = `downtime-comparison-${format(data.dateRange.start, "yyyyMMdd")}-${format(data.dateRange.end, "yyyyMMdd")}.pdf`;
      doc.save(fileName);
    } finally {
      setIsExporting(false);
    }
  };

  const exportExcel = async (data: ExportData) => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Header style
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "10B981" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
      };

      // Data style
      const dataStyle = {
        alignment: { vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
      };

      const altRowStyle = {
        ...dataStyle,
        fill: { fgColor: { rgb: "F9FAFB" } },
      };

      // Summary sheet
      const summaryData = [
        ["Comparaison Temps d'inactivite"],
        [""],
        ["Periode", data.period],
        ["Date debut", format(data.dateRange.start, "dd/MM/yyyy", { locale: fr })],
        ["Date fin", format(data.dateRange.end, "dd/MM/yyyy", { locale: fr })],
        ["Nombre de restaurants", data.stats.length],
        [""],
        ["Resume"],
        ["Disponibilite moyenne", `${data.insights.avgAvailability.toFixed(1)}%`],
        ["Restaurants a 100%", data.insights.perfectCount],
        ["Inactivite totale reseau", formatMinutesToDisplay(data.insights.totalDowntime)],
        ["Meilleur performer", extractCityName(data.insights.bestPerformer.name)],
        ["A surveiller", extractCityName(data.insights.worstPerformer.name)],
      ];

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs["!cols"] = [{ wch: 25 }, { wch: 30 }];
      
      // Style summary
      summaryWs["A1"] = { v: summaryData[0][0], s: { font: { bold: true, sz: 16 } } };
      summaryWs["A8"] = { v: "Resume", s: { font: { bold: true, sz: 12 } } };

      XLSX.utils.book_append_sheet(wb, summaryWs, "Resume");

      // Detail sheet
      const detailHeaders = ["#", "Restaurant", "Ville", "Disponibilite (%)", "Temps hors ligne", "Statut"];
      const detailData = data.stats.map((stat, index) => [
        index + 1,
        stat.name,
        extractCityName(stat.name),
        stat.availabilityRate.toFixed(1),
        formatMinutesToDisplay(stat.totalOfflineMinutes),
        stat.availabilityRate >= 99 ? "Excellent" : stat.availabilityRate >= 95 ? "Bon" : "A surveiller",
      ]);

      const detailWs = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailData]);
      detailWs["!cols"] = [
        { wch: 5 },
        { wch: 40 },
        { wch: 20 },
        { wch: 15 },
        { wch: 18 },
        { wch: 12 },
      ];

      // Style header row
      detailHeaders.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
        if (detailWs[cellRef]) {
          detailWs[cellRef].s = headerStyle;
        }
      });

      // Style data rows
      detailData.forEach((row, rowIndex) => {
        row.forEach((_, colIndex) => {
          const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
          if (detailWs[cellRef]) {
            detailWs[cellRef].s = rowIndex % 2 === 0 ? altRowStyle : dataStyle;
          }
        });
      });

      XLSX.utils.book_append_sheet(wb, detailWs, "Detail");

      // Hourly analysis sheet (if data available)
      if (data.stats.some(s => s.hourlyData)) {
        const hours = Array.from({ length: 24 }, (_, i) => `${i}h`);
        const hourlyHeaders = ["Restaurant", ...hours];
        const hourlyData = data.stats.map(stat => {
          const hourValues = hours.map((_, i) => 
            stat.hourlyData?.[i] ? formatMinutesToDisplay(stat.hourlyData[i]) : "0min"
          );
          return [extractCityName(stat.name), ...hourValues];
        });

        const hourlyWs = XLSX.utils.aoa_to_sheet([hourlyHeaders, ...hourlyData]);
        hourlyWs["!cols"] = [
          { wch: 20 },
          ...hours.map(() => ({ wch: 8 })),
        ];

        // Style header
        hourlyHeaders.forEach((_, colIndex) => {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
          if (hourlyWs[cellRef]) {
            hourlyWs[cellRef].s = headerStyle;
          }
        });

        XLSX.utils.book_append_sheet(wb, hourlyWs, "Par heure");
      }

      // Daily breakdown sheet
      if (data.stats.some(s => s.dailyData && Object.keys(s.dailyData).length > 0)) {
        // Collect all dates
        const allDates = new Set<string>();
        data.stats.forEach(stat => {
          Object.keys(stat.dailyData || {}).forEach(d => allDates.add(d));
        });
        const sortedDates = Array.from(allDates).sort();

        const dailyHeaders = ["Restaurant", ...sortedDates.map(d => format(parseISO(d), "dd/MM"))];
        const dailyRows = data.stats.map(stat => {
          const values = sortedDates.map(d => 
            stat.dailyData?.[d] !== undefined ? formatMinutesToDisplay(stat.dailyData[d]) : "-"
          );
          return [extractCityName(stat.name), ...values];
        });

        const dailyWs = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]);
        dailyWs["!cols"] = [
          { wch: 20 },
          ...sortedDates.map(() => ({ wch: 10 })),
        ];

        // Style header
        dailyHeaders.forEach((_, colIndex) => {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
          if (dailyWs[cellRef]) {
            dailyWs[cellRef].s = headerStyle;
          }
        });

        XLSX.utils.book_append_sheet(wb, dailyWs, "Par jour");
      }

      const fileName = `downtime-comparison-${format(data.dateRange.start, "yyyyMMdd")}-${format(data.dateRange.end, "yyyyMMdd")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportPdf,
    exportExcel,
    isExporting,
  };
};
