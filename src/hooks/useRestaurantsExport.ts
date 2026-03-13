import { useCallback } from "react";
import jsPDF from "jspdf";

interface RestaurantExportRow {
  name: string;
  city: string;
  postal_code: string | null;
  contact: string;
  manager: string;
  uber_opening_date: string | null;
  status: string;
  type: string;
}

function getStatus(r: any): string {
  if (r.is_active === false) {
    if (!r.uber_opening_date && !r.uber_closing_date) return "Bientôt";
    if (r.uber_closing_date) {
      return `Fermé le ${new Date(r.uber_closing_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return "Fermé";
  }
  return "-";
}

function formatRow(r: any): RestaurantExportRow {
  const contact = r.manager_whatsapp || r.restaurant_phone || "-";
  const manager = [r.manager_first_name, r.manager_last_name].filter(Boolean).join(" ") || "-";
  const uberDate = r.uber_opening_date
    ? new Date(r.uber_opening_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "-";
  return {
    name: r.name,
    city: `${r.postal_code || ""} ${r.city || ""}`.trim(),
    postal_code: r.postal_code,
    contact,
    manager,
    uber_opening_date: uberDate,
    status: getStatus(r),
    type: r.is_succursale ? "Succursale" : "Franchise",
  };
}

const HEADERS = ["Nom", "Ville", "Contact", "Gérant", "Ouverture Uber", "Statut", "Type"];

export function useRestaurantsExport() {
  const exportCSV = useCallback((restaurants: any[]) => {
    try {
      console.log("exportCSV called with", restaurants?.length, "restaurants");
      if (!restaurants || restaurants.length === 0) {
        console.warn("No restaurants to export");
        return;
      }
      const rows = restaurants.map(formatRow);
      const csv = [
        HEADERS.join(";"),
        ...rows.map((r) =>
          [r.name, r.city, r.contact, r.manager, r.uber_opening_date, r.status, r.type]
            .map((v) => `"${(v || "").replace(/"/g, '""')}"`)
            .join(";")
        ),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `restaurants_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("CSV export completed successfully");
    } catch (err) {
      console.error("CSV export error:", err);
    }
  }, []);

  const exportPDF = useCallback((restaurants: any[]) => {
    const rows = restaurants.map(formatRow);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Liste des restaurants", margin, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${rows.length} restaurant${rows.length > 1 ? "s" : ""} - Export du ${new Date().toLocaleDateString("fr-FR")}`,
      margin,
      24
    );

    // Table
    const colWidths = [72, 40, 38, 36, 36, 36, 24]; // total ~282 for landscape A4
    const headers = HEADERS;
    const startY = 30;
    let y = startY;
    const rowH = 7;
    const headerH = 8;

    const drawHeader = () => {
      doc.setFillColor(16, 185, 129); // emerald
      doc.rect(margin, y, pageW - margin * 2, headerH, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      let x = margin + 2;
      headers.forEach((h, i) => {
        doc.text(h, x, y + 5.5);
        x += colWidths[i];
      });
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      y += headerH;
    };

    drawHeader();

    rows.forEach((row, idx) => {
      if (y + rowH > pageH - 10) {
        doc.addPage();
        y = margin;
        drawHeader();
      }

      // Alternating row bg
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageW - margin * 2, rowH, "F");
      }

      const values = [row.name, row.city, row.contact, row.manager, row.uber_opening_date || "-", row.status, row.type];
      let x = margin + 2;
      values.forEach((val, i) => {
        const maxW = colWidths[i] - 3;
        const truncated = doc.getTextWidth(val) > maxW
          ? val.substring(0, Math.floor(val.length * maxW / doc.getTextWidth(val))) + "..."
          : val;
        doc.text(truncated, x, y + 4.8);
        x += colWidths[i];
      });

      y += rowH;
    });

    // Footer on each page
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`CS Delivery Performance - Page ${p}/${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
    }

    doc.save(`restaurants_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, []);

  return { exportCSV, exportPDF };
}
