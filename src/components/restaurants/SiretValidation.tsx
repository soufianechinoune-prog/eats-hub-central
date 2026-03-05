import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface SiretValidationProps {
  siret: string | null | undefined;
}

interface SiretInfo {
  valid: boolean;
  denomination?: string;
  activite?: string;
  adresse?: string;
  etat?: string;
}

export function SiretValidation({ siret }: SiretValidationProps) {
  const [result, setResult] = useState<SiretInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const cleanSiret = (siret || "").replace(/\s/g, "").trim();
  const isValidFormat = /^\d{14}$/.test(cleanSiret);

  const handleCheck = async () => {
    if (!isValidFormat) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-siret', {
        body: { siret: cleanSiret },
      });

      if (error) {
        setResult({ valid: false });
      } else if (data?.valid) {
        setResult({
          valid: true,
          denomination: data.denomination,
          adresse: data.adresse,
          etat: data.etat,
        });
      } else {
        setResult({ valid: false });
      }
    } catch {
      setResult({ valid: false });
    } finally {
      setLoading(false);
      setChecked(true);
    }
  };

  if (!cleanSiret) {
    return (
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Validation</span>
        <p className="text-muted-foreground italic text-sm">Renseignez un SIRET</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">Validation SIRET</span>
      
      {!checked ? (
        <div>
          {!isValidFormat && (
            <p className="text-xs text-destructive mb-1">Format invalide (14 chiffres attendus)</p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            disabled={!isValidFormat || loading}
            onClick={handleCheck}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Vérifier
          </Button>
        </div>
      ) : result?.valid ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-[10px]">
              {result.etat || "Valide"}
            </Badge>
          </div>
          <p className="text-xs font-medium">{result.denomination}</p>
          {result.adresse && (
            <p className="text-[11px] text-muted-foreground">{result.adresse}</p>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2 text-muted-foreground"
            onClick={() => { setChecked(false); setResult(null); }}
          >
            Revérifier
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-500 font-medium">SIRET non trouvé</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2 text-muted-foreground"
            onClick={() => { setChecked(false); setResult(null); }}
          >
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}
