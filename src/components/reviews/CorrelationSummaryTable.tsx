import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface DataPoint {
  date: string;
  avgRating: number;
  revenue: number;
  orders: number;
  avgBasket: number;
}

interface CorrelationSummaryTableProps {
  data: DataPoint[];
}

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  
  const change = ((current - previous) / previous) * 100;
  
  if (change > 5) {
    return (
      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <TrendingUp className="h-3.5 w-3.5" />
        <span className="text-xs">+{change.toFixed(0)}%</span>
      </div>
    );
  } else if (change < -5) {
    return (
      <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <TrendingDown className="h-3.5 w-3.5" />
        <span className="text-xs">{change.toFixed(0)}%</span>
      </div>
    );
  }
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getRatingColor(rating: number): string {
  if (rating >= 4.5) return "text-green-600 dark:text-green-400";
  if (rating >= 4.0) return "text-lime-600 dark:text-lime-400";
  if (rating >= 3.5) return "text-amber-600 dark:text-amber-400";
  if (rating >= 3.0) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export function CorrelationSummaryTable({ data }: CorrelationSummaryTableProps) {
  // Show last 10 periods max
  const displayData = data.slice(-10);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Récapitulatif par période
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="text-center">Note moy.</TableHead>
                <TableHead className="text-right">CA (€)</TableHead>
                <TableHead className="text-center">Évol.</TableHead>
                <TableHead className="text-right">Commandes</TableHead>
                <TableHead className="text-center">Évol.</TableHead>
                <TableHead className="text-right">Panier moy.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, index) => {
                const previous = index > 0 ? displayData[index - 1] : null;
                return (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">
                      {format(new Date(row.date), "d MMM", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${getRatingColor(row.avgRating)}`}>
                        {row.avgRating.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.revenue.toLocaleString("fr-FR")} €
                    </TableCell>
                    <TableCell className="text-center">
                      {previous && <TrendIndicator current={row.revenue} previous={previous.revenue} />}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.orders}
                    </TableCell>
                    <TableCell className="text-center">
                      {previous && <TrendIndicator current={row.orders} previous={previous.orders} />}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.avgBasket.toFixed(2)} €
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
