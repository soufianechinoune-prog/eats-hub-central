import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RefundOrderRow {
  order_id: string;
  restaurant_id: string;
  restaurant_name: string;
  uber_order_id: string | null;
  order_datetime: string;
  refund_incl_vat: number;
  refund_contested_incl_vat: number;
  net_refund: number;
  dispute_status: string | null;
}

interface Props {
  restaurantIds: string[];
  startDate: Date;
  endDate: Date;
}

const fmtEur = (v: number) => `${(v || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function disputeBadge(row: { dispute_status: string | null; refund_incl_vat: number; refund_contested_incl_vat: number }) {
  const status = row.dispute_status;
  // Legacy credit: positive refund_incl_vat with no parsed dispute status
  if (!status && row.refund_contested_incl_vat === 0 && row.refund_incl_vat > 0) {
    return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-100 text-[10px]">Recrédit Uber (legacy)</Badge>;
  }
  if (!status) {
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">—</Badge>;
  }
  const s = status.toLowerCase();
  if (s.includes("contest")) {
    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 hover:bg-emerald-100 text-[10px]">Contestation gagnée</Badge>;
  }
  if (s.includes("remboursement") || s.includes("refund")) {
    return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 hover:bg-orange-100 text-[10px]">Remboursement</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}


const PAGE_SIZE = 25;

export function RefundOrdersDetailTable({ restaurantIds, startDate, endDate }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["refund-orders-detail", restaurantIds.slice().sort().join(","), startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_refund_orders_detail", {
        p_restaurant_ids: restaurantIds,
        p_start_date: startStr,
        p_end_date: endStr,
      });
      if (error) {
        console.error("[RefundOrdersDetailTable] error:", error);
        throw error;
      }
      return (data as RefundOrderRow[]) || [];
    },
    enabled: restaurantIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.uber_order_id || "").toLowerCase().includes(q) ||
        r.restaurant_name.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const exportCsv = () => {
    const header = [
      "Date",
      "Restaurant",
      "N° commande",
      "Remboursé client (TTC)",
      "Recrédité après contestation (TTC)",
      "Solde net (TTC)",
      "Statut litige",
    ];
    const lines = filtered.map((r) => [
      format(new Date(r.order_datetime), "yyyy-MM-dd HH:mm"),
      `"${r.restaurant_name.replace(/"/g, '""')}"`,
      r.uber_order_id || "",
      r.refund_incl_vat.toFixed(2).replace(".", ","),
      r.refund_contested_incl_vat.toFixed(2).replace(".", ","),
      r.net_refund.toFixed(2).replace(".", ","),
      r.dispute_status || "",
    ].join(";"));
    const csv = [header.join(";"), ...lines].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remboursements_${startStr}_${endStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold">Détail des commandes remboursées</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Toutes les commandes ayant fait l'objet d'un remboursement ou d'une contestation sur la période.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="N° commande, restaurant…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-7 h-8 w-64 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
          </div>
        ) : isError ? (
          <div className="text-sm text-destructive py-6 text-center">Erreur de chargement</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Aucune commande remboursée sur cette période.
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Restaurant</TableHead>
                    <TableHead className="text-xs">N° commande</TableHead>
                    <TableHead className="text-xs text-right">Débit / Crédit</TableHead>
                    <TableHead className="text-xs text-right">Recrédité (contestation)</TableHead>
                    <TableHead className="text-xs text-right">Solde net</TableHead>
                    <TableHead className="text-xs">Statut litige</TableHead>

                    <TableHead className="text-xs">Statut litige</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow key={r.order_id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.order_datetime), "d MMM yyyy HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-xs">{r.restaurant_name}</TableCell>
                      <TableCell className="text-xs font-mono">{r.uber_order_id || "—"}</TableCell>
                      <TableCell className="text-xs text-right text-orange-700 dark:text-orange-300 font-medium">
                        {r.refund_incl_vat !== 0 ? fmtEur(r.refund_incl_vat) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right text-emerald-700 dark:text-emerald-300 font-medium">
                        {r.refund_contested_incl_vat !== 0
                          ? `${r.refund_contested_incl_vat > 0 ? "+" : ""}${fmtEur(r.refund_contested_incl_vat)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold">
                        <span className={r.net_refund < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}>
                          {fmtEur(r.net_refund)}
                        </span>
                      </TableCell>
                      <TableCell>{disputeBadge(r)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <div>
                {filtered.length.toLocaleString("fr-FR")} commande{filtered.length > 1 ? "s" : ""}
                {search && ` (filtré sur ${rows.length})`}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
                    Précédent
                  </Button>
                  <span>
                    Page {safePage} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Suivant
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
