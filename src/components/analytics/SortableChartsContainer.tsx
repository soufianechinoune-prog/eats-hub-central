import { ReactNode, Children, cloneElement, isValidElement, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useChartOrder } from "@/hooks/useChartOrder";
import { SortableChartCard } from "./SortableChartCard";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface ChartConfig {
  id: string;
  component: ReactNode;
  visible?: boolean;
}

interface SortableChartsContainerProps {
  charts: ChartConfig[];
  viewMode: string;
  showResetButton?: boolean;
}

export function SortableChartsContainer({
  charts,
  viewMode,
  showResetButton = true,
}: SortableChartsContainerProps) {
  const visibleCharts = useMemo(
    () => charts.filter((c) => c.visible !== false),
    [charts]
  );

  const defaultOrder = useMemo(
    () => visibleCharts.map((c) => c.id),
    [visibleCharts]
  );

  const { chartOrder, handleDragEnd, moveChart, resetOrder, isCustomOrder } =
    useChartOrder({ defaultOrder, viewMode });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      handleDragEnd(active.id as string, over.id as string);
    }
  };

  // Sort charts according to chartOrder, filtering to only those in defaultOrder
  const sortedCharts = useMemo(() => {
    const chartMap = new Map(visibleCharts.map((c) => [c.id, c]));
    return chartOrder
      .filter((id) => chartMap.has(id))
      .map((id) => chartMap.get(id)!);
  }, [chartOrder, visibleCharts]);

  if (visibleCharts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Reset button */}
      {showResetButton && isCustomOrder && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetOrder}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser l'ordre
          </Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={sortedCharts.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedCharts.map((chart, index) => (
            <SortableChartCard
              key={chart.id}
              id={chart.id}
              onMoveUp={() => moveChart(chart.id, "up")}
              onMoveDown={() => moveChart(chart.id, "down")}
              canMoveUp={index > 0}
              canMoveDown={index < sortedCharts.length - 1}
            >
              {chart.component}
            </SortableChartCard>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
