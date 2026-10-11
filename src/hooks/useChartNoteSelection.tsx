import { useRef, useState } from "react";
import { endOfMonth, endOfWeek, format, parseISO } from "date-fns";
import { ReferenceArea } from "recharts";
import type { NoteGranularity } from "@/components/charts/ChartNoteMarkers";

interface CalendarRow { periode: string; label: string }
interface ChartPointerState { activeLabel?: string | number }

/** Calendar selection shared by all annotated charts; a click keeps its existing meaning. */
export function useChartNoteSelection(rows: CalendarRow[], granularity: NoteGranularity, onSelect: (start: Date, end: Date) => void) {
  const anchor = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const [selection, setSelection] = useState<{ start: string; end: string } | null>(null);
  const labelFor = (state: ChartPointerState | null) => {
    const label = state?.activeLabel;
    return label !== undefined && rows.some((r) => r.label === String(label)) ? String(label) : null;
  };
  const cancel = () => { anchor.current = null; setSelection(null); };
  const handlers = {
    onMouseDown: (state: ChartPointerState | null) => {
      const label = labelFor(state);
      suppressClick.current = false;
      anchor.current = label;
      if (label) setSelection({ start: label, end: label });
    },
    onMouseMove: (state: ChartPointerState | null) => {
      const label = labelFor(state);
      if (anchor.current && label) setSelection({ start: anchor.current, end: label });
    },
    onMouseUp: (state: ChartPointerState | null) => {
      const first = rows.find((r) => r.label === anchor.current);
      const last = rows.find((r) => r.label === (labelFor(state) ?? selection?.end));
      cancel();
      if (!first || !last || first.label === last.label) return;
      suppressClick.current = true;
      const [start, end] = [first.periode, last.periode].sort();
      const endDay = parseISO(end);
      onSelect(parseISO(start), granularity === "month" ? endOfMonth(endDay) : granularity === "week" ? endOfWeek(endDay, { weekStartsOn: 1 }) : endDay);
    },
    onMouseLeave: cancel,
  };
  return {
    handlers,
    consumeClick: () => { if (!suppressClick.current) return false; suppressClick.current = false; return true; },
    renderSelection: (yAxisId?: string | number) => selection && selection.start !== selection.end ? <ReferenceArea x1={selection.start} x2={selection.end} {...(yAxisId !== undefined ? { yAxisId } : {})} fill="hsl(var(--primary))" fillOpacity={0.12} stroke="hsl(var(--primary))" strokeOpacity={0.4} /> : null,
  };
}