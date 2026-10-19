import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface PromptRow { scope: "global" | "chain"; chain_id: string | null; chain_name: string | null; content: string; is_active: boolean; updated_at: string | null; updated_by_email: string | null }
const MAX = 8000;

export function AIPromptsTab() {
  const q = useQuery({
    queryKey: ["ai-prompts"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_get_ai_prompts");
      if (error) throw error;
      return data as PromptRow[];
    },
  });
  const rows = q.data ?? [];
  const global = rows.find((r) => r.scope === "global");
  const chains = rows.filter((r) => r.scope === "chain").sort((a, b) => (a.chain_name ?? "").localeCompare(b.chain_name ?? ""));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Les règles de sécurité (isolation par enseigne, pas de chiffre inventé) et la liste des restaurants sont toujours ajoutées après ces consignes et ne peuvent pas être contournées.
      </p>
      {global && <PromptEditor row={global} title="Prompt global (toutes enseignes)" />}
      {chains.map((r) => <PromptEditor key={r.chain_id} row={r} title={`Consignes — ${r.chain_name}`} />)}
    </div>
  );
}

function PromptEditor({ row, title }: { row: PromptRow; title: string }) {
  const qc = useQueryClient();
  const [content, setContent] = useState(row.content);
  const [active, setActive] = useState(row.is_active);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setContent(row.content); setActive(row.is_active); }, [row.content, row.is_active]);
  const dirty = content !== row.content || active !== row.is_active;

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase.rpc as any)("admin_set_ai_prompt", { p_scope: row.scope, p_chain_id: row.chain_id, p_content: content, p_is_active: active });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Prompt enregistré");
    qc.invalidateQueries({ queryKey: ["ai-prompts"] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex items-center gap-2 text-sm">
          {!row.updated_at && row.scope === "chain" && <Badge variant="secondary">Non défini</Badge>}
          <span className="text-muted-foreground">Actif</span>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, MAX))} rows={row.scope === "global" ? 12 : 5}
          placeholder="Consignes propres à cette enseigne (ton, priorités, vocabulaire…)" className="font-mono text-xs" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{content.length} / {MAX} caractères{row.updated_at && ` · modifié le ${format(new Date(row.updated_at), "dd/MM/yyyy HH:mm")}${row.updated_by_email ? ` par ${row.updated_by_email}` : ""}`}</span>
          <Button size="sm" disabled={!dirty || saving} onClick={save}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
