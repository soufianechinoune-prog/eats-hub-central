import { AlertTriangle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ChannelGap {
  label: string;
  caisse: number;
  source: number;
  gapPct: number;
}

interface Props {
  gaps: ChannelGap[];
  unmapped: { restaurant_splash_id: number; splash_name: string | null; revenue_ttc: number }[];
  onOpenMapping: () => void;
}

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export function SourceHealthAlerts({ gaps, unmapped, onOpenMapping }: Props) {
  if (gaps.length === 0 && unmapped.length === 0) return null;
  const unmappedTotal = unmapped.reduce((s, u) => s + u.revenue_ttc, 0);
  return (
    <div className="space-y-2">
      {gaps.map((g) => (
        <div key={g.label} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{g.label} : écart de {g.gapPct > 0 ? "+" : ""}{g.gapPct.toFixed(1)} %</span>{" "}
            entre la caisse ({eur(g.caisse)}) et les données {g.label} ({eur(g.source)}). La Vue d'ensemble affiche la caisse ;
            vérifiez la remontée {g.label} (collecte arrêtée ou en retard).
          </p>
        </div>
      ))}
      {unmapped.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <Store className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1 text-muted-foreground">
            <span className="font-medium text-foreground">
              {unmapped.length} caisse{unmapped.length > 1 ? "s" : ""} non rattachée{unmapped.length > 1 ? "s" : ""}
            </span>{" "}
            — {eur(unmappedTotal)} encaissés sur 14 jours, absents de la Vue d'ensemble.
            <span className="block text-xs mt-1">
              {unmapped.slice(0, 6).map((u) => u.splash_name || `Caisse #${u.restaurant_splash_id}`).join(" · ")}
              {unmapped.length > 6 ? " …" : ""}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={onOpenMapping}>Rattacher</Button>
        </div>
      )}
    </div>
  );
}
