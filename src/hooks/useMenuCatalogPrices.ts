import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  priceUber: number | null;
  priceDeliveroo: number | null;
  hasDiscrepancy: boolean;
  differencePercent: number;
}

export interface CatalogStats {
  totalProducts: number;
  productsWithDiscrepancy: number;
  averageDifferencePercent: number;
}

export function useMenuCatalogPrices() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("menu_items")
          .select("id, name, description, category, price_uber, price_deliveroo, is_active")
          .eq("is_active", true)
          .order("name");

        if (fetchError) {
          throw fetchError;
        }

        const catalogItems: CatalogItem[] = (data || []).map((item) => {
          const priceUber = item.price_uber;
          const priceDeliveroo = item.price_deliveroo;
          
          let hasDiscrepancy = false;
          let differencePercent = 0;

          if (priceUber != null && priceDeliveroo != null && priceUber > 0 && priceDeliveroo > 0) {
            const diff = Math.abs(priceUber - priceDeliveroo);
            const minPrice = Math.min(priceUber, priceDeliveroo);
            differencePercent = Math.round((diff / minPrice) * 100 * 10) / 10;
            hasDiscrepancy = differencePercent > 0;
          }

          return {
            id: item.id,
            name: item.name || "",
            description: item.description || "",
            category: item.category || "",
            priceUber,
            priceDeliveroo,
            hasDiscrepancy,
            differencePercent,
          };
        });

        setItems(catalogItems);
      } catch (err) {
        console.error("Error fetching catalog:", err);
        setError("Erreur lors du chargement du catalogue");
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, []);

  const stats: CatalogStats = useMemo(() => {
    const totalProducts = items.length;
    const productsWithDiscrepancy = items.filter((i) => i.hasDiscrepancy).length;
    const discrepancies = items.filter((i) => i.hasDiscrepancy);
    const averageDifferencePercent =
      discrepancies.length > 0
        ? Math.round(
            (discrepancies.reduce((sum, i) => sum + i.differencePercent, 0) /
              discrepancies.length) *
              10
          ) / 10
        : 0;

    return { totalProducts, productsWithDiscrepancy, averageDifferencePercent };
  }, [items]);

  return { loading, items, stats, error };
}
