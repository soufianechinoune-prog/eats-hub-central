import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface OrderItemsDropdownProps {
  orderId: string;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

export function OrderItemsDropdown({ orderId }: OrderItemsDropdownProps) {
  const { data: items, isLoading } = useQuery({
    queryKey: ["order-items-dropdown", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("item_title, quantity, unit_price, total_price, sales_excl_vat, vat_1_sales, vat_2_sales, vat_3_sales, sales_incl_vat")
        .eq("order_id", orderId);
      
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 pl-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Chargement...</span>
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="py-2 pl-10 space-y-1">
        <p className="text-muted-foreground italic text-sm">
          Détail non importé
        </p>
        <p className="text-xs text-muted-foreground/70">
          Disponible via le rapport "Historique des commandes" Uber Eats
        </p>
      </div>
    );
  }

  return (
    <div className="py-1">
      <table className="w-full text-sm">
        <tbody>
          {items.map((item, i) => {
            const ht = Math.abs(Number(item.sales_excl_vat) || 0) || Math.abs((Number(item.unit_price) || 0) * (item.quantity || 1));
            const vat = Math.abs((Number(item.vat_1_sales) || 0) + (Number(item.vat_2_sales) || 0) + (Number(item.vat_3_sales) || 0));
            const ttc = Math.abs(Number(item.sales_incl_vat) || 0) || (ht + vat);
            return (
              <tr key={i} className="text-muted-foreground">
                {/* Chevron placeholder */}
                <td className="w-8"></td>
                {/* Item label spanning "N° Commande" + "Date/Heure" */}
                <td colSpan={2} className="py-0.5 truncate pl-1">
                  {item.quantity}x {item.item_title}
                </td>
                {/* CA HT */}
                <td className="text-right tabular-nums py-0.5 whitespace-nowrap">
                  {formatCurrency(ht)}
                </td>
                {/* TVA */}
                <td className="text-right tabular-nums py-0.5 whitespace-nowrap">
                  {formatCurrency(vat)}
                </td>
                {/* CA TTC */}
                <td className="text-right tabular-nums py-0.5 whitespace-nowrap">
                  {formatCurrency(ttc)}
                </td>
                {/* Empty cells for remaining columns: Rentab, Commission, Promos, Remb, Vers Uber, Titre Resto, Vers Total */}
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
