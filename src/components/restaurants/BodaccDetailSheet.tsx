import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Scale, ShieldAlert, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import type { BodaccAnnonce } from "./BodaccScanButton";
import { useBodaccDismissals, getAnnonceKey } from "@/hooks/useBodaccDismissals";

const typeBadgeConfig: Record<string, { className: string; icon: React.ReactNode }> = {
  procedure_collective: {
    className: "bg-destructive/15 text-destructive border-destructive/30",
    icon: <ShieldAlert className="h-3 w-3" />,
  },
  radiation: {
    className: "bg-destructive/15 text-destructive border-destructive/30",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  cession: {
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
    icon: <Scale className="h-3 w-3" />,
  },
  modification: {
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    icon: <FileText className="h-3 w-3" />,
  },
  depot_comptes: {
    className: "bg-muted text-muted-foreground border-border",
    icon: <FileText className="h-3 w-3" />,
  },
  autre: {
    className: "bg-muted text-muted-foreground border-border",
    icon: <FileText className="h-3 w-3" />,
  },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantName: string;
  annonces: BodaccAnnonce[];
  restaurantId?: string;
  siren?: string;
  onDismissChange?: () => void;
}

export function BodaccDetailSheet({ open, onOpenChange, restaurantName, annonces, restaurantId, siren, onDismissChange }: Props) {
  const { isDismissed, dismiss, restore, dismissed } = useBodaccDismissals(restaurantId || null);

  const activeAnnonces = annonces.filter((a) => !isDismissed(a));
  const hasCritical = activeAnnonces.some(
    (a) => a.type === "procedure_collective" || a.type === "radiation"
  );

  const handleDismiss = async (a: BodaccAnnonce) => {
    await dismiss(a, siren || "");
    onDismissChange?.();
  };

  const handleRestore = async (a: BodaccAnnonce) => {
    await restore(a);
    onDismissChange?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Alertes BODACC
          </SheetTitle>
          <SheetDescription>{restaurantName}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 mt-4">
          {hasCritical && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
              <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-xs font-medium text-destructive">
                Alerte : procédure collective ou radiation détectée
              </span>
            </div>
          )}

          {annonces.map((a, i) => {
            const config = typeBadgeConfig[a.type] || typeBadgeConfig.autre;
            const acked = isDismissed(a);
            return (
              <div
                key={i}
                className={`flex flex-col gap-1.5 rounded-md border p-3 text-sm transition-opacity ${
                  acked
                    ? "border-border/50 bg-muted/30 opacity-60"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] gap-1 ${config.className}`}>
                    {config.icon}
                    {a.typeLabel}
                  </Badge>
                  {a.date && (
                    <span className="text-muted-foreground text-xs">
                      {new Date(a.date).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                  {a.tribunal && (
                    <span className="text-muted-foreground text-xs">· {a.tribunal}</span>
                  )}
                  {acked && (
                    <Badge variant="outline" className="text-[9px] gap-1 text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Pris en compte
                    </Badge>
                  )}
                </div>
                <p className="text-foreground leading-relaxed text-xs">{a.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {a.lienBodacc && (
                    <a
                      href={a.lienBodacc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline w-fit text-xs"
                    >
                      Voir l'annonce <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {restaurantId && (
                    acked ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => handleRestore(a)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Rétablir
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] gap-1 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={() => handleDismiss(a)}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Pris en compte
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
