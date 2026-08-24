import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  GRID_VERSIONS,
  useInstoreGridPrices,
  useRestaurantPriceVersions,
  useSetInstoreGridPrice,
  useSetRestaurantPriceVersion,
} from "@/hooks/useInstorePrices";

const fmtEur = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v);



const VERSION_SECTIONS = [...GRID_VERSIONS, "A_CONFIRMER"] as const;
const VERSION_LABELS: Record<string, string> = {
  V4BIS: "V4 Bis",
  VRE: "V Réunion",
  A_CONFIRMER: "À affecter",
};
const versionLabel = (v: string) => VERSION_LABELS[v] ?? v;
const methodLabel = (m: string | null) => (m === "manuel" ? "manuel" : "auto");

function PriceCell({ value, onSave }: { value: number | null; onSave: (price: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    if (value !== null && Math.abs(parsed - value) < 0.0001) return;
    onSave(parsed);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-8 w-24 text-right"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value !== null ? String(value) : "");
        setEditing(true);
      }}
      className={cn(
        "w-24 rounded-md border border-transparent px-2 py-1 text-right tabular-nums transition-colors hover:border-border hover:bg-muted",
        value === null && "text-muted-foreground"
      )}
    >
      {value === null ? "—" : fmtEur(value)}
    </button>
  );
}

function GridSection() {
  const { data, isLoading } = useInstoreGridPrices();
  const setPrice = useSetInstoreGridPrice();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const products = useMemo(() => {
    const map = new Map<string, { key: string; label: string; prices: Record<string, number> }>();
    for (const r of data ?? []) {
      const entry = map.get(r.product_key) ?? { key: r.product_key, label: r.product_label, prices: {} };
      entry.prices[r.version] = r.price;
      map.set(r.product_key, entry);
    }
    return [...map.values()]
      .filter((p) => p.label.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [data, search]);

  const save = (version: string, product_key: string, price: number) => {
    setPrice.mutate(
      { version, product_key, price },
      {
        onSuccess: () => toast({ title: "Prix mis à jour", description: `${version} · ${fmtEur(price)}` }),
        onError: (e: unknown) =>
          toast({
            title: "Échec de la mise à jour",
            description: e instanceof Error ? e.message : "Erreur inconnue",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Grilles tarifaires
          </CardTitle>
          <CardDescription>4 versions de grille. Cliquez sur un prix pour le modifier.</CardDescription>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="w-64 pl-8"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun produit trouvé.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 min-w-[220px] bg-card">Produit</TableHead>
                  {GRID_VERSIONS.map((v) => (
                    <TableHead key={v} className="whitespace-nowrap text-right">
                      {versionLabel(v)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell className="sticky left-0 z-10 min-w-[220px] bg-card font-medium">{p.label}</TableCell>
                    {GRID_VERSIONS.map((v) => (
                      <TableCell key={v} className="text-right">
                        <div className="flex justify-end">
                          <PriceCell value={p.prices[v] ?? null} onSave={(price) => save(v, p.key, price)} />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VersionsSection() {
  const { data, isLoading } = useRestaurantPriceVersions();
  const setVersion = useSetRestaurantPriceVersion();
  const { toast } = useToast();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof data>();
    for (const v of VERSION_SECTIONS) map.set(v, []);
    for (const r of data ?? []) {
      const key = VERSION_SECTIONS.includes(r.version as never) ? r.version : "A_CONFIRMER";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    for (const [, rows] of map)
      rows?.sort((a, b) => (a.restaurant_name ?? "").localeCompare(b.restaurant_name ?? "", "fr"));
    return map;
  }, [data]);

  const change = (restaurant_id: string, version: string, name: string | null) => {
    setVersion.mutate(
      { restaurant_id, version },
      {
        onSuccess: () =>
          toast({ title: "Version mise à jour", description: `${name ?? "Restaurant"} → ${versionLabel(version)}` }),
        onError: (e: unknown) =>
          toast({
            title: "Échec de la mise à jour",
            description: e instanceof Error ? e.message : "Erreur inconnue",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restaurants par version</CardTitle>
        <CardDescription>Affectation de chaque point de vente à une grille tarifaire.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-40 w-full" />)
        ) : (data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun restaurant.</p>
        ) : (
          VERSION_SECTIONS.map((v) => {
            const rows = grouped.get(v) ?? [];
            return (
              <div key={v} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{versionLabel(v)}</h3>
                  <Badge variant={v === "A_CONFIRMER" ? "destructive" : "secondary"}>
                    {rows.length} resto{rows.length > 1 ? "s" : ""}
                  </Badge>
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun restaurant.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Restaurant</TableHead>
                          <TableHead>Ville</TableHead>
                          
                          <TableHead>Méthode</TableHead>
                          <TableHead className="w-40">Version</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.restaurant_id}>
                            <TableCell className="font-medium">{r.restaurant_name ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{r.city ?? "—"}</TableCell>
                            
                            <TableCell>
                              <Badge variant={r.method === "manuel" ? "default" : "outline"}>
                                {methodLabel(r.method)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={r.version}
                                onValueChange={(val) => change(r.restaurant_id, val, r.restaurant_name)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VERSION_SECTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {versionLabel(opt)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default function InstorePrices() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Prix sur place</h1>
          <p className="text-muted-foreground">
            Grilles tarifaires de référence du réseau, communes à tous les canaux de vente.
          </p>
        </div>

        <GridSection />
        <VersionsSection />
      </div>
    </AppLayout>
  );
}
