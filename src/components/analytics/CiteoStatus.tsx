import { AlertTriangle, CheckCircle2, Clock3, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { describeCiteoAccount, type CiteoAccount, type CiteoSummary, type CiteoTone } from "@/lib/citeoStatus";

const TONE_CLASS: Record<CiteoTone, string> = {
  ok: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  pending: "border-border bg-muted text-muted-foreground",
};

const TONE_ICON: Record<CiteoTone, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warning: Receipt,
  danger: AlertTriangle,
  pending: Clock3,
};

const eur = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const dateFr = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("fr-FR");

/** Pastille CITEO d'une société : à jour, factures à payer, ou adhésion non terminée. */
export function CiteoBadge({ account }: { account: CiteoAccount }) {
  const d = describeCiteoAccount(account);
  const Icon = TONE_ICON[d.tone];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Badge variant="outline" className={cn("text-[10px] gap-1 whitespace-nowrap", TONE_CLASS[d.tone])}>
              <Icon className="h-3 w-3 shrink-0" /> {d.label}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs space-y-1.5">
          <p className="font-medium">{account.company_name}{account.contract_number ? ` · contrat ${account.contract_number}` : ""}</p>
          <p>{d.detail}</p>
          {account.invoices.length > 0 && (
            <ul className="space-y-0.5">
              {account.invoices.map((inv) => (
                <li key={`${inv.label}-${inv.due}`} className="flex justify-between gap-3">
                  <span>{inv.label} · échéance {dateFr(inv.due)}</span>
                  <span className="font-medium">{eur(Number(inv.ttc))}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground">Relevé CITEO du {dateFr(account.checked_at)}.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Cellule du tableau : la pastille, ou un tiret si aucune société CITEO n'est reliée au restaurant. */
export function CiteoCell({ account }: { account?: CiteoAccount }) {
  if (!account) return <span className="text-xs text-muted-foreground" title="Aucune société CITEO reliée à ce restaurant">—</span>;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <CiteoBadge account={account} />
      {account.unpaid_count > 0 && (
        <span className="text-[10px] text-muted-foreground">{eur(Number(account.unpaid_total_ttc))} TTC</span>
      )}
    </div>
  );
}

/** Bandeau au-dessus du tableau : le total à payer chez CITEO et les sociétés non reliées à un restaurant. */
export function CiteoSummaryStrip({ summary }: { summary: CiteoSummary }) {
  if (summary.total === 0) return null;
  const hasUnpaid = summary.unpaidCompanies > 0;
  return (
    <div className={cn(
      "mb-4 px-3 py-2.5 rounded-lg border",
      hasUnpaid ? "bg-destructive/5 border-destructive/20" : "bg-muted/30 border-border/50",
    )}>
      <div className="flex items-start gap-2.5">
        <Receipt className={cn("h-4 w-4 mt-0.5 shrink-0", hasUnpaid ? "text-destructive" : "text-muted-foreground")} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium">
            {hasUnpaid
              ? `CITEO : ${summary.unpaidCompanies} société${summary.unpaidCompanies > 1 ? "s ont" : " a"} des factures à payer, pour ${eur(summary.unpaidTotalTtc)} TTC`
              : "CITEO : toutes les sociétés sont à jour de leurs factures"}
            {summary.pendingAdhesions > 0 && ` · ${summary.pendingAdhesions} adhésion${summary.pendingAdhesions > 1 ? "s" : ""} non terminée${summary.pendingAdhesions > 1 ? "s" : ""}`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {summary.checkedAt ? `Relevé de l'espace client CITEO du ${dateFr(summary.checkedAt)}. ` : ""}
            Une facture impayée peut entraîner la radiation de l'adhérent.
          </p>
          {summary.unlinked.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] text-muted-foreground mb-1">
                Sociétés CITEO non reliées à un restaurant affiché ({summary.unlinked.length}) :
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {summary.unlinked.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 text-[11px]">
                    <span className="font-medium">{a.company_name}</span>
                    <CiteoBadge account={a} />
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
