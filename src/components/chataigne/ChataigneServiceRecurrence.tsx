import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bike, ShoppingBag, Repeat, ArrowRight } from "lucide-react";
import type { RestaurantScope } from "@/hooks/useChataigne";

interface Stat {
  clients: number; reguliers: number; recurrence_pct: number | null;
  commandes: number; freq: number | null; ca: number; panier: number | null;
}
interface ModeStat extends Stat { mode: "delivery" | "collection" }
interface FamStat extends Stat { famille: "delivery_only" | "collection_only" | "both"; part_pct: number | null }
interface RecurrenceData {
  modes: ModeStat[]; familles: FamStat[]; clients_total: number;
  parcours: { recurrents: number; delivery_to_collection: number; collection_to_delivery: number; delivery_stay: number; collection_stay: number } | null;
}

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const fmtEur = (v: number | null, d = 2) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: d, maximumFractionDigits: d }).format(v || 0);
const fmtPct = (v: number | null) => (v == null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`);
const fmtNum = (v: number | null) => (v == null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v));

const FAMS: { key: FamStat["famille"]; label: string; icon: JSX.Element }[] = [
  { key: "delivery_only", label: "Livraison uniquement", icon: <Bike className="h-4 w-4" /> },
  { key: "collection_only", label: "Emporté uniquement", icon: <ShoppingBag className="h-4 w-4" /> },
  { key: "both", label: "Les deux modes", icon: <Repeat className="h-4 w-4" /> },
];

interface Props { start: string; end: string; restaurantIds: RestaurantScope }

export function ChataigneServiceRecurrence({ start, end, restaurantIds }: Props) {
  const scope = restaurantIds === undefined ? "pending" : restaurantIds === null ? "all" : [...restaurantIds].sort().join(",");
  const { data, isLoading } = useQuery({
    queryKey: ["chataigne-service-recurrence", start, end, scope],
    enabled: restaurantIds !== undefined,
    queryFn: async (): Promise<RecurrenceData> => {
      const { data, error } = await supabase.rpc("get_chataigne_service_recurrence" as never, {
        p_start: start, p_end: end, p_restaurant_ids: restaurantIds ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as RecurrenceData;
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const mode = (m: ModeStat["mode"]) => data.modes.find((x) => x.mode === m);
  const fam = (f: FamStat["famille"]) => data.familles.find((x) => x.famille === f);
  const p = data.parcours;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Récurrence par mode</CardTitle>
          <CardDescription>Part des clients ayant commandé au moins 2 fois dans ce mode sur la période.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {(["delivery", "collection"] as const).map((m) => {
            const s = mode(m);
            return (
              <div key={m} className="rounded-xl border bg-muted/30 p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  {m === "delivery" ? <Bike className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                  {m === "delivery" ? "Livraison" : "Emporté"}
                </div>
                <div className="mt-2 text-4xl font-bold text-foreground">{fmtPct(s?.recurrence_pct ?? null)}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {fmtInt(s?.reguliers ?? 0)} réguliers sur {fmtInt(s?.clients ?? 0)} clients · {fmtNum(s?.freq ?? null)} cmd/client · panier {fmtEur(s?.panier ?? null)}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profils de clients</CardTitle>
          <CardDescription>Chaque client est classé selon les modes utilisés sur la période ({fmtInt(data.clients_total)} clients).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-2">Profil</th><th className="text-right">Clients</th><th className="text-right">Part</th>
                <th className="text-right">Récurrence</th><th className="text-right">Cmd/client</th>
                <th className="text-right">Panier moyen</th><th className="text-right">CA</th>
              </tr>
            </thead>
            <tbody>
              {FAMS.map(({ key, label, icon }) => {
                const s = fam(key);
                return (
                  <tr key={key} className="border-b last:border-0">
                    <td className="py-3"><span className="flex items-center gap-2 font-medium">{icon}{label}</span></td>
                    <td className="text-right">{fmtInt(s?.clients ?? 0)}</td>
                    <td className="text-right">{fmtPct(s?.part_pct ?? null)}</td>
                    <td className="text-right font-semibold">{fmtPct(s?.recurrence_pct ?? null)}</td>
                    <td className="text-right">{fmtNum(s?.freq ?? null)}</td>
                    <td className="text-right">{fmtEur(s?.panier ?? null)}</td>
                    <td className="text-right">{fmtEur(s?.ca ?? 0, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {p && (
        <Card>
          <CardHeader>
            <CardTitle>Parcours des clients réguliers</CardTitle>
            <CardDescription>Pour les {fmtInt(p.recurrents)} clients avec 2 commandes ou plus : mode de la 1ʳᵉ commande, puis ce qu'ils ont fait ensuite.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {[
              { from: "Livraison", to: "a aussi pris de l'emporté", n: p.delivery_to_collection },
              { from: "Livraison", to: "reste en livraison", n: p.delivery_stay },
              { from: "Emporté", to: "a aussi pris la livraison", n: p.collection_to_delivery },
              { from: "Emporté", to: "reste en emporté", n: p.collection_stay },
            ].map((r) => (
              <div key={r.from + r.to} className="flex items-center justify-between rounded-lg border p-4">
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{r.from}</span><ArrowRight className="h-4 w-4 text-muted-foreground" />{r.to}
                </span>
                <span className="text-right">
                  <span className="text-xl font-bold">{fmtInt(r.n)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{fmtPct(p.recurrents ? (100 * r.n) / p.recurrents : null)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
