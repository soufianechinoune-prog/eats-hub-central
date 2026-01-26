import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";

export type AudienceType = "all" | "new" | "returning" | "inactive" | "uberOne";

interface BogoAudienceSelectorProps {
  value: AudienceType;
  onChange: (value: AudienceType) => void;
}

const AUDIENCES = {
  all: {
    title: "Tous les clients",
    description: null,
    badge: null,
  },
  new: {
    title: "Uniquement pour les nouveaux clients",
    description: "N'a encore jamais commandé auprès de votre établissement.",
    badge: null,
  },
  returning: {
    title: "Utilisateurs repassant commande",
    description: "A commandé auprès de votre établissement au cours des 6 derniers mois.",
    badge: null,
  },
  inactive: {
    title: "Utilisateurs inactifs",
    description: "N'a pas commandé auprès de votre établissement depuis plus de 45 jours.",
    badge: null,
  },
  uberOne: {
    title: "Réservé aux membres Uber One",
    description: null,
    badge: null,
    hasIcon: true,
    link: "En savoir plus",
  },
};

export function BogoAudienceSelector({ value, onChange }: BogoAudienceSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-4">
        Sélectionnez les clients qui verront votre offre.
      </p>
      
      <RadioGroup value={value} onValueChange={(v) => onChange(v as AudienceType)}>
        {(Object.keys(AUDIENCES) as AudienceType[]).map((key) => {
          const audience = AUDIENCES[key];
          const isUberOne = key === "uberOne";
          
          return (
            <div
              key={key}
              className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                value === key ? "border-foreground bg-muted/30" : "border-border"
              }`}
              onClick={() => onChange(key)}
            >
              <RadioGroupItem value={key} id={key} className="mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  {isUberOne && (
                    <Crown className="h-4 w-4 text-amber-500" />
                  )}
                  <Label
                    htmlFor={key}
                    className="font-medium cursor-pointer"
                  >
                    {audience.title}
                  </Label>
                  {audience.badge && (
                    <Badge variant="secondary" className="bg-foreground text-background text-xs">
                      {audience.badge}
                    </Badge>
                  )}
                </div>
                {audience.description && (
                  <p className="text-sm text-muted-foreground">
                    {audience.description}
                  </p>
                )}
                {isUberOne && (
                  <button className="text-sm text-primary underline underline-offset-2">
                    En savoir plus
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
