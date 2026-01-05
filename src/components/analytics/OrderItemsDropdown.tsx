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
        .select("item_title, quantity, sales_incl_vat")
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
    <div className="pl-10 py-2 space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex justify-between text-sm text-muted-foreground">
          <span>{item.quantity}x {item.item_title}</span>
          <span className="tabular-nums">{formatCurrency(item.sales_incl_vat || 0)}</span>
        </div>
      ))}
    </div>
  );
}
