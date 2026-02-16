import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

interface DetailLine {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  payout_reference_id: string | null;
  payout_date: string | null;
  description: string | null;
  amount: number;
}

interface EcoContributionDetailProps {
  detailLines: DetailLine[];
  restaurantMap: Map<string, string>;
}

const PAGE_SIZE = 50;

export function EcoContributionDetail({ detailLines, restaurantMap }: EcoContributionDetailProps) {
  const [page, setPage] = useState(0);
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }, [filtered]);

  const fmt = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const fmtDate = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("fr-FR");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Lignes individuelles
          </CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              {filtered.length} lignes · Total: {fmt(totalAmount)}
            </Badge>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher restaurant, référence..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Réf. versement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Aucune ligne trouvée
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="text-sm">{fmtDate(line.payout_date)}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {restaurantMap.get(line.restaurant_id) || line.restaurant_name || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{line.description || "-"}</TableCell>
                  <TableCell className={`text-right text-sm font-medium ${Number(line.amount) >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {fmt(Number(line.amount))}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {line.payout_reference_id ? line.payout_reference_id.slice(0, 12) + "…" : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} / {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
