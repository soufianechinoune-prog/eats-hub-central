import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailLine {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  payout_reference_id: string | null;
  payout_date: string | null;
  description: string | null;
  amount: number;
  platform?: "uber_eats" | "deliveroo";
}

interface EcoContributionDetailProps {
  detailLines: DetailLine[];
  restaurantMap: Map<string, string>;
}

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const fmt = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const fmtDate = (d: string | null) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("fr-FR");
};

export function EcoContributionDetail({ detailLines, restaurantMap }: EcoContributionDetailProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return detailLines;
    const lower = search.toLowerCase();
    return detailLines.filter(l => {
      const restoName = restaurantMap.get(l.restaurant_id) || l.restaurant_name || "";
      return (
        restoName.toLowerCase().includes(lower) ||
        (l.payout_reference_id || "").toLowerCase().includes(lower) ||
        (l.description || "").toLowerCase().includes(lower)
      );
    });
  }, [detailLines, search, restaurantMap]);

  // Group by month then by restaurant
  const grouped = useMemo(() => {
    const byMonth = new Map<number, DetailLine[]>();
    for (const line of filtered) {
      const m = line.payout_date ? new Date(line.payout_date).getMonth() + 1 : 0;
      const arr = byMonth.get(m) || [];
      arr.push(line);
      byMonth.set(m, arr);
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => b - a) // most recent first
      .map(([month, lines]) => {
        // Group by restaurant
        const byResto = new Map<string, DetailLine[]>();
        for (const line of lines) {
          const arr = byResto.get(line.restaurant_id) || [];
          arr.push(line);
          byResto.set(line.restaurant_id, arr);
        }

        const monthRefund = lines.filter(l => Number(l.amount) >= 0).reduce((s, l) => s + Number(l.amount), 0);
        const monthCharge = lines.filter(l => Number(l.amount) < 0).reduce((s, l) => s + Number(l.amount), 0);

        const restaurants = Array.from(byResto.entries())
          .map(([restoId, restoLines]) => {
            const net = restoLines.reduce((s, l) => s + Number(l.amount), 0);
            return {
              restoId,
              name: restaurantMap.get(restoId) || restoLines[0]?.restaurant_name || restoId,
              lines: restoLines.sort((a, b) => (a.payout_date || "").localeCompare(b.payout_date || "")),
              net: Math.round(net * 100) / 100,
              count: restoLines.length,
            };
          })
          .sort((a, b) => b.net - a.net);

        return {
          month,
          monthLabel: month === 0 ? "Sans date" : MONTH_NAMES[month - 1],
          refund: Math.round(monthRefund * 100) / 100,
          charge: Math.round(monthCharge * 100) / 100,
          net: Math.round((monthRefund + monthCharge) * 100) / 100,
          count: lines.length,
          restaurants,
        };
      });
  }, [filtered, restaurantMap]);

  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }, [filtered]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Lignes individuelles
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {filtered.length} lignes · Total: {fmt(totalAmount)}
          </Badge>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher restaurant, référence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {grouped.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Aucune ligne trouvée</p>
        ) : (
          grouped.map((monthGroup) => (
            <MonthAccordion key={monthGroup.month} group={monthGroup} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface MonthGroup {
  month: number;
  monthLabel: string;
  refund: number;
  charge: number;
  net: number;
  count: number;
  restaurants: {
    restoId: string;
    name: string;
    lines: DetailLine[];
    net: number;
    count: number;
  }[];
}

function MonthAccordion({ group }: { group: MonthGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left">
        <div className="flex items-center gap-2">
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="font-semibold text-sm">{group.monthLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Remb: <span className="text-green-600 font-medium">{fmt(group.refund)}</span></span>
          <span>Prél: <span className="text-red-500 font-medium">{fmt(group.charge)}</span></span>
          <span>Solde: <span className="font-semibold text-foreground">{fmt(group.net)}</span></span>
          <Badge variant="secondary" className="text-[10px] h-5">{group.count} lignes</Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
        {group.restaurants.map((resto) => (
          <RestaurantAccordion key={resto.restoId} resto={resto} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function RestaurantAccordion({ resto }: { resto: MonthGroup["restaurants"][number] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-md hover:bg-muted/30 transition-colors text-left">
        <div className="flex items-center gap-2">
          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="text-sm">{resto.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Solde: <span className={cn("font-medium", resto.net >= 0 ? "text-green-600" : "text-red-500")}>{fmt(resto.net)}</span></span>
          <Badge variant="secondary" className="text-[10px] h-5">{resto.count}</Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-2 mt-1 mb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 text-xs">Date</TableHead>
              <TableHead className="h-8 text-xs">Description</TableHead>
              <TableHead className="h-8 text-xs text-right">Montant</TableHead>
              <TableHead className="h-8 text-xs">Plateforme</TableHead>
              <TableHead className="h-8 text-xs">Réf.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resto.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="text-xs py-1.5">{fmtDate(line.payout_date)}</TableCell>
                <TableCell className="text-xs py-1.5 text-muted-foreground">{line.description || "-"}</TableCell>
                <TableCell className={cn("text-xs py-1.5 text-right font-medium", Number(line.amount) >= 0 ? "text-green-600" : "text-red-500")}>
                  {fmt(Number(line.amount))}
                </TableCell>
                <TableCell className="text-[10px] py-1.5">
                  <Badge variant="outline" className={cn("text-[9px] h-4 px-1", line.platform === "deliveroo" ? "border-cyan-500 text-cyan-600" : "border-green-500 text-green-600")}>
                    {line.platform === "deliveroo" ? "Deliveroo" : "Uber"}
                  </Badge>
                </TableCell>
                <TableCell className="text-[10px] py-1.5 text-muted-foreground font-mono">
                  {line.payout_reference_id ? line.payout_reference_id.slice(0, 12) + "…" : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}
