import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Search, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export interface SiretAutoFillData {
  rue?: string;
  codePostal?: string;
  ville?: string;
  siren?: string;
  denomination?: string;
  managerFirstName?: string;
  managerLastName?: string;
}

interface SiretValidationProps {
  siret: string | null | undefined;
  onAutoFill?: (data: SiretAutoFillData) => void;
}

interface SiretInfo {
  valid: boolean;
  denomination?: string;
  activite?: string;
  adresse?: string;
  etat?: string;
  rue?: string;
  codePostal?: string;
  ville?: string;
  siren?: string;
  formeJuridique?: string;
  dateCreation?: string;
  dirigeant?: { prenom?: string; nom?: string } | null;
}

export function SiretValidation({ siret, onAutoFill }: SiretValidationProps) {
  const [result, setResult] = useState<SiretInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [filled, setFilled] = useState(false);

  const cleanSiret = (siret || "").replace(/\s/g, "").trim();
  const isValidFormat = /^\d{14}$/.test(cleanSiret);

  const handleCheck = async () => {
    if (!isValidFormat) return;
    setLoading(true);
    setResult(null);
    setFilled(false);

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
          rue: data.rue,
          codePostal: data.codePostal,
          ville: data.ville,
          siren: data.siren,
          activite: data.activite,
          formeJuridique: data.formeJuridique,
          dateCreation: data.dateCreation,
          dirigeant: data.dirigeant,
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

  const handleAutoFill = () => {
    if (!result || !onAutoFill) return;
    onAutoFill({
      rue: result.rue,
      codePostal: result.codePostal,
      ville: result.ville,
      siren: result.siren,
      denomination: result.denomination,
      managerFirstName: result.dirigeant?.prenom,
      managerLastName: result.dirigeant?.nom,
    });
    setFilled(true);
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
          {result.activite && (
            <p className="text-[11px] text-muted-foreground">Activité : {result.activite}</p>
          )}
          {result.dirigeant && (result.dirigeant.prenom || result.dirigeant.nom) && (
            <p className="text-[11px] text-muted-foreground">
              Dirigeant : {[result.dirigeant.prenom, result.dirigeant.nom].filter(Boolean).join(" ")}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            {onAutoFill && (
              <Button
                size="sm"
                variant={filled ? "ghost" : "default"}
                className="h-7 text-xs gap-1.5"
                onClick={handleAutoFill}
                disabled={filled}
              >
                <Wand2 className="h-3 w-3" />
                {filled ? "Champs remplis ✓" : "Auto-remplir"}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-muted-foreground"
              onClick={() => { setChecked(false); setResult(null); setFilled(false); }}
            >
              Revérifier
            </Button>
          </div>
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
