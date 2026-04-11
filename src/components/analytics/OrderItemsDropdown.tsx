import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";

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
      <TableRow className="bg-muted/30">
        <TableCell colSpan={13} className="py-2 pl-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Chargement...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (!items?.length) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={13} className="py-2 pl-10">
          <p className="text-muted-foreground italic text-sm">
            Détail non importé
          </p>
          <p className="text-xs text-muted-foreground/70">
            Disponible via le rapport "Historique des commandes" Uber Eats
          </p>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {items.map((item, i) => {
        const ht = Math.abs(Number(item.sales_excl_vat) || 0) || Math.abs((Number(item.unit_price) || 0) * (item.quantity || 1));
        const vat = Math.abs((Number(item.vat_1_sales) || 0) + (Number(item.vat_2_sales) || 0) + (Number(item.vat_3_sales) || 0));
        const ttc = Math.abs(Number(item.sales_incl_vat) || 0) || (ht + vat);
        return (
          <TableRow key={`${orderId}-item-${i}`} className="bg-muted/30 hover:bg-muted/40">
            {/* Chevron placeholder */}
            <TableCell className="w-8 py-0.5"></TableCell>
            {/* Item label spanning N° Commande + Date/Heure */}
            <TableCell colSpan={2} className="py-0.5 text-muted-foreground text-sm truncate pl-1">
              {item.quantity}x {item.item_title}
            </TableCell>
            {/* CA HT */}
            <TableCell className="text-right tabular-nums py-0.5 text-muted-foreground text-sm whitespace-nowrap">
              {formatCurrency(ht)}
            </TableCell>
            {/* TVA */}
            <TableCell className="text-right tabular-nums py-0.5 text-muted-foreground text-sm whitespace-nowrap">
              {formatCurrency(vat)}
            </TableCell>
            {/* CA TTC */}
            <TableCell className="text-right tabular-nums py-0.5 text-muted-foreground text-sm whitespace-nowrap">
              {formatCurrency(ttc)}
            </TableCell>
            {/* Empty cells: Rentab, Commission, Promos, Remb, Vers Uber, Titre Resto, Vers Total */}
            <TableCell className="py-0.5"></TableCell>
            <TableCell className="py-0.5"></TableCell>
            <TableCell className="py-0.5"></TableCell>
            <TableCell className="py-0.5"></TableCell>
            <TableCell className="py-0.5"></TableCell>
            <TableCell className="py-0.5"></TableCell>
            <TableCell className="py-0.5"></TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
