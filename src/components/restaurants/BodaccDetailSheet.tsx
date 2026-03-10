import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Scale, ShieldAlert, AlertTriangle } from "lucide-react";
import type { BodaccAnnonce } from "./BodaccScanButton";

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
}

export function BodaccDetailSheet({ open, onOpenChange, restaurantName, annonces }: Props) {
  const hasCritical = annonces.some(
    (a) => a.type === "procedure_collective" || a.type === "radiation"
  );

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
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3 text-sm"
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
                </div>
                <p className="text-foreground leading-relaxed text-xs">{a.description}</p>
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
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
