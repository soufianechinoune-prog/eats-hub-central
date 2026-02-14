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
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const headerHeight = 48; // 25mm header bar + 18mm meta bar + 5mm spacing
      const footerHeight = 12;

      // Image dimensions scaled to page width
      const contentWidth = pageWidth - margin * 2;
      const scaledImgHeight = (canvas.height * contentWidth) / canvas.width;

      // Calculate pagination
      const firstPageContentHeight = pageHeight - headerHeight - footerHeight;
      const normalPageContentHeight = pageHeight - margin - footerHeight;
      const totalPages = Math.max(1, 1 + Math.ceil(Math.max(0, scaledImgHeight - firstPageContentHeight) / normalPageContentHeight));

      // Helper: slice canvas into a page-sized chunk and return JPEG data
      const sliceCanvas = (srcCanvas: HTMLCanvasElement, srcYPx: number, srcHeightPx: number): string => {
        const slice = document.createElement("canvas");
        slice.width = srcCanvas.width;
        slice.height = Math.min(srcHeightPx, srcCanvas.height - srcYPx);
        const ctx = slice.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(
            srcCanvas,
            0, srcYPx, srcCanvas.width, slice.height,
            0, 0, slice.width, slice.height
          );
        }
        return slice.toDataURL("image/jpeg", 0.80);
      };

      const drawFooter = (page: number) => {
        pdf.setDrawColor(229, 231, 235);
        pdf.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(156, 163, 175);
        pdf.text("CS Delivery Performance - Rapport Analytics", margin, pageHeight - 4);
        const pageText = `Page ${page}/${totalPages}`;
        pdf.text(pageText, pageWidth - margin - pdf.getTextWidth(pageText), pageHeight - 4);
      };

      // Ratio: mm to canvas pixels
      const pxPerMm = canvas.width / contentWidth;

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

      // Meta bar - 2 lines
      pdf.setFillColor(249, 250, 251);
      pdf.rect(0, 25, pageWidth, 18, "F");
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      // Line 1: Period + Platform
      pdf.text(`Periode: ${options.period}`, margin, 32);
      pdf.text(`Plateforme: ${options.platform}`, pageWidth / 2, 32);
      // Line 2: Restaurants + Date
      const restaurantsText = options.restaurants.length > 60 
        ? options.restaurants.substring(0, 60) + "..." 
        : options.restaurants;
      pdf.text(`Restaurants: ${restaurantsText}`, margin, 38);
      const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
      const dateText = `Genere le ${dateStr}`;
      pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), 38);

      // Render sliced content across pages
      let canvasYPx = 0;

      for (let page = 1; page <= totalPages; page++) {
        const startY = page === 1 ? headerHeight : margin;
        const availableHeight = page === 1 ? firstPageContentHeight : normalPageContentHeight;
        const sliceHeightMm = Math.min(availableHeight, scaledImgHeight - (canvasYPx / pxPerMm));

        if (sliceHeightMm > 0) {
          const sliceHeightPx = Math.round(sliceHeightMm * pxPerMm);
          const imgData = sliceCanvas(canvas, canvasYPx, sliceHeightPx);
          const actualSlicePx = Math.min(sliceHeightPx, canvas.height - canvasYPx);
          const actualSliceMm = actualSlicePx / pxPerMm;

          pdf.addImage(imgData, "JPEG", margin, startY, contentWidth, actualSliceMm);
          canvasYPx += sliceHeightPx;
        }

        drawFooter(page);

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
