import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";

const eur = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

interface Unmapped {
  chataigne_name_norm: string;
  sample_name: string;
  n_lines: number;
  ca_ttc: number;
  n_restaurants: number;
  n_restaurants_unmapped: number;
}
interface Candidate { name_norm: string; sample_name: string; n_restaurants: number; qty: number }

function MappingRow({ row, chainId, candidates, onSaved }: { row: Unmapped; chainId: string; candidates: Candidate[]; onSaved: () => void }) {
  const [filter, setFilter] = useState("");
  const [choice, setChoice] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (f ? candidates.filter((c) => c.name_norm.includes(f)) : candidates).slice(0, 80);
  }, [filter, candidates]);

  const save = async () => {
    if (!choice) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_chataigne_product_mapping", {
      p_chain_id: chainId, p_chataigne_name_norm: row.chataigne_name_norm, p_caisse_name_norm: choice,
    });
    setSaving(false);
    if (error) toast({ title: "Correspondance refusée", description: error.message, variant: "destructive" });
    else { toast({ title: "Correspondance validée", description: row.sample_name }); onSaved(); }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{row.sample_name}</TableCell>
      <TableCell className="text-right tabular-nums">{eur(Number(row.ca_ttc))}</TableCell>
      <TableCell className="text-right tabular-nums">{row.n_lines}</TableCell>
      <TableCell className="text-right tabular-nums">{row.n_restaurants_unmapped} / {row.n_restaurants}</TableCell>
      <TableCell className="min-w-[340px]">
        <div className="flex gap-2">
          <Input placeholder="Filtrer…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-28" />
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Produit caisse…" /></SelectTrigger>
            <SelectContent>
              {shown.map((c) => (
                <SelectItem key={c.name_norm} value={c.name_norm}>{c.sample_name} · {c.n_restaurants} restos</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" disabled={!choice || saving} onClick={save} aria-label="Valider">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AdminChataigneProductMapping() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isSuperAdmin, isLoading: checking } = useIsSuperAdmin();
  const [chainId, setChainId] = useState<string>("");
  const end = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const start = format(subDays(new Date(), 60), "yyyy-MM-dd");

  useEffect(() => { if (!checking && isSuperAdmin === false) navigate("/overview"); }, [checking, isSuperAdmin, navigate]);

  const chains = useQuery({
    queryKey: ["admin-chains-list"], enabled: isSuperAdmin === true,
    queryFn: async () => (await supabase.from("chains").select("id,name").order("name")).data ?? [],
  });
  useEffect(() => { if (!chainId && chains.data?.length) setChainId(chains.data[0].id); }, [chains.data, chainId]);

  const enabled = isSuperAdmin === true && !!chainId;
  const coverage = useQuery({
    queryKey: ["chataigne-map-coverage", chainId, start, end], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_chataigne_mapping_coverage", { p_chain_id: chainId, p_start: start, p_end: end });
      if (error) throw error; return data?.[0];
    },
  });
  const unmapped = useQuery({
    queryKey: ["chataigne-unmapped", chainId, start, end], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_chataigne_unmapped_products", { p_chain_id: chainId, p_start: start, p_end: end });
      if (error) throw error; return (data ?? []) as Unmapped[];
    },
  });
  const candidates = useQuery({
    queryKey: ["caisse-candidates", chainId], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_caisse_product_candidates", { p_chain_id: chainId });
      if (error) throw error; return (data ?? []) as Candidate[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["chataigne-unmapped", chainId] });
    qc.invalidateQueries({ queryKey: ["chataigne-map-coverage", chainId] });
  };

  if (checking || !isSuperAdmin) return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  const c = coverage.data;
  const pl = c && c.n_lines ? (100 * Number(c.n_mapped)) / Number(c.n_lines) : null;
  const pca = c && Number(c.ca_ttc) ? (100 * Number(c.ca_mapped)) / Number(c.ca_ttc) : null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Correspondances produits Châtaigne ↔ caisse</h1>
          <p className="text-sm text-muted-foreground">
            Produits Châtaigne sans équivalent exact en caisse, du {start} au {end}. Chaque correspondance est validée à la main ;
            le prix de référence reste celui observé en caisse dans chaque restaurant.
          </p>
        </div>
        <Select value={chainId} onValueChange={setChainId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Enseigne" /></SelectTrigger>
          <SelectContent>{(chains.data ?? []).map((ch) => <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Lignes couvertes</CardDescription>
          <CardTitle className="tabular-nums">{pl == null ? "…" : `${pl.toFixed(1)} %`}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>CA couvert</CardDescription>
          <CardTitle className="tabular-nums">{pca == null ? "…" : `${pca.toFixed(1)} %`}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Produits à rapprocher</CardDescription>
          <CardTitle className="tabular-nums">{unmapped.data?.length ?? "…"}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Non rapprochés, triés par CA</CardTitle>
          <CardDescription>Aucune suggestion automatique. <Badge variant="outline">Restos non couverts / total</Badge></CardDescription>
        </CardHeader>
        <CardContent>
          {unmapped.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : unmapped.error ? (
            <p className="text-sm text-destructive">Chargement impossible : {(unmapped.error as Error).message}</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produit Châtaigne</TableHead><TableHead className="text-right">CA TTC</TableHead>
                <TableHead className="text-right">Lignes</TableHead><TableHead className="text-right">Restos</TableHead>
                <TableHead>Produit caisse correspondant</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(unmapped.data ?? []).slice(0, 200).map((r) => (
                  <MappingRow key={r.chataigne_name_norm} row={r} chainId={chainId} candidates={candidates.data ?? []} onSaved={refresh} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
