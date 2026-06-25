import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LiveTopRestaurant } from "@/hooks/useLiveOverview";

function eur(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

function pct(part: number, total: number) {
  if (!total) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

interface Props {
  rows: LiveTopRestaurant[];
  isLoading?: boolean;
}

export function LiveTopRestaurants({ rows, isLoading }: Props) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-3">Top 10 restaurants en direct</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead className="text-right">CA total</TableHead>
              <TableHead className="text-right">Cmds</TableHead>
              <TableHead className="text-right">Uber</TableHead>
              <TableHead className="text-right">Dishop</TableHead>
              <TableHead className="text-right">Caisse</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Aucune activité détectée aujourd'hui.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={r.restaurant_id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(Number(r.total_revenue))}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(r.total_orders).toLocaleString("fr-FR")}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {pct(Number(r.uber_revenue), Number(r.total_revenue))}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {pct(Number(r.dishop_revenue), Number(r.total_revenue))}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {pct(Number(r.splash_revenue), Number(r.total_revenue))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
