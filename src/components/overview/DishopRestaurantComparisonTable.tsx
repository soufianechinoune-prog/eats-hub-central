import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DishopRestaurantRow } from "@/hooks/useDishopRestaurantBreakdown";

interface Props {
  rows: DishopRestaurantRow[];
  restaurantNames: Map<string, string>;
  isLoading: boolean;
  onRestaurantClick?: (restaurantId: string) => void;
}

type SortKey = "caTTC" | "orderCount" | "averageBasket" | "commissionAmount" | "profitability" | "promoShare";

export function DishopRestaurantComparisonTable({
  rows,
  restaurantNames,
  isLoading,
  onRestaurantClick,
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("caTTC");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const enriched = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        name: restaurantNames.get(r.restaurantId) ?? "—",
      })),
    [rows, restaurantNames]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? enriched.filter((r) => r.name.toLowerCase().includes(q)) : enriched;
    const sorted = [...base].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return sorted;
  }, [enriched, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortHead = ({ k, label, align = "right" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          align === "right" ? "ml-auto" : ""
        )}
      >
        <span className="uppercase text-xs tracking-wide">{label}</span>
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-5 w-5 text-primary" />
          Comparatif Dishop par restaurant
        </CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            Aucune donnée Dishop sur la période.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Restaurant</TableHead>
                <SortHead k="caTTC" label="CA TTC" />
                <SortHead k="orderCount" label="Cmds" />
                <SortHead k="averageBasket" label="Panier" />
                <SortHead k="commissionAmount" label="Commission" />
                <SortHead k="profitability" label="Rentab." />
                <SortHead k="promoShare" label="% Promo" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow
                  key={r.restaurantId}
                  className={onRestaurantClick ? "cursor-pointer hover:bg-muted/40" : ""}
                  onClick={() => onRestaurantClick?.(r.restaurantId)}
                >
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {Math.round(r.caTTC).toLocaleString("fr-FR")} €
                  </TableCell>
                  <TableCell className="text-right">{r.orderCount.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="text-right">{r.averageBasket.toFixed(2)} €</TableCell>
                  <TableCell className="text-right text-violet-600">
                    {Math.round(r.commissionAmount).toLocaleString("fr-FR")} € ({r.commissionRate.toFixed(1)}%)
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold",
                      r.profitability >= 90
                        ? "text-emerald-600"
                        : r.profitability >= 80
                          ? "text-amber-600"
                          : "text-orange-600"
                    )}
                  >
                    {r.profitability.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">{r.promoShare.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
