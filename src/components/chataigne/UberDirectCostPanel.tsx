import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Row {
  restaurant_id: string; courses: number; courses_livrees: number; fee_cents: number;
  fees_collected_cents: number; reste_a_charge_cents: number; fee_calc_cents: number;
  n_calcules: number; n_a_verifier: number; n_detail_absent: number;
  rac_a_verifier_min_cents: number; rac_a_verifier_max_cents: number; n_non_apparies: number;
}

const eur = (c: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format((c || 0) / 100);
const int = (v: number) => new Intl.NumberFormat("fr-FR").format(v || 0);

interface Props {
  start: string; end: string;
  restaurantIds: string[] | undefined;
  restaurants: { id: string; name: string }[];
}

export function UberDirectCostPanel({ start, end, restaurantIds, restaurants }: Props) {
  const key = restaurantIds ? [...restaurantIds].sort().join(",") : "pending";
  const { data, isLoading } = useQuery({
    queryKey: ["uber-direct-cost", start, end, key],
    enabled: !!restaurantIds && restaurantIds.length > 0,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc("get_uber_direct_cost_summary", {
        p_restaurant_ids: restaurantIds!, p_start: start, p_end: end,
      });
      if (error) throw error;
      return (data ?? []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === "restaurant_id" ? v : Number(v)])) as unknown as Row);
    },
  });

  const names = useMemo(() => new Map(restaurants.map((r) => [r.id, r.name])), [restaurants]);
  const rows = data ?? [];
  const t = rows.reduce((a, r) => {
    (Object.keys(r) as (keyof Row)[]).forEach((k) => { if (k !== "restaurant_id") (a[k] as number) = ((a[k] as number) || 0) + (r[k] as number); });
    return a;
  }, {} as Row);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!rows.length) return (
    <Card><CardContent className="py-8 text-sm text-muted-foreground">Aucune course Uber Direct sur cette période et ce périmètre.</CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Courses Uber Direct" value={int(t.courses)} sub={`${int(t.courses_livrees)} livrées`} />
        <Kpi label="Coût Uber (fee)" value={eur(t.fee_cents)} sub="toutes courses de la période" />
        <Kpi label="Frais encaissés client" value={eur(t.fees_collected_cents)} sub={`sur ${int(t.n_calcules)} courses calculées`} />
        <Kpi label="Reste à charge restaurant" value={eur(t.reste_a_charge_cents)} sub={`fee ${eur(t.fee_calc_cents)} − frais encaissés`} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {t.n_a_verifier > 0 && (
          <Badge variant="outline">Attribution à vérifier : {int(t.n_a_verifier)} courses · reste à charge entre {eur(t.rac_a_verifier_min_cents)} et {eur(t.rac_a_verifier_max_cents)} (non inclus ci-dessus)</Badge>
        )}
        {t.n_detail_absent > 0 && (
          <Badge variant="secondary">Détail des lignes absent : {int(t.n_detail_absent)} courses (avant fin septembre) · non calculé</Badge>
        )}
        {t.n_non_apparies > 0 && <Badge variant="outline">Sans commande Châtaigne : {int(t.n_non_apparies)}</Badge>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reste à charge par restaurant</CardTitle>
          <CardDescription>Positif = coût pour le restaurant. Les frais affichés ne sont jamais comptés comme encaissés : une remise sur la livraison les réduit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead className="text-right">Courses</TableHead>
                <TableHead className="text-right">Fee Uber</TableHead>
                <TableHead className="text-right">Frais encaissés</TableHead>
                <TableHead className="text-right">Reste à charge</TableHead>
                <TableHead className="text-right">Par course</TableHead>
                <TableHead className="text-right">À vérifier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows].sort((a, b) => b.reste_a_charge_cents - a.reste_a_charge_cents).map((r) => (
                <TableRow key={r.restaurant_id}>
                  <TableCell>{names.get(r.restaurant_id) ?? "—"}</TableCell>
                  <TableCell className="text-right">{int(r.courses)}</TableCell>
                  <TableCell className="text-right">{eur(r.fee_cents)}</TableCell>
                  <TableCell className="text-right">{eur(r.fees_collected_cents)}</TableCell>
                  <TableCell className="text-right font-medium">{eur(r.reste_a_charge_cents)}</TableCell>
                  <TableCell className="text-right">{r.n_calcules ? eur(Math.round(r.reste_a_charge_cents / r.n_calcules)) : "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.n_a_verifier ? `${r.n_a_verifier} · ${eur(r.rac_a_verifier_min_cents)}–${eur(r.rac_a_verifier_max_cents)}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
