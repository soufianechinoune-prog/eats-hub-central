import { useMemo, useState } from "react";
import { ReferenceLine, ReferenceArea } from "recharts";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Real CSS colors for Recharts (not Tailwind classes)
export const CONTEXTUAL_EVENT_COLORS = {
  public_holiday: {
    fill: "rgba(239, 68, 68, 0.08)", // Very light red
    stroke: "rgba(239, 68, 68, 0.6)",
    text: "#dc2626",
    icon: "🇫🇷",
  },
  school_holiday: {
    fill: "rgba(249, 115, 22, 0.08)", // Very light orange
    stroke: "rgba(249, 115, 22, 0.4)",
    text: "#ea580c",
    icon: "🎒",
  },
  football_match: {
    fill: "rgba(59, 130, 246, 0.08)", // Very light blue
    stroke: "rgba(59, 130, 246, 0.6)",
    text: "#2563eb",
    icon: "⚽",
  },
};

interface ContextualEvent {
  id: string;
  title?: string;
  description: string;
  start_date: string;
  end_date: string;
  type: "school_holiday" | "football_match" | "public_holiday";
  icon: string;
  // Football match specific
  home_team?: string;
  away_team?: string;
  time?: string;
  venue?: string;
  // School holiday specific
  zones?: string[];
}

interface ProcessedEvent extends ContextualEvent {
  x1: string;
  x2: string;
  startMonthIndex: number;
  endMonthIndex: number;
}

interface ContextualEventMarkerProps {
  event: ProcessedEvent;
  yAxisDomain?: [number, number];
}

// Custom label component for holiday markers (shows emoji at top)
function HolidayMarkerLabel({
  viewBox,
  event,
}: {
  viewBox?: { x?: number; y?: number };
  event: ProcessedEvent;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = CONTEXTUAL_EVENT_COLORS[event.type];

  if (!viewBox?.x) return null;

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <foreignObject
        x={(viewBox.x || 0) - 12}
        y={2}
        width={24}
        height={24}
        style={{ overflow: "visible" }}
      >
        <TooltipProvider>
          <UITooltip open={isHovered}>
            <TooltipTrigger asChild>
              <div
                className="w-6 h-6 flex items-center justify-center cursor-pointer rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: colors.fill,
                  border: `1px solid ${colors.stroke}`,
                }}
              >
                <span className="text-xs">{event.icon}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-xs z-[100]"
              sideOffset={5}
            >
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  {event.icon} {event.title || event.description}
                </p>
                {event.type === "public_holiday" && (
                  <p className="text-xs text-muted-foreground">Jour férié</p>
                )}
                {event.type === "football_match" && (
                  <>
                    <p className="text-xs">
                      {event.home_team} vs {event.away_team}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.time} • {event.venue}
                    </p>
                  </>
                )}
              </div>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>
      </foreignObject>
    </g>
  );
}

// Custom label component for school holidays (centered text)
function SchoolHolidayLabel({
  viewBox,
  event,
}: {
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  event: ProcessedEvent;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = CONTEXTUAL_EVENT_COLORS.school_holiday;

  if (!viewBox?.x || !viewBox?.width) return null;

  const centerX = viewBox.x + viewBox.width / 2;

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <foreignObject
        x={centerX - 40}
        y={8}
        width={80}
        height={24}
        style={{ overflow: "visible" }}
      >
        <TooltipProvider>
          <UITooltip open={isHovered}>
            <TooltipTrigger asChild>
              <div
                className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-all hover:scale-105"
                style={{
                  backgroundColor: "rgba(249, 115, 22, 0.15)",
                  color: colors.text,
                  border: `1px solid ${colors.stroke}`,
                }}
              >
                <span>🎒</span>
                <span>Vacances</span>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-xs z-[100]"
              sideOffset={5}
            >
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  🎒 {event.title || event.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  Du{" "}
                  {new Date(event.start_date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  au{" "}
                  {new Date(event.end_date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                {event.zones && event.zones.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {event.zones.join(", ")}
                  </p>
                )}
              </div>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>
      </foreignObject>
    </g>
  );
}

// Export components for rendering in charts
export function renderPublicHolidayMarker(event: ProcessedEvent) {
  const colors = CONTEXTUAL_EVENT_COLORS.public_holiday;
  return (
    <ReferenceLine
      key={`holiday-${event.id}`}
      x={event.x1}
      stroke={colors.stroke}
      strokeWidth={1.5}
      strokeDasharray="3 3"
      label={<HolidayMarkerLabel event={event} />}
    />
  );
}

export function renderSchoolHolidayArea(event: ProcessedEvent) {
  const colors = CONTEXTUAL_EVENT_COLORS.school_holiday;
  return (
    <ReferenceArea
      key={`school-${event.id}`}
      x1={event.x1}
      x2={event.x2}
      fill={colors.fill}
      fillOpacity={1}
      stroke={colors.stroke}
      strokeOpacity={0.5}
      strokeWidth={1}
      strokeDasharray="4 2"
      label={<SchoolHolidayLabel event={event} />}
    />
  );
}

export function renderFootballMatchMarker(event: ProcessedEvent) {
  const colors = CONTEXTUAL_EVENT_COLORS.football_match;
  return (
    <ReferenceLine
      key={`match-${event.id}`}
      x={event.x1}
      stroke={colors.stroke}
      strokeWidth={1.5}
      strokeDasharray="2 2"
      label={<HolidayMarkerLabel event={event} />}
    />
  );
}

// Daily view rendering functions (x value is formatted date like "05/03")
export function renderPublicHolidayMarkerDaily(event: ProcessedEvent) {
  const colors = CONTEXTUAL_EVENT_COLORS.public_holiday;
  return (
    <ReferenceLine
      key={`holiday-daily-${event.id}`}
      x={event.x1}
      stroke={colors.stroke}
      strokeWidth={1.5}
      strokeDasharray="3 3"
      label={<HolidayMarkerLabel event={event} />}
    />
  );
}

export function renderSchoolHolidayAreaDaily(event: ProcessedEvent) {
  const colors = CONTEXTUAL_EVENT_COLORS.school_holiday;
  return (
    <ReferenceArea
      key={`school-daily-${event.id}`}
      x1={event.x1}
      x2={event.x2}
      fill={colors.fill}
      fillOpacity={1}
      stroke={colors.stroke}
      strokeOpacity={0.5}
      strokeWidth={1}
      strokeDasharray="4 2"
      label={<SchoolHolidayLabel event={event} />}
    />
  );
}

export function renderFootballMatchMarkerDaily(event: ProcessedEvent) {
  const colors = CONTEXTUAL_EVENT_COLORS.football_match;
  return (
    <ReferenceLine
      key={`match-daily-${event.id}`}
      x={event.x1}
      stroke={colors.stroke}
      strokeWidth={1.5}
      strokeDasharray="2 2"
      label={<HolidayMarkerLabel event={event} />}
    />
  );
}

// Main export: process and categorize events for MONTHLY view
export function useProcessedContextualEvents(
  contextualEvents: ContextualEvent[],
  startMonth: number,
  endMonth: number,
  MONTHS: string[]
) {
  return useMemo(() => {
    const holidays: ProcessedEvent[] = [];
    const schoolHolidays: ProcessedEvent[] = [];
    const footballMatches: ProcessedEvent[] = [];

    contextualEvents.forEach((event) => {
      const eventStartMonth = new Date(event.start_date).getMonth();
      const eventEndMonth = event.end_date
        ? new Date(event.end_date).getMonth()
        : eventStartMonth;

      // Filter to events within the displayed range
      const startMonthNum = eventStartMonth + 1;
      const endMonthNum = eventEndMonth + 1;
      if (startMonthNum > endMonth || endMonthNum < startMonth) return;

      const processed: ProcessedEvent = {
        ...event,
        x1: MONTHS[eventStartMonth],
        x2: MONTHS[Math.min(eventEndMonth + 1, 11)],
        startMonthIndex: eventStartMonth,
        endMonthIndex: eventEndMonth,
      };

      switch (event.type) {
        case "public_holiday":
          holidays.push(processed);
          break;
        case "school_holiday":
          schoolHolidays.push(processed);
          break;
        case "football_match":
          footballMatches.push(processed);
          break;
      }
    });

    // Limit football matches to avoid clutter (max 5 visible per view)
    const limitedMatches = footballMatches.slice(0, 5);

    return { holidays, schoolHolidays, footballMatches: limitedMatches };
  }, [contextualEvents, startMonth, endMonth, MONTHS]);
}

// Process events for DAILY view (drilldown mode or global daily view)
export function useProcessedContextualEventsDaily(
  contextualEvents: ContextualEvent[],
  drillDownMonth: number | null,
  selectedYear: number,
  formatDateFn: (date: Date) => string // Format function to match X-axis (e.g., "05/03")
) {
  return useMemo(() => {
    console.log('[ContextualEventsDaily] params', { drillDownMonth, selectedYear, count: contextualEvents.length });

    const holidays: ProcessedEvent[] = [];
    const schoolHolidays: ProcessedEvent[] = [];
    const footballMatches: ProcessedEvent[] = [];

    // Define the visible window: either the selected month, or the whole year when no month is specified
    const windowStart = drillDownMonth
      ? new Date(selectedYear, drillDownMonth - 1, 1)
      : new Date(selectedYear, 0, 1);
    const windowEnd = drillDownMonth
      ? new Date(selectedYear, drillDownMonth, 0) // last day of month
      : new Date(selectedYear, 11, 31);

    contextualEvents.forEach((event) => {
      const eventStart = new Date(event.start_date);
      const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;

      // Skip if event doesn't overlap with the visible window (month or full year)
      if (eventEnd < windowStart || eventStart > windowEnd) return;

      // Clamp to the visible window
      const x1Date = eventStart < windowStart ? windowStart : eventStart;
      const x2Date = eventEnd > windowEnd ? windowEnd : eventEnd;

      const processed: ProcessedEvent = {
        ...event,
        x1: formatDateFn(x1Date),
        x2: formatDateFn(x2Date),
        startMonthIndex: eventStart.getMonth(),
        endMonthIndex: eventEnd.getMonth(),
      };

      switch (event.type) {
        case "public_holiday":
          holidays.push(processed);
          break;
        case "school_holiday":
          schoolHolidays.push(processed);
          break;
        case "football_match":
          footballMatches.push(processed);
          break;
      }
    });

    console.log('[ContextualEventsDaily] result', {
      holidays: holidays.length,
      schoolHolidays: schoolHolidays.length,
      footballMatches: footballMatches.length,
    });

    // Limit football matches to avoid clutter
    const limitedMatches = footballMatches.slice(0, 8);

    return { holidays, schoolHolidays, footballMatches: limitedMatches };
  }, [contextualEvents, drillDownMonth, selectedYear, formatDateFn]);
}
