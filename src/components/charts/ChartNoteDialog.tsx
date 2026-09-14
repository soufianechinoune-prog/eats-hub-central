import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CHART_NOTE_COLORS,
  useChartNoteMutations,
  type ChartNote,
  type ChartNoteColor,
} from "@/hooks/useChartNotes";

interface ChartNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Date présélectionnée (clic sur le graphique) */
  date: Date | null;
  /** Note existante à consulter / modifier / supprimer */
  existingNote?: ChartNote | null;
  /** Restaurants du scope courant (vide = note réseau) */
  scopedRestaurantIds: string[];
}

export function ChartNoteDialog({
  open,
  onOpenChange,
  date,
  existingNote,
  scopedRestaurantIds,
}: ChartNoteDialogProps) {
  const { toast } = useToast();
  const { createNote, updateNote, deleteNote } = useChartNoteMutations();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<ChartNoteColor>("amber");
  const [noteDate, setNoteDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingNote) {
      setTitle(existingNote.title);
      setDescription(existingNote.description ?? "");
      setColor((existingNote.color as ChartNoteColor) || "amber");
      setNoteDate(existingNote.note_date);
    } else {
      setTitle("");
      setDescription("");
      setColor("amber");
      setNoteDate(date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, existingNote, date]);

  const handleSave = async () => {
    if (!title.trim() || !noteDate) {
      toast({ title: "Titre et date requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (existingNote) {
        await updateNote.mutateAsync({
          id: existingNote.id,
          note_date: noteDate,
          title: title.trim(),
          description: description.trim(),
          color,
        });
      } else {
        await createNote.mutateAsync({
          note_date: noteDate,
          title: title.trim(),
          description: description.trim(),
          color,
          restaurant_ids: scopedRestaurantIds,
        });
      }
      toast({ title: existingNote ? "Note mise à jour" : "Note ajoutée au graphique" });
      onOpenChange(false);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer la note", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingNote) return;
    setSaving(true);
    try {
      await deleteNote.mutateAsync(existingNote.id);
      toast({ title: "Note supprimée" });
      onOpenChange(false);
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer la note", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const displayDate = noteDate ? format(parseISO(noteDate), "d MMMM yyyy", { locale: fr }) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <MessageSquarePlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{existingNote ? "Note du graphique" : "Ajouter une note"}</DialogTitle>
              <DialogDescription>
                {displayDate && `Pour le ${displayDate}`}
                {scopedRestaurantIds.length === 0
                  ? " · visible sur tout le réseau"
                  : scopedRestaurantIds.length === 1
                    ? " · 1 restaurant"
                    : ` · ${scopedRestaurantIds.length} restaurants`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="note-title">Titre *</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Bug d'import des commandes"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-desc">Détails (optionnel)</Label>
            <Textarea
              id="note-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexte, cause, impact…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="note-date">Date</Label>
              <Input
                id="note-date"
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2 pt-1.5">
                {(Object.keys(CHART_NOTE_COLORS) as ChartNoteColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={CHART_NOTE_COLORS[c].label}
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full transition-all",
                      CHART_NOTE_COLORS[c].dot,
                      color === c
                        ? "ring-2 ring-offset-2 ring-foreground/60 scale-110"
                        : "opacity-50 hover:opacity-90"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {existingNote && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement…" : existingNote ? "Mettre à jour" : "Ajouter"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
