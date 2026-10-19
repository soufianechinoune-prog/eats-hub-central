import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, addMonths, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIPromptsTab } from "@/components/admin/AIPromptsTab";

const USD_TO_EUR = 0.92;
const usd = (n: number | null | undefined, d = 2) => `${Number(n ?? 0).toFixed(d)} $`;
const dt = (s: string | null) => (s ? format(new Date(s), "dd/MM/yyyy HH:mm") : "—");

interface Kpis { cost_usd: number; questions: number; active_users: number; avg_latency_s: number | null; errors: number }
interface ConvMsg { role: string; content: string; at: string }

const rpc = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw error;
  return data as T;
};

export default function AdminAIUsage() {
  const { data: isSuperAdmin, isLoading: checking } = useIsSuperAdmin();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const m = format(month, "yyyy-MM-dd");
  const enabled = isSuperAdmin === true;

  const kpis = useQuery({ queryKey: ["ai-usage-kpis", m], enabled, queryFn: () => rpc<Kpis>("admin_ai_usage_kpis", { p_month: m }) });
  const chains = useQuery({ queryKey: ["ai-usage-chains", m], enabled, queryFn: () => rpc<any[]>("admin_ai_usage_by_chain", { p_month: m }) });
  const users = useQuery({ queryKey: ["ai-usage-users", m], enabled, queryFn: () => rpc<any[]>("admin_ai_usage_top_users", { p_month: m }) });
  const daily = useQuery({ queryKey: ["ai-usage-daily", m], enabled, queryFn: () => rpc<any[]>("admin_ai_usage_daily", { p_month: m }) });
  const errors = useQuery({ queryKey: ["ai-usage-errors"], enabled, queryFn: () => rpc<any[]>("admin_ai_usage_errors") });
  const convs = useQuery({
    queryKey: ["ai-usage-convs", user?.id], enabled: enabled && !!user,
    queryFn: () => rpc<any[]>("admin_ai_user_conversations", { p_user_id: user!.id }),
  });

  if (checking) return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isSuperAdmin) return <Navigate to="/overview" replace />;

  const isCurrent = format(month, "yyyy-MM") === format(new Date(), "yyyy-MM");
  const k = kpis.data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Sparkles className="h-5 w-5" /> Usage IA — Mijo</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-32 text-center font-medium capitalize">{format(month, "MMMM yyyy", { locale: fr })}</span>
          <Button variant="outline" size="icon" disabled={isCurrent} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <Tabs defaultValue="usage">
      <TabsList><TabsTrigger value="usage">Usage</TabsTrigger><TabsTrigger value="prompts">Prompts</TabsTrigger></TabsList>
      <TabsContent value="usage" className="space-y-6">

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Coût du mois" value={usd(k?.cost_usd)} sub={`≈ ${(Number(k?.cost_usd ?? 0) * USD_TO_EUR).toFixed(2)} € (indicatif)`} />
        <Kpi label="Questions" value={String(k?.questions ?? 0)} />
        <Kpi label="Utilisateurs actifs" value={String(k?.active_users ?? 0)} />
        <Kpi label="Latence moyenne" value={k?.avg_latency_s != null ? `${Number(k.avg_latency_s).toFixed(1)} s` : "—"} />
        <Kpi label="Erreurs" value={<span className="flex items-center gap-2">{k?.errors ?? 0}{(k?.errors ?? 0) > 0 && <Badge variant="destructive">à vérifier</Badge>}</span>} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Par enseigne</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Enseigne</TableHead><TableHead className="w-64">Questions / limite</TableHead><TableHead className="text-right">Coût</TableHead><TableHead className="text-right">Coût / question</TableHead><TableHead>Dernière activité</TableHead><TableHead>Option IA</TableHead><TableHead>Limite</TableHead><TableHead>Modèle</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(chains.data ?? []).map((c) => <ChainRow key={c.chain_id} c={c} month={m} />)}
              {chains.data?.length === 0 && <Empty cols={9} />}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Coût par jour</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={(daily.data ?? []).map((d) => ({ ...d, cost_usd: Number(d.cost_usd), label: format(new Date(d.day + "T12:00:00"), "dd") }))}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} $`} />
              <Tooltip formatter={(v: number) => usd(v, 4)} labelFormatter={(_, p) => (p?.[0] ? `${format(new Date(p[0].payload.day + "T12:00:00"), "dd/MM")} — ${p[0].payload.questions} questions` : "")} />
              <Bar dataKey="cost_usd" name="Coût" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 20 utilisateurs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Enseigne</TableHead><TableHead className="text-right">Questions</TableHead><TableHead className="text-right">Coût</TableHead><TableHead className="text-right">Latence</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(users.data ?? []).map((u) => (
                <TableRow key={`${u.user_id}-${u.chain_id}`}>
                  <TableCell>{u.email ?? u.user_id}</TableCell>
                  <TableCell>{u.chain_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.questions}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(u.cost_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.avg_latency_s != null ? `${Number(u.avg_latency_s).toFixed(1)} s` : "—"}</TableCell>
                  <TableCell><Button variant="link" size="sm" onClick={() => setUser({ id: u.user_id, email: u.email })}>Voir conversations</Button></TableCell>
                </TableRow>
              ))}
              {users.data?.length === 0 && <Empty cols={6} />}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Journal des erreurs (50 dernières)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Enseigne</TableHead><TableHead>Utilisateur</TableHead><TableHead>Message</TableHead><TableHead className="text-right">Durée</TableHead></TableRow></TableHeader>
            <TableBody>
              {(errors.data ?? []).map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap">{dt(e.created_at)}</TableCell>
                  <TableCell><Badge variant={e.status === "error" ? "destructive" : "secondary"}>{e.status === "error" ? "Erreur" : "Quota atteint"}</Badge></TableCell>
                  <TableCell>{e.chain_name ?? "—"}</TableCell>
                  <TableCell>{e.email ?? "—"}</TableCell>
                  <TableCell className="max-w-md truncate" title={e.error_message ?? ""}>{e.error_message ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.duration_ms != null ? `${(e.duration_ms / 1000).toFixed(1)} s` : "—"}</TableCell>
                </TableRow>
              ))}
              {errors.data?.length === 0 && <Empty cols={6} />}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </TabsContent>
      <TabsContent value="prompts"><AIPromptsTab /></TabsContent>
      </Tabs>

      <Sheet open={!!user} onOpenChange={(o) => !o && setUser(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader><SheetTitle>Conversations — {user?.email}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-6">
            {convs.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            {convs.data?.length === 0 && <p className="text-sm text-muted-foreground">Aucune conversation.</p>}
            {(convs.data ?? []).map((c) => (
              <div key={c.conversation_id} className="rounded-lg border p-4">
                <div className="mb-3 flex justify-between gap-2 text-sm"><span className="font-medium">{c.title ?? "Sans titre"}</span><span className="text-muted-foreground">{dt(c.updated_at)}</span></div>
                <div className="space-y-2">
                  {(c.messages as ConvMsg[]).map((msg, i) => (
                    <div key={i} className={`whitespace-pre-wrap rounded-md p-2 text-sm ${msg.role === "user" ? "bg-muted" : "bg-card"}`}>
                      <span className="mr-2 text-xs font-semibold text-muted-foreground">{msg.role === "user" ? "Question" : "Mijo"}</span>{msg.content}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );
}

const Empty = ({ cols }: { cols: number }) => (
  <TableRow><TableCell colSpan={cols} className="text-center text-sm text-muted-foreground">Aucune donnée</TableCell></TableRow>
);

const MODELS: Record<string, string> = { "claude-sonnet-5-5": "Sonnet 5.5 (qualité)", "claude-haiku-5-5": "Haiku 5.5 (éco)" };

function ChainRow({ c, month }: { c: any; month: string }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState<boolean>(c.enabled);
  const [limit, setLimit] = useState<number>(c.monthly_limit);
  const [model, setModel] = useState<string>(c.model);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = enabled !== c.enabled || limit !== c.monthly_limit || model !== c.model;
  const valid = Number.isInteger(limit) && limit >= 100 && limit <= 10000;
  const isCurrent = month === format(startOfMonth(new Date()), "yyyy-MM-dd");

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase.rpc as any)("admin_set_ai_quota", { p_chain_id: c.chain_id, p_enabled: enabled, p_monthly_limit: limit, p_model: model });
    setSaving(false); setConfirm(false);
    if (error) return toast.error(error.message);
    toast.success(`${c.chain_name} : réglages enregistrés`);
    qc.invalidateQueries({ queryKey: ["ai-usage-chains"] });
    qc.invalidateQueries({ queryKey: ["ai-option-enabled"] });
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{c.chain_name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={Math.min(100, (c.used_questions / Math.max(1, c.monthly_limit)) * 100)} className="h-2" />
          <span className="whitespace-nowrap text-sm tabular-nums">{c.used_questions}/{c.monthly_limit}</span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{usd(c.cost_usd)}</TableCell>
      <TableCell className="text-right tabular-nums">{c.avg_cost_per_question != null ? usd(c.avg_cost_per_question, 4) : "—"}</TableCell>
      <TableCell className="whitespace-nowrap">{dt(c.last_activity)}</TableCell>
      <TableCell><Switch checked={enabled} onCheckedChange={setEnabled} disabled={!isCurrent} aria-label={`Option IA ${c.chain_name}`} /></TableCell>
      <TableCell><Input type="number" min={100} max={10000} step={50} value={limit} disabled={!isCurrent} onChange={(e) => setLimit(Number(e.target.value))} className={`h-8 w-24 ${valid ? "" : "border-destructive"}`} /></TableCell>
      <TableCell>
        <Select value={model} onValueChange={setModel} disabled={!isCurrent}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(MODELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button size="sm" disabled={!dirty || !valid || !isCurrent} onClick={() => setConfirm(true)}>Enregistrer</Button>
        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Modifier l'option IA — {c.chain_name}</AlertDialogTitle>
              <AlertDialogDescription>
                Option {enabled ? "active" : "désactivée"} · limite {limit} questions/mois · {MODELS[model]}.
                S'applique au mois en cours et aux mois suivants.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); save(); }} disabled={saving}>{saving ? "Enregistrement…" : "Confirmer"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
