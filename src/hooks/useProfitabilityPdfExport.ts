import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import { loadChainLogoBase64, getChainName } from "@/lib/pdfLogoHelper";
import { ProductProfitability } from "@/hooks/useRestaurantProfitability";

interface Restaurant {
  id: string;
  name: string;
}

interface ProfitabilityExportData {
  restaurants: Restaurant[];
  items: ProductProfitability[];
  platform: "uber" | "deliveroo";
  viewMode: "foodCost" | "margin";
  marginType: "brut" | "net";
  commissionRate: number;
  stats: {
    avgMargin: number | null;
    avgFoodCostPercent: number | null;
    alertCount: number;
  };
}

// Helper to transform "CHICKEN STREET ANTONY" -> "CS Antony"
const extractCityName = (fullName: string): string => {
  return fullName.replace(/CHICKEN STREET\s*/i, "").trim() || fullName;
};

const getShortName = (name: string): string => {
  return `CS ${extractCityName(name)}`;
};

// Format helpers
const formatNumber = (value: number, decimals: number = 0): string => {
  if (value == null || isNaN(value)) return "--";
  return value.toFixed(decimals);
};

export function useProfitabilityPdfExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = useCallback(async (data: ProfitabilityExportData) => {
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
      
      // Calculate total pages (header + data rows, ~20 rows per page)
      const rowsPerPage = 18;
      const dataPages = Math.ceil(data.items.length / rowsPerPage);
      const totalPages = 1 + dataPages; // 1 summary + data pages

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
      const amber = { r: 245, g: 158, b: 11 };
      const red = { r: 239, g: 68, b: 68 };
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
        const platformLabel = data.platform === "uber" ? "Uber Eats" : "Deliveroo";
        pdf.text(`Plateforme: ${platformLabel}`, margin, 36);
        pdf.text(`${data.restaurants.length} restaurants`, margin + 80, 36);
        
        const genText = `Généré le ${dateStr}`;
        pdf.text(genText, pageWidth - margin - pdf.getTextWidth(genText), 36);
      };

      const drawFooter = (pageNum: number) => {
        pdf.setDrawColor(229, 231, 235);
        pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
        
        pdf.setFontSize(8);
        pdf.setTextColor(gray.r, gray.g, gray.b);
        pdf.text("CS Delivery Performance - Analyse Rentabilité", margin, pageHeight - 5);
        pdf.text(`Page ${pageNum}/${totalPages}`, pageWidth - margin - 20, pageHeight - 5);
      };

      // ========== PAGE 1: Summary KPIs ==========
      const subtitleView = data.viewMode === "foodCost" ? "% Food Cost" : "Marge";
      const subtitleMargin = data.marginType === "net" ? "Net" : "Brut";
      drawHeader(1, `Analyse Rentabilité - ${subtitleView} (${subtitleMargin})`);
      
      const kpiStartY = 52;
      const cardWidth = (pageWidth - margin * 2 - 30) / 4;
      const cardHeight = 45;

      // KPI Cards
      const drawKpiCard = (x: number, y: number, icon: string, title: string, value: string, subtitle: string, color: { r: number; g: number; b: number }) => {
        // Card background
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "FD");
        
        // Colored top accent
        pdf.setFillColor(color.r, color.g, color.b);
        pdf.rect(x, y, cardWidth, 3, "F");
        
        // Title with icon color
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(color.r, color.g, color.b);
        pdf.text(title, x + 8, y + 14);
        
        // Value
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
        pdf.text(value, x + 8, y + 30);
        
        // Subtitle
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(gray.r, gray.g, gray.b);
        pdf.text(subtitle, x + 8, y + 40);
      };

      // Draw 4 KPI cards
      drawKpiCard(
        margin, 
        kpiStartY, 
        "📊", 
        "Produits analysés",
        String(data.items.length),
        `sur ${data.items.length} produits`,
        emerald
      );

      const avgValue = data.viewMode === "foodCost" 
        ? data.stats.avgFoodCostPercent 
        : data.stats.avgMargin;
      const avgLabel = data.viewMode === "foodCost" ? "% Food Cost moyen" : "Marge moyenne";
      const avgSubtitle = data.viewMode === "foodCost" ? "objectif < 30%" : "objectif > 70%";
      const avgColor = data.viewMode === "foodCost"
        ? (avgValue !== null && avgValue <= 30 ? emerald : avgValue !== null && avgValue <= 35 ? amber : orange)
        : (avgValue !== null && avgValue >= 70 ? emerald : avgValue !== null && avgValue >= 50 ? amber : orange);

      drawKpiCard(
        margin + cardWidth + 10, 
        kpiStartY, 
        "📈", 
        avgLabel,
        avgValue !== null ? `${avgValue.toFixed(1)}%` : "--",
        avgSubtitle,
        avgColor
      );

      drawKpiCard(
        margin + (cardWidth + 10) * 2, 
        kpiStartY, 
        "⚠️", 
        "Alertes écart",
        String(data.stats.alertCount),
        "écart > 5% entre restaurants",
        data.stats.alertCount > 0 ? orange : emerald
      );

      drawKpiCard(
        margin + (cardWidth + 10) * 3, 
        kpiStartY, 
        "🏪", 
        "Restaurants",
        String(data.restaurants.length),
        "sélectionnés",
        emerald
      );

      // Configuration summary
      const configY = kpiStartY + cardHeight + 15;
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(229, 231, 235);
      pdf.roundedRect(margin, configY, pageWidth - margin * 2, 25, 3, 3, "FD");

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
      pdf.text("Configuration de l'analyse", margin + 10, configY + 10);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const configItems = [
        `Mode: ${data.viewMode === "foodCost" ? "% Food Cost" : "Marge"}`,
        `Type: ${data.marginType === "net" ? "Net (après commission)" : "Brut (avant commission)"}`,
        data.marginType === "net" ? `Commission: ${data.commissionRate}%` : null,
        `Restaurants: ${data.restaurants.map(r => getShortName(r.name)).join(", ")}`,
      ].filter(Boolean);

      pdf.setTextColor(gray.r, gray.g, gray.b);
      pdf.text(configItems.join("  |  "), margin + 10, configY + 19);

      drawFooter(1);

      // ========== DATA PAGES ==========
      // Prepare table headers based on viewMode
      const restaurantCols = data.restaurants.map(r => getShortName(r.name));
      
      for (let pageIdx = 0; pageIdx < dataPages; pageIdx++) {
        pdf.addPage();
        drawHeader(pageIdx + 2, `Détail des produits (${pageIdx + 1}/${dataPages})`);

        const tableStartY = 48;
        const rowHeight = 9;
        
        // Column widths
        const productColWidth = 55;
        const categoryColWidth = 30;
        const fcColWidth = 22;
        const restColWidth = Math.min(28, (pageWidth - margin * 2 - productColWidth - categoryColWidth - fcColWidth - 45) / Math.max(data.restaurants.length, 1));
        const avgColWidth = 22;
        const ecartColWidth = 18;

        // Calculate positions
        let currentX = margin;
        const headers = ["Produit", "Catégorie", "Food Cost"];
        const headerWidths = [productColWidth, categoryColWidth, fcColWidth];

        // Draw header row
        pdf.setFillColor(lightGray.r, lightGray.g, lightGray.b);
        pdf.rect(margin, tableStartY, pageWidth - margin * 2, rowHeight, "F");
        
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);
        
        headers.forEach((header, i) => {
          pdf.text(header, currentX + 2, tableStartY + 6);
          currentX += headerWidths[i];
        });

        // Restaurant columns
        restaurantCols.forEach((name) => {
          pdf.text(name, currentX + 2, tableStartY + 6);
          currentX += restColWidth;
        });

        // Moy. and Écart
        pdf.text("Moy.", currentX + 2, tableStartY + 6);
        currentX += avgColWidth;
        pdf.text("Écart", currentX + 2, tableStartY + 6);

        // Draw data rows
        const startIdx = pageIdx * rowsPerPage;
        const endIdx = Math.min(startIdx + rowsPerPage, data.items.length);
        const pageItems = data.items.slice(startIdx, endIdx);

        pdf.setFont("helvetica", "normal");
        pageItems.forEach((item, idx) => {
          const rowY = tableStartY + rowHeight * (idx + 1);
          
          if (idx % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(249, 250, 251);
          }
          pdf.rect(margin, rowY, pageWidth - margin * 2, rowHeight, "F");

          currentX = margin;
          pdf.setFontSize(7);
          pdf.setTextColor(darkGray.r, darkGray.g, darkGray.b);

          // Product name (truncate if needed)
          let productName = item.menuItemName;
          const maxWidth = productColWidth - 4;
          while (pdf.getTextWidth(productName) > maxWidth && productName.length > 3) {
            productName = productName.slice(0, -1);
          }
          if (productName !== item.menuItemName) productName += "...";
          pdf.text(productName, currentX + 2, rowY + 6);
          currentX += productColWidth;

          // Category
          pdf.setFontSize(6);
          pdf.text((item.category || "").substring(0, 12), currentX + 2, rowY + 6);
          currentX += categoryColWidth;

          // Food Cost
          pdf.setFontSize(7);
          pdf.text(item.foodCost !== null ? `${item.foodCost.toFixed(2)}€` : "--", currentX + 2, rowY + 6);
          currentX += fcColWidth;

          // Restaurant values (FC% or Margin%)
          data.restaurants.forEach((resto) => {
            const restData = item.restaurants.find(r => r.restaurantId === resto.id);
            
            let value: number | null = null;
            let displayValue = "--";
            
            if (restData) {
              const price = data.platform === "uber" ? restData.priceUber : restData.priceDeliveroo;
              const vatRate = item.vatRate ?? 10;
              const prixHT = price ? price / (1 + vatRate / 100) : null;

              if (data.viewMode === "foodCost" && item.foodCost !== null && prixHT !== null && prixHT > 0) {
                if (data.marginType === "brut") {
                  value = (item.foodCost / prixHT) * 100;
                } else {
                  const commissionHT = price! * (data.commissionRate / 100);
                  const netRevenue = prixHT - commissionHT;
                  value = netRevenue > 0 ? (item.foodCost / netRevenue) * 100 : null;
                }
              } else if (data.viewMode === "margin") {
                const marginBrut = data.platform === "uber" ? restData.marginBrutUber : restData.marginBrutDeliveroo;
                const marginNet = data.platform === "uber" ? restData.marginNetUber : restData.marginNetDeliveroo;
                if (data.marginType === "brut") {
                  value = marginBrut;
                } else {
                  value = marginNet;
                }
              }

              if (value !== null) {
                displayValue = `${value.toFixed(0)}%`;
              }
            }

            // Color based on viewMode
            if (value !== null) {
              if (data.viewMode === "foodCost") {
                if (value <= 30) {
                  pdf.setTextColor(emerald.r, emerald.g, emerald.b);
                } else if (value <= 35) {
                  pdf.setTextColor(amber.r, amber.g, amber.b);
                } else {
                  pdf.setTextColor(red.r, red.g, red.b);
                }
              } else {
                if (value >= 70) {
                  pdf.setTextColor(emerald.r, emerald.g, emerald.b);
                } else if (value >= 50) {
                  pdf.setTextColor(amber.r, amber.g, amber.b);
                } else {
                  pdf.setTextColor(red.r, red.g, red.b);
                }
              }
            } else {
              pdf.setTextColor(gray.r, gray.g, gray.b);
            }

            pdf.setFont("helvetica", "bold");
            pdf.text(displayValue, currentX + 2, rowY + 6);
            currentX += restColWidth;
          });

          // Calculate average
          const values: number[] = [];
          data.restaurants.forEach((resto) => {
            const restData = item.restaurants.find(r => r.restaurantId === resto.id);
            if (restData) {
              const price = data.platform === "uber" ? restData.priceUber : restData.priceDeliveroo;
              const vatRate = item.vatRate ?? 10;
              const prixHT = price ? price / (1 + vatRate / 100) : null;

              if (data.viewMode === "foodCost" && item.foodCost !== null && prixHT !== null && prixHT > 0) {
                if (data.marginType === "brut") {
                  values.push((item.foodCost / prixHT) * 100);
                } else {
                  const commissionHT = price! * (data.commissionRate / 100);
                  const netRevenue = prixHT - commissionHT;
                  if (netRevenue > 0) values.push((item.foodCost / netRevenue) * 100);
                }
              } else if (data.viewMode === "margin") {
                const marginBrutVal = data.platform === "uber" ? restData.marginBrutUber : restData.marginBrutDeliveroo;
                const marginNetVal = data.platform === "uber" ? restData.marginNetUber : restData.marginNetDeliveroo;
                const marginValue = data.marginType === "brut" ? marginBrutVal : marginNetVal;
                if (marginValue !== null) values.push(marginValue);
              }
            }
          });

          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
          const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : null;

          // Average
          pdf.setFont("helvetica", "bold");
          if (avg !== null) {
            if (data.viewMode === "foodCost") {
              pdf.setTextColor(avg <= 30 ? emerald.r : avg <= 35 ? amber.r : red.r, 
                              avg <= 30 ? emerald.g : avg <= 35 ? amber.g : red.g, 
                              avg <= 30 ? emerald.b : avg <= 35 ? amber.b : red.b);
            } else {
              pdf.setTextColor(avg >= 70 ? emerald.r : avg >= 50 ? amber.r : red.r,
                              avg >= 70 ? emerald.g : avg >= 50 ? amber.g : red.g,
                              avg >= 70 ? emerald.b : avg >= 50 ? amber.b : red.b);
            }
            pdf.text(`${avg.toFixed(1)}%`, currentX + 2, rowY + 6);
          } else {
            pdf.setTextColor(gray.r, gray.g, gray.b);
            pdf.text("--", currentX + 2, rowY + 6);
          }
          currentX += avgColWidth;

          // Spread (écart)
          pdf.setFont("helvetica", "normal");
          if (spread !== null) {
            if (spread > 5) {
              pdf.setTextColor(orange.r, orange.g, orange.b);
            } else {
              pdf.setTextColor(gray.r, gray.g, gray.b);
            }
            pdf.text(`${spread.toFixed(1)}%`, currentX + 2, rowY + 6);
          } else {
            pdf.setTextColor(gray.r, gray.g, gray.b);
            pdf.text("--", currentX + 2, rowY + 6);
          }
        });

        // Table border
        pdf.setDrawColor(229, 231, 235);
        const tableHeight = rowHeight * (pageItems.length + 1);
        pdf.roundedRect(margin, tableStartY, pageWidth - margin * 2, tableHeight, 2, 2, "S");

        drawFooter(pageIdx + 2);
      }

      // Legend at bottom of last page
      const legendY = pageHeight - 25;
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");

      if (data.viewMode === "foodCost") {
        pdf.setTextColor(emerald.r, emerald.g, emerald.b);
        pdf.text("● ≤30% Optimal", margin, legendY);
        pdf.setTextColor(amber.r, amber.g, amber.b);
        pdf.text("● 30-35% Acceptable", margin + 30, legendY);
        pdf.setTextColor(red.r, red.g, red.b);
        pdf.text("● >35% À optimiser", margin + 70, legendY);
      } else {
        pdf.setTextColor(emerald.r, emerald.g, emerald.b);
        pdf.text("● ≥70% Excellent", margin, legendY);
        pdf.setTextColor(amber.r, amber.g, amber.b);
        pdf.text("● 50-70% Correct", margin + 30, legendY);
        pdf.setTextColor(red.r, red.g, red.b);
        pdf.text("● <50% À optimiser", margin + 70, legendY);
      }

      const fileName = `rentabilite_${data.viewMode}_${data.marginType}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToPdf, isExporting };
}
