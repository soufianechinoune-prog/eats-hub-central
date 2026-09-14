import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { ReferenceLine } from "recharts";
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
}

/**
 * Lignes verticales + pastille cliquable pour chaque bucket contenant des notes.
 * IMPORTANT : fonction (pas composant) — Recharts ignore les composants enfants
 * inconnus, il faut donc inliner les <ReferenceLine> : {renderChartNoteMarkers({...})}.
 * Les lignes doivent exposer `periode` (yyyy-MM-dd du début de bucket) et `label` (clé X).
 */
export function renderChartNoteMarkers({ notes, rows, granularity, onMarkerClick }: ChartNoteMarkersProps) {
  if (notes.length === 0 || rows.length === 0) return null;

  const labelByBucket = new Map<string, string>();
  for (const r of rows) {
    if (r.periode) labelByBucket.set(r.periode.slice(0, 10), r.label);
  }

  const byLabel = new Map<string, ChartNote[]>();
  for (const note of notes) {
    const label = labelByBucket.get(noteBucketStart(note.note_date, granularity));
    if (!label) continue;
    const arr = byLabel.get(label) ?? [];
    arr.push(note);
    byLabel.set(label, arr);
  }

  return (
    <>
      {[...byLabel.entries()].map(([label, bucketNotes]) => {
        const color = CHART_NOTE_COLORS[bucketNotes[0].color]?.line ?? CHART_NOTE_COLORS.amber.line;
        return (
          <ReferenceLine
            key={`note-${label}`}
            x={label}
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
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkerClick(bucketNotes);
                  }}
                >
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
