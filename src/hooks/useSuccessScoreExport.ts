import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx-js-style";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SuccessScoreData {
  restaurantName: string;
  scoreTier: string;
  operationalExcellence: number | null;
  ratings: number | null;
  menuDetails: number | null;
  sustainablePackaging: number | null;
}

interface NetworkStats {
  avgOperationalExcellence: number | null;
  avgRatings: number | null;
  avgMenuDetails: number | null;
  avgSustainablePackaging: number | null;
  totalRestaurants: number;
  latestMonth: string | null;
  tierCounts: {
    Excellent: number;
    Great: number;
    Good: number;
    Fair: number;
    Poor: number;
  };
}

interface ExportParams {
  scores: SuccessScoreData[];
  networkStats: NetworkStats;
}

const TIER_LABELS: Record<string, string> = {
  Excellent: "Excellent",
  Great: "Très Bon",
  Good: "Bon",
  Fair: "Correct",
  Poor: "Insuffisant",
};

export function useSuccessScoreExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = useCallback(({ scores, networkStats }: ExportParams) => {
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
      let yPos = margin;

      // Header
      pdf.setFillColor(16, 185, 129); // emerald-500
      pdf.rect(0, 0, pageWidth, 25, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Score de Réussite Uber Eats", margin, 16);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const monthLabel = networkStats.latestMonth 
        ? format(new Date(networkStats.latestMonth), "MMMM yyyy", { locale: fr })
        : "Période non définie";
      pdf.text(monthLabel, pageWidth - margin - pdf.getTextWidth(monthLabel), 16);

      yPos = 35;
      pdf.setTextColor(0, 0, 0);

      // Network KPIs
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Indicateurs Réseau", margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      const kpis = [
        { label: "Restaurants", value: `${networkStats.totalRestaurants}` },
        { label: "Excellence Op.", value: networkStats.avgOperationalExcellence != null ? `${networkStats.avgOperationalExcellence.toFixed(1)}%` : "—" },
        { label: "Notes", value: networkStats.avgRatings != null ? networkStats.avgRatings.toFixed(2) : "—" },
        { label: "Détails Menu", value: networkStats.avgMenuDetails != null ? `${networkStats.avgMenuDetails.toFixed(0)}%` : "—" },
        { label: "Emballages", value: networkStats.avgSustainablePackaging != null ? `${networkStats.avgSustainablePackaging.toFixed(0)}%` : "—" },
      ];

      const kpiWidth = (pageWidth - 2 * margin) / kpis.length;
      kpis.forEach((kpi, idx) => {
        const x = margin + idx * kpiWidth;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text(kpi.label, x, yPos);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text(kpi.value, x, yPos + 5);
      });

      yPos += 15;

      // Tier distribution
      pdf.setFont("helvetica", "bold");
      pdf.text("Répartition par niveau", margin, yPos);
      yPos += 6;

      const tierColors: Record<string, [number, number, number]> = {
        Excellent: [16, 185, 129],
        Great: [59, 130, 246],
        Good: [245, 158, 11],
        Fair: [249, 115, 22],
        Poor: [239, 68, 68],
      };

      pdf.setFontSize(9);
      const tierWidth = (pageWidth - 2 * margin) / 5;
      Object.entries(networkStats.tierCounts).forEach(([tier, count], idx) => {
        const x = margin + idx * tierWidth;
        const color = tierColors[tier] || [100, 100, 100];
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.roundedRect(x, yPos, tierWidth - 4, 12, 2, 2, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.text(`${TIER_LABELS[tier]}: ${count}`, x + 3, yPos + 8);
      });

      yPos += 22;
      pdf.setTextColor(0, 0, 0);

      // Table
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Détail par Restaurant", margin, yPos);
      yPos += 8;

      const headers = ["Restaurant", "Score", "Excellence Op.", "Notes", "Détails Menu", "Emballages"];
      const colWidths = [80, 30, 35, 25, 35, 30];
      
      // Header row
      pdf.setFillColor(16, 185, 129);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");

      let xPos = margin;
      headers.forEach((header, idx) => {
        pdf.text(header, xPos + 2, yPos + 5.5);
        xPos += colWidths[idx];
      });

      yPos += 8;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");

      // Data rows
      scores.forEach((score, rowIdx) => {
        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = margin;
        }

        const bgColor = rowIdx % 2 === 0 ? 249 : 255;
        pdf.setFillColor(bgColor, bgColor, bgColor);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, "F");

        xPos = margin;
        const row = [
          score.restaurantName,
          TIER_LABELS[score.scoreTier] || score.scoreTier,
          score.operationalExcellence != null ? `${score.operationalExcellence.toFixed(1)}%` : "—",
          score.ratings != null ? score.ratings.toFixed(2) : "—",
          score.menuDetails != null ? `${score.menuDetails.toFixed(0)}%` : "—",
          score.sustainablePackaging != null ? `${score.sustainablePackaging.toFixed(0)}%` : "—",
        ];

        row.forEach((cell, idx) => {
          const text = cell.length > 35 ? cell.substring(0, 32) + "..." : cell;
          pdf.text(text, xPos + 2, yPos + 5);
          xPos += colWidths[idx];
        });

        yPos += 7;
      });

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`,
        margin,
        pageHeight - 8
      );

      pdf.save(`score_reussite_${monthLabel.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportToExcel = useCallback(({ scores, networkStats }: ExportParams) => {
    setIsExporting(true);

    try {
      const workbook = XLSX.utils.book_new();
      const monthLabel = networkStats.latestMonth 
        ? format(new Date(networkStats.latestMonth), "MMMM yyyy", { locale: fr })
        : "Période non définie";

      // Styles
      const headerStyle = {
        fill: { fgColor: { rgb: "10B981" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center" as const },
      };
      const centerStyle = { alignment: { horizontal: "center" as const } };
      const altRowStyle = { fill: { fgColor: { rgb: "F9FAFB" } } };

      // Summary sheet
      const summaryData = [
        ["Score de Réussite Uber Eats"],
        ["Période", monthLabel],
        ["Généré le", format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr })],
        [],
        ["Indicateurs Réseau"],
        ["Nombre de restaurants", networkStats.totalRestaurants],
        ["Excellence Opérationnelle moyenne", networkStats.avgOperationalExcellence != null ? `${networkStats.avgOperationalExcellence.toFixed(1)}%` : "—"],
        ["Notes moyennes", networkStats.avgRatings != null ? networkStats.avgRatings.toFixed(2) : "—"],
        ["Détails Menu moyenne", networkStats.avgMenuDetails != null ? `${networkStats.avgMenuDetails.toFixed(0)}%` : "—"],
        ["Emballages Durables moyenne", networkStats.avgSustainablePackaging != null ? `${networkStats.avgSustainablePackaging.toFixed(0)}%` : "—"],
        [],
        ["Répartition par niveau"],
        ["Excellent", networkStats.tierCounts.Excellent],
        ["Très Bon", networkStats.tierCounts.Great],
        ["Bon", networkStats.tierCounts.Good],
        ["Correct", networkStats.tierCounts.Fair],
        ["Insuffisant", networkStats.tierCounts.Poor],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 30 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Résumé");

      // Detail sheet
      const headers = ["Restaurant", "Score", "Excellence Op. (%)", "Notes", "Détails Menu (%)", "Emballages (%)"];
      const dataRows = scores.map((score) => [
        score.restaurantName,
        TIER_LABELS[score.scoreTier] || score.scoreTier,
        score.operationalExcellence != null ? score.operationalExcellence.toFixed(1) : "—",
        score.ratings != null ? score.ratings.toFixed(2) : "—",
        score.menuDetails != null ? score.menuDetails.toFixed(0) : "—",
        score.sustainablePackaging != null ? score.sustainablePackaging.toFixed(0) : "—",
      ]);

      const detailSheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      
      // Apply styles
      headers.forEach((_, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
        if (detailSheet[cellRef]) {
          detailSheet[cellRef].s = headerStyle;
        }
      });

      dataRows.forEach((_, rowIdx) => {
        headers.forEach((_, colIdx) => {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
          if (detailSheet[cellRef]) {
            detailSheet[cellRef].s = colIdx > 0 ? { ...centerStyle, ...(rowIdx % 2 === 0 ? altRowStyle : {}) } : (rowIdx % 2 === 0 ? altRowStyle : {});
          }
        });
      });

      detailSheet["!cols"] = [{ wch: 40 }, { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, detailSheet, "Détail");

      XLSX.writeFile(workbook, `score_reussite_${monthLabel.replace(/\s+/g, "_")}.xlsx`);
    } catch (error) {
      console.error("Error exporting Excel:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToPdf, exportToExcel, isExporting };
}
