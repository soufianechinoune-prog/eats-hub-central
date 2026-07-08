import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyRound, Plus, Trash2, Copy, Check } from "lucide-react";

interface Chain {
  id: string;
  name: string;
}

interface ApiKeyRow {
  id: string;
  chain_id: string;
  chain_name?: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `cs_${hex}`;
}

export function AdminApiKeysSection({ chains }: { chains: Chain[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newChainId, setNewChainId] = useState<string>("");
  const [revealed, setRevealed] = useState<{ key: string; label: string; chain: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["admin-api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, chain_id, label, key_prefix, created_at, last_used_at, revoked_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const chainMap = new Map(chains.map((c) => [c.id, c.name]));
      return (data ?? []).map((k: any) => ({
        ...k,
        chain_name: chainMap.get(k.chain_id) ?? "—",
      })) as ApiKeyRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newChainId || !newLabel.trim()) throw new Error("Marque et libellé requis");
      const rawKey = generateApiKey();
      const keyHash = await sha256Hex(rawKey);
      const keyPrefix = rawKey.slice(0, 10);
      const { error } = await supabase.from("api_keys").insert({
        chain_id: newChainId,
        label: newLabel.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
      });
      if (error) throw error;
      return { key: rawKey };
    },
    onSuccess: ({ key }) => {
      const chainName = chains.find((c) => c.id === newChainId)?.name ?? "";
      setRevealed({ key, label: newLabel, chain: chainName });
      setNewLabel("");
      qc.invalidateQueries({ queryKey: ["admin-api-keys"] });
    },
    onError: (err: any) =>
      toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Clé révoquée" });
      qc.invalidateQueries({ queryKey: ["admin-api-keys"] });
    },
    onError: (err: any) =>
      toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-api-keys"] });
    },
  });

  const copyKey = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Clés API — Rapport hebdomadaire Uber
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md bg-muted p-4 text-sm space-y-2">
            <div className="font-medium">Endpoint</div>
            <code className="block text-xs bg-background px-2 py-1 rounded border">
              GET https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api
            </code>
            <div className="text-xs text-muted-foreground">
              Header : <code>x-api-key: &lt;clé&gt;</code> — Params : <code>?list=1</code> (liste
              des semaines) · <code>?weekStart=YYYY-MM-DD</code> (une semaine) ·{" "}
              <code>?from=YYYY-MM-DD&amp;to=YYYY-MM-DD</code> (plage) ·{" "}
              <code>?granularity=network|by_day|by_restaurant|by_day_restaurant|all</code>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Marque</label>
              <Select value={newChainId} onValueChange={setNewChainId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une marque" />
                </SelectTrigger>
                <SelectContent>
                  {chains.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Libellé</label>
              <Input
                placeholder="Ex: Power BI - Responsable"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newChainId || !newLabel.trim() || createMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Générer une clé
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Marque</TableHead>
                <TableHead>Clé</TableHead>
                <TableHead>Créée</TableHead>
                <TableHead>Dernier appel</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && keys?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucune clé API pour l'instant.
                  </TableCell>
                </TableRow>
              )}
              {keys?.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.label}</TableCell>
                  <TableCell>{k.chain_name}</TableCell>
                  <TableCell>
                    <code className="text-xs">{k.key_prefix}…</code>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(k.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.last_used_at
                      ? new Date(k.last_used_at).toLocaleString("fr-FR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {k.revoked_at ? (
                      <Badge variant="destructive">Révoquée</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {!k.revoked_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeMutation.mutate(k.id)}
                      >
                        Révoquer
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteMutation.mutate(k.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clé API générée</DialogTitle>
            <DialogDescription>
              Copie cette clé maintenant — elle ne sera plus jamais affichée en clair.
            </DialogDescription>
          </DialogHeader>
          {revealed && (
            <div className="space-y-3">
              <div className="text-sm">
                <div>
                  <span className="text-muted-foreground">Marque :</span> {revealed.chain}
                </div>
                <div>
                  <span className="text-muted-foreground">Libellé :</span> {revealed.label}
                </div>
              </div>
              <div className="flex gap-2">
                <Input readOnly value={revealed.key} className="font-mono text-xs" />
                <Button variant="outline" onClick={copyKey}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="rounded-md bg-muted p-3 text-xs font-mono">
                curl -H "x-api-key: {revealed.key}" \<br />
                &nbsp;&nbsp;"https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?list=1"
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>J'ai copié la clé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
