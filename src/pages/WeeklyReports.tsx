import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Download, Send, Trash2, Plus, Mail, MessageCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type ReportRow = {
  id: string;
  chain_id: string;
  week_start: string;
  week_end: string;
  xlsx_path: string | null;
  csv_path: string | null;
  status: string;
  sent_to: string[] | null;
  sent_phones: string[] | null;
  sent_via_whatsapp: boolean | null;
  sent_at: string | null;
  totals: any;
  download_token: string | null;
  token_expires_at: string | null;
  created_at: string;
};

type Recipient = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  channel: string;
  active: boolean;
};

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

const fmtEur = (n?: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n ?? 0);

export default function WeeklyReports() {
  const { selectedChainId } = useAnalyticsContext();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneName, setNewPhoneName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [backfillWeeks, setBackfillWeeks] = useState(12);
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null);

  // Compute Monday..Sunday for the week that contains `ref` shifted by `weeksAgo` weeks (Europe/Paris local)
  const computeWeek = (weeksAgo: number) => {
    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
    const daysSinceMonday = (day + 6) % 7;
    const thisMonday = new Date(now);
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(now.getDate() - daysSinceMonday);
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - 7 * weeksAgo);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: format(monday, "yyyy-MM-dd"), end: format(sunday, "yyyy-MM-dd") };
  };


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

  useEffect(() => { load(); }, [selectedChainId]);

  const emailRecipients = recipients.filter(r => r.channel === "email");
  const waRecipients = recipients.filter(r => r.channel === "whatsapp");

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !selectedChainId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Email invalide"); return; }
    const { error } = await supabase.from("weekly_report_recipients").insert({ chain_id: selectedChainId, email, channel: "email" });
    if (error) return toast.error(error.message);
    setNewEmail(""); toast.success("Destinataire email ajouté"); load();
  };

  const addPhone = async () => {
    const phone = newPhone.trim();
    if (!phone || !selectedChainId) return;
    const { error } = await supabase.from("weekly_report_recipients").insert({
      chain_id: selectedChainId, phone, name: newPhoneName.trim() || null, channel: "whatsapp"
    });
    if (error) return toast.error(error.message);
    setNewPhone(""); setNewPhoneName(""); toast.success("Destinataire WhatsApp ajouté"); load();
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

  const generate = async () => {
    if (!selectedChainId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-weekly-uber-report", { body: { chainId: selectedChainId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Rapport généré");
      load();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setBusy(false); }
  };

  const backfillHistory = async () => {
    if (!selectedChainId) return;
    const n = Math.max(1, Math.min(52, Number(backfillWeeks) || 1));
    setBusy(true);
    setBackfillProgress({ done: 0, total: n });
    let ok = 0, fail = 0;
    // weeksAgo=1 = last completed week, then 2, 3, ...
    for (let i = 1; i <= n; i++) {
      const { start, end } = computeWeek(i);
      try {
        const { data, error } = await supabase.functions.invoke("generate-weekly-uber-report", {
          body: { chainId: selectedChainId, weekStart: start, weekEnd: end },
        });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        ok++;
      } catch (e: any) {
        fail++;
        console.error(`Backfill ${start}→${end} failed`, e);
      }
      setBackfillProgress({ done: i, total: n });
    }
    setBackfillProgress(null);
    setBusy(false);
    toast[fail === 0 ? "success" : "warning"](`Historique généré : ${ok} OK${fail ? `, ${fail} échec(s)` : ""}`);
    load();
  };

  const sendWhatsApp = async () => {
    if (!selectedChainId) return;

    if (waRecipients.filter(r => r.active).length === 0) {
      toast.error("Aucun destinataire WhatsApp actif"); return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-weekly-report-whatsapp", { body: { chainId: selectedChainId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Envoyé à ${data.sent?.length ?? 0} destinataire(s) WhatsApp`);
      load();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setBusy(false); }
  };

  const sendEmail = async () => {
    if (!selectedChainId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-weekly-uber-report", { body: { chainId: selectedChainId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Email envoyé à ${data.sent?.length ?? 0} destinataire(s)`);
      load();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setBusy(false); }
  };

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("weekly-reports").createSignedUrl(path, 60 * 5);
    if (error || !data) return toast.error("Lien indisponible");
    window.open(data.signedUrl, "_blank");
  };

  const copyPublicLink = async (r: ReportRow) => {
    if (!r.download_token) return;
    const url = `${APP_URL}/r/wr/${r.download_token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(r.id);
    toast.success("Lien copié");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-6xl py-8 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rapports hebdo Uber Eats</h1>
            <p className="text-muted-foreground mt-1">
              Généré automatiquement chaque jeudi 8h Paris pour la semaine précédente (lundi → dimanche).
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={generate} disabled={busy || !selectedChainId}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="ml-2">Générer</span>
            </Button>
            <Button onClick={sendWhatsApp} disabled={busy || !selectedChainId || waRecipients.filter(r => r.active).length === 0} className="bg-[#25D366] hover:bg-[#20b858] text-white">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              <span className="ml-2">Envoyer WhatsApp</span>
            </Button>
            <Button variant="secondary" onClick={sendEmail} disabled={busy || !selectedChainId || emailRecipients.filter(r => r.active).length === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-2">Envoyer Email</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Générer l'historique</CardTitle>
            <CardDescription>Générer rétroactivement les N dernières semaines complètes (lundi → dimanche).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                type="number"
                min={1}
                max={52}
                value={backfillWeeks}
                onChange={(e) => setBackfillWeeks(Number(e.target.value))}
                className="max-w-[120px]"
                disabled={busy}
              />
              <span className="text-sm text-muted-foreground">semaines</span>
              <Button onClick={backfillHistory} disabled={busy || !selectedChainId}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Générer l'historique
              </Button>
              {backfillProgress && (
                <span className="text-sm text-muted-foreground">
                  {backfillProgress.done} / {backfillProgress.total}
                </span>
              )}
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle>Destinataires</CardTitle>
            <CardDescription>Ajoutez des numéros WhatsApp et/ou des emails. WhatsApp est envoyé automatiquement chaque jeudi 8h.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="whatsapp">
              <TabsList>
                <TabsTrigger value="whatsapp" className="gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp ({waRecipients.length})</TabsTrigger>
                <TabsTrigger value="email" className="gap-2"><Mail className="h-4 w-4" /> Email ({emailRecipients.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="whatsapp" className="space-y-3 pt-4">
                <div className="flex gap-2 flex-wrap">
                  <Input placeholder="Nom (optionnel)" value={newPhoneName} onChange={(e) => setNewPhoneName(e.target.value)} className="max-w-[200px]" />
                  <Input placeholder="06 12 34 56 78" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPhone()} className="max-w-[200px]" />
                  <Button onClick={addPhone}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
                </div>
                {waRecipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Aucun destinataire WhatsApp.</p>
                ) : (
                  <ul className="divide-y">
                    {waRecipients.map((r) => (
                      <li key={r.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{r.name || "—"}</span>
                          <span className="text-muted-foreground text-sm">{r.phone}</span>
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
              </TabsContent>

              <TabsContent value="email" className="space-y-3 pt-4">
                <div className="flex gap-2">
                  <Input type="email" placeholder="prenom@exemple.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmail()} />
                  <Button onClick={addEmail}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
                </div>
                {emailRecipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Aucun destinataire email.</p>
                ) : (
                  <ul className="divide-y">
                    {emailRecipients.map((r) => (
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
            <CardDescription>50 derniers rapports</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Aucun rapport pour l'instant. Cliquez sur « Générer ».</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semaine</TableHead>
                    <TableHead>CA brut TTC</TableHead>
                    <TableHead>Commandes</TableHead>
                    <TableHead>Versement</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Envoi</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                        <div className="flex flex-col gap-0.5">
                          {r.sent_via_whatsapp && r.sent_phones?.length ? (
                            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-[#25D366]" /> {r.sent_phones.length}</span>
                          ) : null}
                          {r.sent_to?.length ? (
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {r.sent_to.length}</span>
                          ) : null}
                          {!r.sent_via_whatsapp && !r.sent_to?.length && "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.download_token && (
                            <Button size="sm" variant="ghost" onClick={() => copyPublicLink(r)} title="Copier le lien public">
                              {copiedId === r.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          )}
                          {r.xlsx_path && (
                            <Button size="sm" variant="ghost" onClick={() => download(r.xlsx_path!)} title="Télécharger XLSX">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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
