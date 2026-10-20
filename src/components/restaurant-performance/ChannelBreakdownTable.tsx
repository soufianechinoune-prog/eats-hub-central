import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PerfChannel } from "@/hooks/useRestaurantPerformance";
import { CHANNEL_META, fmtEur, fmtEur2, fmtInt } from "./channelMeta";

interface Props {
  rows: { canal: PerfChannel; ca: number; commandes: number }[];
  onOpenChannel: (canal: PerfChannel) => void;
}

export function ChannelBreakdownTable({ rows, onOpenChannel }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Détail par canal</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">CA TTC</TableHead>
              <TableHead className="text-right">Commandes</TableHead>
              <TableHead className="text-right">Panier moyen</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.canal}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHANNEL_META[r.canal].color }} />
                    {CHANNEL_META[r.canal].label}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.ca > 0 ? fmtEur(r.ca) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.commandes > 0 ? fmtInt(r.commandes) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.commandes > 0 ? fmtEur2(r.ca / r.commandes) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => onOpenChannel(r.canal)}>
                    Ouvrir <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
