import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ExportParams {
  restaurantIds: string[];
  startDate: string;
  endDate: string;
  platform?: string;
  restaurants?: { id: string; name: string }[];
}

const PAGE_SIZE = 1000;

async function fetchAllReviews(restaurantIds: string[], startDate: string, endDate: string, platform?: string) {
  const all: any[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    let query = supabase
      .from("customer_reviews")
      .select("restaurant_id, overall_rating, food_rating, delivery_rating, review_date, order_date, customer_name, customer_type, customer_comment, tags, platform, order_total, response_status, response_text")
      .gte("review_date", startDate)
      .lte("review_date", endDate)
      .in("restaurant_id", restaurantIds)
      .order("review_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (platform && platform !== "global") {
      query = query.eq("platform", platform);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) {
      all.push(...data);
      hasMore = data.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return all;
}

function buildRows(reviews: any[], restaurantMap: Map<string, string>) {
  return reviews.map((r) => ({
    "Restaurant": restaurantMap.get(r.restaurant_id) || r.restaurant_id,
    "Date avis": r.review_date ? format(new Date(r.review_date), "dd/MM/yyyy", { locale: fr }) : "",
    "Date commande": r.order_date ? format(new Date(r.order_date), "dd/MM/yyyy", { locale: fr }) : "",
    "Plateforme": r.platform === "uber_eats" ? "Uber Eats" : r.platform === "deliveroo" ? "Deliveroo" : r.platform || "",
    "Note globale": r.overall_rating ?? "",
    "Note nourriture": r.food_rating ?? "",
    "Note livraison": r.delivery_rating ?? "",
    "Client": r.customer_name || "",
    "Type client": r.customer_type === "new" ? "Nouveau" : r.customer_type === "returning" ? "Récurrent" : r.customer_type || "",
    "Panier": r.order_total != null ? `${Number(r.order_total).toFixed(2)} €` : "",
    "Tags": (r.tags || []).join(", "),
    "Commentaire": r.customer_comment || "",
    "Statut réponse": r.response_status || "",
    "Réponse": r.response_text || "",
  }));
}

export function useReviewsExportData() {
  const [isExporting, setIsExporting] = useState(false);

  const exportReviews = async (params: ExportParams, fileFormat: "csv" | "xlsx") => {
    setIsExporting(true);
    try {
      const reviews = await fetchAllReviews(params.restaurantIds, params.startDate, params.endDate, params.platform);
      
      if (reviews.length === 0) {
        toast.warning("Aucun avis à exporter pour cette période");
        return;
      }

      const restaurantMap = new Map<string, string>();
      (params.restaurants || []).forEach((r) => restaurantMap.set(r.id, r.name));

      const rows = buildRows(reviews, restaurantMap);
      const ws = XLSX.utils.json_to_sheet(rows);
      
      // Auto-size columns
      const colWidths = Object.keys(rows[0]).map((key) => {
        const maxLen = Math.max(key.length, ...rows.map((r) => String((r as any)[key] || "").length));
        return { wch: Math.min(maxLen + 2, 60) };
      });
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Avis");

      const dateLabel = `${params.startDate}_${params.endDate}`;
      const fileName = `avis_clients_${dateLabel}`;

      if (fileFormat === "xlsx") {
        XLSX.writeFile(wb, `${fileName}.xlsx`);
      } else {
        XLSX.writeFile(wb, `${fileName}.csv`, { bookType: "csv" });
      }

      toast.success(`${reviews.length} avis exportés avec succès`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erreur lors de l'export des avis");
    } finally {
      setIsExporting(false);
    }
  };

  return { exportReviews, isExporting };
}
