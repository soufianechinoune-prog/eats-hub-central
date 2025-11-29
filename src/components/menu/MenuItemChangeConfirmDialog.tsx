import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, History } from "lucide-react";

export interface FieldChange {
  field: string;
  fieldLabel: string;
  from: string | number | boolean | null;
  to: string | number | boolean | null;
}

export interface MenuItemChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  changeType: "created" | "updated" | "deleted" | "activated" | "deactivated";
  changes: FieldChange[];
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}

const formatValue = (value: string | number | boolean | null, field: string): string => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Actif" : "Inactif";
  if (field.includes("price") || field === "food_cost") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value));
  }
  return String(value);
};

const getChangeTypeLabel = (changeType: string): string => {
  switch (changeType) {
    case "created": return "Création";
    case "updated": return "Modification";
    case "deleted": return "Suppression";
    case "activated": return "Activation";
    case "deactivated": return "Désactivation";
    default: return "Modification";
  }
};

const getChangeTypeColor = (changeType: string): string => {
  switch (changeType) {
    case "created": return "bg-emerald-500";
    case "deleted": return "bg-destructive";
    case "activated": return "bg-emerald-500";
    case "deactivated": return "bg-amber-500";
    default: return "bg-primary";
  }
};

export function MenuItemChangeConfirmDialog({
  open,
  onOpenChange,
  itemName,
  changeType,
  changes,
  onConfirm,
  onCancel,
}: MenuItemChangeConfirmDialogProps) {
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes("");
  };

  const handleCancel = () => {
    setNotes("");
    onCancel();
  };

  const priceChanges = changes.filter(c => c.field.includes("price") || c.field === "food_cost");
  const otherChanges = changes.filter(c => !c.field.includes("price") && c.field !== "food_cost");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirmer la {getChangeTypeLabel(changeType).toLowerCase()}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Vous êtes sur le point de modifier <strong>{itemName}</strong>.
                Cette action sera enregistrée dans l'historique.
              </p>

              {/* Change type badge */}
              <div className="flex items-center gap-2">
                <Badge className={getChangeTypeColor(changeType)}>
                  {getChangeTypeLabel(changeType)}
                </Badge>
              </div>

              {/* Changes summary */}
              {changes.length > 0 && (
                <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <History className="h-4 w-4" />
                    Modifications détectées
                  </div>

                  {/* Price changes with emphasis */}
                  {priceChanges.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Prix</p>
                      {priceChanges.map((change, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-background rounded px-2 py-1.5">
                          <span className="text-muted-foreground min-w-[100px]">{change.fieldLabel}:</span>
                          <span className="font-mono text-destructive line-through">
                            {formatValue(change.from, change.field)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-emerald-600 font-medium">
                            {formatValue(change.to, change.field)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Other changes */}
                  {otherChanges.length > 0 && (
                    <div className="space-y-2">
                      {priceChanges.length > 0 && (
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Autres</p>
                      )}
                      {otherChanges.map((change, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground min-w-[100px]">{change.fieldLabel}:</span>
                          <span className="line-through text-muted-foreground truncate max-w-[100px]">
                            {formatValue(change.from, change.field)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">
                            {formatValue(change.to, change.field)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes input */}
              <div className="space-y-2">
                <Label htmlFor="change-notes" className="text-foreground">
                  Notes (optionnel)
                </Label>
                <Textarea
                  id="change-notes"
                  placeholder="Raison de la modification, contexte..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleConfirm}>
            Confirmer et enregistrer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
