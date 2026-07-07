import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileSpreadsheet, FileText, AlertCircle } from "lucide-react";

const SUPABASE_URL = "https://akcicojkrzeirffefdet.supabase.co";

interface Meta {
  chainName: string;
  chainLogo: string | null;
  weekStart: string;
  weekEnd: string;
  totals: Record<string, number>;
  hasXlsx: boolean;
  hasCsv: boolean;
}

const fmtEur = (n?: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtInt = (n?: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0));
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function WeeklyReportDownload() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${SUPABASE_URL}/functions/v1/download-weekly-report?token=${token}&format=meta`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || "Lien invalide ou expiré");
        }
        return r.json();
      })
      .then((d) => setMeta(d as Meta))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const download = (format: "xlsx" | "csv") => {
    window.location.href = `${SUPABASE_URL}/functions/v1/download-weekly-report?token=${token}&format=${format}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Lien indisponible</h1>
            <p className="text-muted-foreground text-sm">
              {error || "Ce lien n'existe pas ou a expiré. Demandez-en un nouveau à votre contact."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const t = meta.totals || {};
  const fraisUber = (t.commission_uber || 0) + (t.marketing_fee || 0) + (t.service_fee || 0);

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          {meta.chainLogo && (
            <img src={meta.chainLogo} alt={meta.chainName} className="h-16 w-16 rounded-xl object-cover mx-auto" />
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{meta.chainName}</h1>
            <p className="text-muted-foreground mt-1">
              Rapport Uber Eats — du {fmtDate(meta.weekStart)} au {fmtDate(meta.weekEnd)}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Résumé de la semaine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="CA brut TTC" value={fmtEur(t.ca_brut_ttc)} />
              <Stat label="CA brut HT" value={fmtEur(t.ca_brut_ht)} />
              <Stat label="CA net après commissions" value={fmtEur(t.ca_net_ht)} sub="HT" />
              <Stat label="CA net TTC" value={fmtEur(t.ca_net_ttc)} />
              <Stat label="Frais Uber" value={fmtEur(fraisUber)} sub="commission, marketing, service" />
              <Stat label="Commandes" value={fmtInt(t.orders_count)} />
              <Stat label="Versement Uber" value={fmtEur(t.payout_total)} className="col-span-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Télécharger le détail complet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            {meta.hasXlsx && (
              <Button size="lg" onClick={() => download("xlsx")} className="flex-1">
                <FileSpreadsheet className="h-5 w-5 mr-2" />
                XLSX (4 onglets)
              </Button>
            )}
            {meta.hasCsv && (
              <Button size="lg" variant="outline" onClick={() => download("csv")} className="flex-1">
                <FileText className="h-5 w-5 mr-2" />
                CSV (Jour × Restaurant)
              </Button>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Lien sécurisé personnel. Ne pas partager publiquement.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
