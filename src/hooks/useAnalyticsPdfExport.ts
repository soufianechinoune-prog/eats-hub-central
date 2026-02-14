import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface ExportOptions {
  title: string;
  subtitle: string;
  period: string;
  restaurants: string;
  platform: string;
}

export function useAnalyticsPdfExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = useCallback(async (
    contentRef: HTMLElement | null,
    options: ExportOptions
  ) => {
    if (!contentRef) return;

    setIsExporting(true);

    try {
      const canvas = await html2canvas(contentRef, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.75);
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const headerHeight = 42;
      const footerHeight = 12;

      // Image dimensions scaled to page width
      const contentWidth = pageWidth - margin * 2;
      const scaledImgHeight = (canvas.height * contentWidth) / canvas.width;

      // Calculate pagination
      const firstPageContentHeight = pageHeight - headerHeight - footerHeight;
      const normalPageContentHeight = pageHeight - margin - footerHeight;
      const totalPages = Math.max(1, 1 + Math.ceil(Math.max(0, scaledImgHeight - firstPageContentHeight) / normalPageContentHeight));

      const drawFooter = (page: number) => {
        pdf.setDrawColor(229, 231, 235);
        pdf.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(156, 163, 175);
        pdf.text("CS Delivery Performance - Rapport Analytics", margin, pageHeight - 4);
        const pageText = `Page ${page}/${totalPages}`;
        pdf.text(pageText, pageWidth - margin - pdf.getTextWidth(pageText), pageHeight - 4);
      };

      // --- Page 1: Header + start of content ---
      // Header bar
      pdf.setFillColor(16, 185, 129);
      pdf.rect(0, 0, pageWidth, 25, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(options.title, margin, 12);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(options.subtitle, margin, 19);
      pdf.text(options.platform, pageWidth - margin - pdf.getTextWidth(options.platform), 12);

      // Meta bar
      pdf.setFillColor(249, 250, 251);
      pdf.rect(0, 25, pageWidth, 12, "F");
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Periode: ${options.period}`, margin, 32);
      pdf.text(`Restaurants: ${options.restaurants}`, pageWidth / 2, 32);
      const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
      pdf.text(`Genere le ${dateStr}`, pageWidth - margin - pdf.getTextWidth(`Genere le ${dateStr}`), 32);

      // Slice and render image across pages
      let yOffset = 0; // how much of the image has been placed

      for (let page = 1; page <= totalPages; page++) {
        const startY = page === 1 ? headerHeight : margin;
        const availableHeight = page === 1 ? firstPageContentHeight : normalPageContentHeight;
        const sliceHeight = Math.min(availableHeight, scaledImgHeight - yOffset);

        if (sliceHeight > 0) {
          // We place the full image but clip it via positioning
          // addImage with negative y to shift already-rendered content above the visible area
          pdf.addImage(
            imgData, "JPEG",
            margin, startY - yOffset,
            contentWidth, scaledImgHeight
          );
        }

        drawFooter(page);
        yOffset += availableHeight;

        if (page < totalPages) {
          pdf.addPage();
        }
      }

      const filename = `analytics_${options.platform.toLowerCase().replace(/\s+/g, "_")}_${options.period.replace(/\s+/g, "_")}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToPdf, isExporting };
}
