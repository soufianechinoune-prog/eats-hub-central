import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  endDate?: Date | null;
  /** Note existante à consulter / modifier / supprimer */
  existingNote?: ChartNote | null;
  /** Restaurants du scope courant (vide = note réseau) */
  scopedRestaurantIds: string[];
}

export function ChartNoteDialog({
  open,
  onOpenChange,
  date,
  endDate,
  existingNote,
  scopedRestaurantIds,
}: ChartNoteDialogProps) {
  const { toast } = useToast();
  const { createNote, updateNote, deleteNote } = useChartNoteMutations();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<ChartNoteColor>("amber");
  const [noteDate, setNoteDate] = useState("");
  const [noteEndDate, setNoteEndDate] = useState("");
  const [isPeriod, setIsPeriod] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingNote) {
      setTitle(existingNote.title);
      setDescription(existingNote.description ?? "");
      setColor((existingNote.color as ChartNoteColor) || "amber");
      setNoteDate(existingNote.note_date);
      setNoteEndDate(existingNote.end_date ?? existingNote.note_date);
      setIsPeriod(Boolean(existingNote.end_date));
    } else {
      setTitle("");
      setDescription("");
      setColor("amber");
      setNoteDate(date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
      setNoteEndDate(format(endDate ?? date ?? new Date(), "yyyy-MM-dd"));
      setIsPeriod(Boolean(endDate));
    }
  }, [open, existingNote, date, endDate]);

  const handleSave = async () => {
    if (!title.trim() || !noteDate) {
      toast({ title: "Titre et date requis", variant: "destructive" });
      return;
    }
    if (isPeriod && (!noteEndDate || noteEndDate < noteDate)) {
      toast({ title: "La fin doit être égale ou postérieure au début", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (existingNote) {
        await updateNote.mutateAsync({
          id: existingNote.id,
          note_date: noteDate,
          end_date: isPeriod ? noteEndDate : null,
          title: title.trim(),
          description: description.trim(),
          color,
        });
      } else {
        await createNote.mutateAsync({
          note_date: noteDate,
          end_date: isPeriod ? noteEndDate : null,
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
                {displayDate && (isPeriod ? `Du ${displayDate}${noteEndDate ? ` au ${format(parseISO(noteEndDate), "d MMMM yyyy", { locale: fr })}` : ""}` : `Pour le ${displayDate}`)}
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
          <ToggleGroup type="single" value={isPeriod ? "period" : "event"} onValueChange={(value) => { if (value) setIsPeriod(value === "period"); }} variant="outline" className="justify-start">
            <ToggleGroupItem value="event">Événement</ToggleGroupItem>
            <ToggleGroupItem value="period">Période</ToggleGroupItem>
          </ToggleGroup>
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
          <div className={cn("grid gap-3", isPeriod ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
            <div className="space-y-1.5">
              <Label>{isPeriod ? "Début" : "Date"}</Label>
              <NoteDatePicker label={isPeriod ? "Début" : "Date"} value={noteDate} onChange={setNoteDate} />
            </div>
            {isPeriod && <div className="space-y-1.5">
              <Label>Fin incluse</Label>
              <NoteDatePicker label="Fin incluse" value={noteEndDate} onChange={setNoteEndDate} fromDate={noteDate ? parseISO(noteDate) : undefined} />
            </div>}
          </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2 pt-1.5">
                {(Object.keys(CHART_NOTE_COLORS) as ChartNoteColor[]).map((c) => (
                  <Button
                    key={c}
                    variant="ghost"
                    type="button"
                    title={CHART_NOTE_COLORS[c].label}
                    aria-label={CHART_NOTE_COLORS[c].label}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-7 w-7 p-0 rounded-full transition-all",
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

function NoteDatePicker({ label, value, onChange, fromDate }: { label: string; value: string; onChange: (value: string) => void; fromDate?: Date }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="outline" aria-label={label} className="w-full justify-start font-normal">
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(parseISO(value), "dd MMM yyyy", { locale: fr }) : "Choisir une date"}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" locale={fr} selected={value ? parseISO(value) : undefined} defaultMonth={value ? parseISO(value) : undefined} disabled={fromDate ? { before: fromDate } : undefined} onSelect={(date) => { if (date) { onChange(format(date, "yyyy-MM-dd")); setOpen(false); } }} initialFocus className="p-3 pointer-events-auto" />
    </PopoverContent>
  </Popover>;
}
