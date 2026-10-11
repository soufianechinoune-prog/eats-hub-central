import { format, parseISO } from "date-fns";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHART_NOTE_COLORS, type ChartNote } from "@/hooks/useChartNotes";
import { noteBucketStart, type NoteGranularity } from "./ChartNoteMarkers";

interface Props {
  notes: ChartNote[];
  rows: { periode: string }[];
  granularity: NoteGranularity;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onSelect: (notes: ChartNote[]) => void;
}

export function ChartNoteLegend({ notes, rows, granularity, visible, onVisibleChange, onSelect }: Props) {
  const displayed = notes.filter((note) => {
    const start = noteBucketStart(note.note_date, granularity);
    const end = noteBucketStart(note.end_date ?? note.note_date, granularity);
    return rows.some((row) => row.periode.slice(0, 10) >= start && row.periode.slice(0, 10) <= end);
  });
  if (!displayed.length) return null;
  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">Événements et périodes · {displayed.length}</span>
        <Button variant="ghost" size="sm" aria-pressed={visible} onClick={() => onVisibleChange(!visible)} className="shrink-0 gap-2">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {visible ? "Masquer" : "Afficher"}
        </Button>
      </div>
      {visible && <div className="grid gap-2 sm:grid-cols-2">
        {displayed.map((note) => <Button key={note.id} variant="outline" className="h-auto min-w-0 justify-start gap-2 py-2 text-left" onClick={() => onSelect([note])}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${CHART_NOTE_COLORS[note.color]?.dot ?? CHART_NOTE_COLORS.amber.dot}`} />
          <span className="min-w-0 whitespace-normal break-words">
            <span className="block text-xs font-medium">{note.title}</span>
            <span className="block text-xs font-normal text-muted-foreground">{format(parseISO(note.note_date), "dd/MM/yyyy")}{note.end_date ? ` – ${format(parseISO(note.end_date), "dd/MM/yyyy")}` : ""}</span>
          </span>
        </Button>)}
      </div>}
    </div>
  );
}