import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, FileWarning, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Note {
  id: string;
  restaurant_id: string;
  status: string;
  note: string;
  flagged_period_start: string | null;
  flagged_period_end: string | null;
  updated_at: string;
}

interface Props {
  restaurantId: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  csv_required: { label: "CSV requis", color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300", icon: FileWarning },
  api_partial: { label: "API partielle", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300", icon: AlertTriangle },
  resolved: { label: "Résolu", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300", icon: CheckCircle2 },
};

export function BackfillNoteCard({ restaurantId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("csv_required");
  const [note, setNote] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["backfill-note", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_backfill_notes")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("report_type", "PAYMENT_DETAILS_REPORT")
        .maybeSingle();
      if (error) throw error;
      return data as Note | null;
    },
  });

  useEffect(() => {
    if (open) {
      setStatus(existing?.status ?? "csv_required");
      setNote(existing?.note ?? "");
      setPeriodStart(existing?.flagged_period_start ?? "");
      setPeriodEnd(existing?.flagged_period_end ?? "");
    }
  }, [open, existing]);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("restaurant_backfill_notes")
      .upsert({
        restaurant_id: restaurantId,
        report_type: "PAYMENT_DETAILS_REPORT",
        status,
        note,
        flagged_period_start: periodStart || null,
        flagged_period_end: periodEnd || null,
        created_by: existing?.id ? undefined : userData.user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "restaurant_id,report_type" });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Annotation enregistrée" });
    qc.invalidateQueries({ queryKey: ["backfill-note", restaurantId] });
    qc.invalidateQueries({ queryKey: ["backfill-notes-all"] });
    setOpen(false);
  };

  const markResolved = async () => {
    if (!existing) return;
    const { error } = await supabase
      .from("restaurant_backfill_notes")
      .update({ status: "resolved", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marqué comme résolu" });
    qc.invalidateQueries({ queryKey: ["backfill-note", restaurantId] });
    qc.invalidateQueries({ queryKey: ["backfill-notes-all"] });
  };

  const meta = existing ? STATUS_LABELS[existing.status] ?? STATUS_LABELS.csv_required : null;
  const Icon = meta?.icon ?? FileWarning;

  return (
    <>
      {existing ? (
        <div className={`rounded-lg border p-3 ${meta?.color ?? ""}`}>
          <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-background/50">{meta?.label}</Badge>
                {(existing.flagged_period_start || existing.flagged_period_end) && (
                  <span className="text-xs opacity-80">
                    {existing.flagged_period_start ? format(new Date(existing.flagged_period_start), "MM/yyyy") : "…"}
                    {" → "}
                    {existing.flagged_period_end ? format(new Date(existing.flagged_period_end), "MM/yyyy") : "en cours"}
                  </span>
                )}
              </div>
              {existing.note && <p className="text-sm whitespace-pre-wrap">{existing.note}</p>}
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="bg-background/50">
                  <Pencil className="h-3 w-3 mr-1" /> Modifier
                </Button>
                {existing.status !== "resolved" && (
                  <Button size="sm" variant="outline" onClick={markResolved} className="bg-background/50">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Marquer comme résolu
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="border-dashed">
          <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
          Marquer ce store comme problématique
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annotation backfill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Statut</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv_required">CSV requis (API vide)</SelectItem>
                  <SelectItem value="api_partial">API partielle</SelectItem>
                  <SelectItem value="resolved">Résolu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Note</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: API Uber retourne CSV vide avant 04/2025. Importer manuellement depuis Uber Eats Manager."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Période début</label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Période fin</label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
