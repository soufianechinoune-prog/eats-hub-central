import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { ReferenceArea, ReferenceLine } from "recharts";
import { CHART_NOTE_COLORS, type ChartNote } from "@/hooks/useChartNotes";

export type NoteGranularity = "day" | "week" | "month";

/** Ramène une date de note au début du bucket affiché sur le graphique. */
export function noteBucketStart(noteDate: string, granularity: NoteGranularity): string {
  const d = parseISO(noteDate);
  if (granularity === "week") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  if (granularity === "month") return format(startOfMonth(d), "yyyy-MM-dd");
  return format(d, "yyyy-MM-dd");
}

interface RowWithPeriode {
  periode: string;
  label: string;
}

interface ChartNoteMarkersProps {
  notes: ChartNote[];
  rows: RowWithPeriode[];
  granularity: NoteGranularity;
  onMarkerClick: (notes: ChartNote[]) => void;
  /** Requis quand le graphique déclare des axes Y nommés (ex. "left"/"right"). */
  yAxisId?: string | number;
}

/**
 * Lignes verticales + pastille cliquable pour chaque bucket contenant des notes.
 * IMPORTANT : fonction (pas composant) — Recharts ignore les composants enfants
 * inconnus, il faut donc inliner les <ReferenceLine> : {renderChartNoteMarkers({...})}.
 * Les lignes doivent exposer `periode` (yyyy-MM-dd du début de bucket) et `label` (clé X).
 */
export function renderChartNoteMarkers({ notes, rows, granularity, onMarkerClick, yAxisId }: ChartNoteMarkersProps) {
  if (notes.length === 0 || rows.length === 0) return null;


  const labelByBucket = new Map<string, string>();
  for (const r of rows) {
    if (r.periode) labelByBucket.set(r.periode.slice(0, 10), r.label);
  }

  const periods = notes.filter((note) => note.end_date);
  const byLabel = new Map<string, ChartNote[]>();
  for (const note of notes) {
    const startBucket = noteBucketStart(note.note_date, granularity);
    const label = labelByBucket.get(startBucket) ?? (note.end_date ? rows.find((r) => r.periode >= startBucket && r.periode <= noteBucketStart(note.end_date ?? note.note_date, granularity))?.label : undefined);
    if (!label) continue;
    const arr = byLabel.get(label) ?? [];
    arr.push(note);
    byLabel.set(label, arr);
  }

  return (
    <>
      {periods.map((note) => {
        const start = noteBucketStart(note.note_date, granularity);
        const end = noteBucketStart(note.end_date ?? note.note_date, granularity);
        const visible = rows.filter((r) => r.periode.slice(0, 10) >= start && r.periode.slice(0, 10) <= end);
        if (!visible.length) return null;
        const color = CHART_NOTE_COLORS[note.color]?.line ?? CHART_NOTE_COLORS.amber.line;
        return <ReferenceArea key={`period-${note.id}`} x1={visible[0].label} x2={visible[visible.length - 1].label} {...(yAxisId !== undefined ? { yAxisId } : {})} fill={color} fillOpacity={0.1} stroke={color} strokeOpacity={0.25} />;
      })}
      {[...byLabel.entries()].map(([label, bucketNotes]) => {
        const color = CHART_NOTE_COLORS[bucketNotes[0].color]?.line ?? CHART_NOTE_COLORS.amber.line;
        return (
          <ReferenceLine
            key={`note-${label}`}
            x={label}
            {...(yAxisId !== undefined ? { yAxisId } : {})}
            stroke={color}

            strokeDasharray="4 3"
            strokeOpacity={0.8}
            label={(props: any) => {
              const { viewBox } = props;
              if (!viewBox) return null;
              const x = viewBox.x;
              const y = viewBox.y ?? 0;
              return (
                <g
                  transform={`translate(${x}, ${y - 10})`}
                  role="button"
                  tabIndex={0}
                  aria-label={bucketNotes.map((note) => note.title).join(" · ")}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  style={{ cursor: "pointer" }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    e.stopPropagation();
                    onMarkerClick(bucketNotes);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkerClick(bucketNotes);
                  }}
                >
                  <title>{bucketNotes.map((note) => `${note.title} · ${note.note_date}${note.end_date ? ` → ${note.end_date}` : ""}`).join(" · ")}</title>
                  <circle r={8} fill={color} stroke="hsl(var(--background))" strokeWidth={1.5} />
                  <text
                    textAnchor="middle"
                    dy={3}
                    fontSize={9}
                    fontWeight={700}
                    fill="hsl(var(--background))"
                  >
                    {bucketNotes.length > 1 ? bucketNotes.length : "!"}
                  </text>
                </g>
              );
            }}
          />
        );
      })}
    </>
  );
}
