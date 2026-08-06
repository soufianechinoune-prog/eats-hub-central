import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function OnsiteLflHelp({ year, className }: { year: number; className?: string }) {
  const prev = year - 1;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label="Comprendre le périmètre constant LFL"
        >
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="max-w-md space-y-3 text-sm"
      >
        <p className="font-semibold">Périmètre constant (LFL)</p>
        <p className="text-muted-foreground">
          Un restaurant est <strong>comparable</strong> (LFL) pour un mois donné
          s&apos;il a réalisé un CA sur place strictement positif ce mois en {year}
          <em> et </em> en {prev}.
        </p>
        <ul className="space-y-1.5 pl-4 text-muted-foreground">
          <li>
            <strong>LFL {prev}</strong> : CA sur place des restaurants comparables
            l&apos;année dernière (base de référence).
          </li>
          <li>
            <strong>LFL {year}</strong> : CA sur place des <em>mêmes</em> restaurants
            comparables cette année.
          </li>
          <li>
            <strong>Évolution LFL</strong> :{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              ((LFL {year} − LFL {prev}) / LFL {prev}) × 100
            </code>
            . Elle mesure la vraie croissance hors effet d&apos;ouvertures/fermetures.
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Le mois en cours est exclu du périmètre constant car il est partiel.
          Si le CA {prev} est nul, l&apos;évolution n&apos;est pas calculée (affichée « -- »).
        </p>
      </PopoverContent>
    </Popover>
  );
}
