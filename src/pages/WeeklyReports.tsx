import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Send, Trash2, Plus, Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type ReportRow = {
  id: string;
  chain_id: string;
  week_start: string;
  week_end: string;
  xlsx_path: string | null;
  status: string;
  sent_to: string[] | null;
  sent_at: string | null;
  totals: any;
  created_at: string;
};

type Recipient = { id: string; email: string; active: boolean };

const fmtEur = (n?: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n ?? 0);

export default function WeeklyReports() {
  const { selectedChainId } = useAnalyticsContext();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const load = async () => {
    if (!selectedChainId) return;
    setLoading(true);
    const [r1, r2] = await Promise.all([
      supabase.from("weekly_reports").select("*").eq("chain_id", selectedChainId).order("week_start", { ascending: false }).limit(50),
      supabase.from("weekly_report_recipients").select("*").eq("chain_id", selectedChainId).order("created_at"),
    ]);
    if (r1.data) setReports(r1.data as ReportRow[]);
    if (r2.data) setRecipients(r2.data as Recipient[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedChainId]);

  const addRecipient = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !selectedChainId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email invalide");
      return;
    }
    const { error } = await supabase.from("weekly_report_recipients").insert({ chain_id: selectedChainId, email });
    if (error) return toast.error(error.message);
    setNewEmail("");
    toast.success("Destinataire ajouté");
    load();
  };

  const removeRecipient = async (id: string) => {
    const { error } = await supabase.from("weekly_report_recipients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleRecipient = async (r: Recipient) => {
    await supabase.from("weekly_report_recipients").update({ active: !r.active }).eq("id", r.id);
    load();
  };

  const generateNow = async (send: boolean) => {
    if (!selectedChainId) return;
    setBusy(true);
    try {
      const fn = send ? "send-weekly-uber-report" : "generate-weekly-uber-report";
      const { data, error } = await supabase.functions.invoke(fn, { body: { chainId: selectedChainId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(send ? `Rapport envoyé (${data.sent?.length ?? 0} destinataire·s)` : "Rapport généré");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("weekly-reports").createSignedUrl(path, 60 * 5);
    if (error || !data) return toast.error("Lien indisponible");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-6xl py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rapports hebdo Uber Eats</h1>
            <p className="text-muted-foreground mt-1">
              Envoi automatique chaque lundi matin. Généré pour la semaine précédente (lundi → dimanche, heure de Paris).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => generateNow(false)} disabled={busy || !selectedChainId}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="ml-2">Générer</span>
            </Button>
            <Button onClick={() => generateNow(true)} disabled={busy || !selectedChainId || recipients.filter(r => r.active).length === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-2">Générer + envoyer</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Destinataires</CardTitle>
            <CardDescription>Emails qui recevront le rapport chaque lundi matin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="prenom@exemple.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRecipient()}
              />
              <Button onClick={addRecipient}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </div>
            {recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun destinataire pour l'instant.</p>
            ) : (
              <ul className="divide-y">
                {recipients.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{r.email}</span>
                      <Badge variant={r.active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleRecipient(r)}>
                        {r.active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeRecipient(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
            <CardDescription>50 derniers rapports générés</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Aucun rapport pour l'instant. Cliquez sur « Générer » pour créer le premier.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semaine</TableHead>
                    <TableHead>CA brut TTC</TableHead>
                    <TableHead>Commandes</TableHead>
                    <TableHead>Versement</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Envoyé à</TableHead>
                    <TableHead className="text-right">Fichier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {format(new Date(r.week_start), "d MMM", { locale: fr })} – {format(new Date(r.week_end), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>{fmtEur(r.totals?.ca_brut_ttc)}</TableCell>
                      <TableCell>{(r.totals?.orders_count ?? 0).toLocaleString("fr-FR")}</TableCell>
                      <TableCell>{fmtEur(r.totals?.payout_total)}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "sent" ? "default" : r.status === "error" ? "destructive" : "secondary"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.sent_to?.length ? `${r.sent_to.length} email(s)` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.xlsx_path && (
                          <Button size="sm" variant="ghost" onClick={() => download(r.xlsx_path!)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
