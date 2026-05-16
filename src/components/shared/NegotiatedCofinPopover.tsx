import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface NegotiatedCofinPopoverProps {
  restaurantId: string;
  restaurantName?: string;
  /** YYYY-MM-DD inclusive */
  startDate: string;
  /** YYYY-MM-DD inclusive */
  endDate: string;
  /** Total agrégé déjà calculé en amont, affiché en en-tête */
  totalAmount: number;
  children: ReactNode;
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

export function NegotiatedCofinPopover({
  restaurantId,
  restaurantName,
  startDate,
  endDate,
  totalAmount,
  children,
}: NegotiatedCofinPopoverProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["negotiated-cofin-detail", restaurantId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_adjustments")
        .select("payout_date, amount, description, payout_reference_id")
        .eq("restaurant_id", restaurantId)
        .eq("category", "marketing_adjustment")
        .gte("payout_date", startDate)
        .lte("payout_date", endDate)
        .order("payout_date", { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        payout_date: string;
        amount: number;
        description: string | null;
        payout_reference_id: string;
      }>;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="px-4 py-3 border-b bg-muted/40">
          <div className="text-sm font-semibold">
            Cofinancement marketing négocié
            {restaurantName ? ` – ${restaurantName}` : ""}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Du {format(new Date(startDate), "d MMM yyyy", { locale: fr })} au{" "}
            {format(new Date(endDate), "d MMM yyyy", { locale: fr })}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Total: <span className="font-semibold text-foreground">{fmtCurrency(totalAmount)}</span>
          </div>
        </div>

        <div className="max-h-[320px] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Chargement…
            </div>
          ) : !data || data.length === 0 ? (
            <div className="px-4 py-6 text-xs text-muted-foreground text-center">
              Aucune ligne de cofinancement négocié sur la période.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/30 sticky top-0">
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Date versement</th>
                  <th className="px-3 py-2 font-medium">Libellé</th>
                  <th className="px-3 py-2 font-medium text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {format(new Date(row.payout_date), "dd/MM/yyyy", { locale: fr })}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate" title={row.description || ""}>
                      {row.description || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-600 tabular-nums whitespace-nowrap">
                      {fmtCurrency(Number(row.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-2 border-t bg-muted/20 text-[11px] text-muted-foreground leading-snug">
          Virements Uber rattachés au payout hebdomadaire, hors commandes individuelles.
          Vérifiable dans Uber Manager → Paiements.
        </div>
      </PopoverContent>
    </Popover>
  );
}
