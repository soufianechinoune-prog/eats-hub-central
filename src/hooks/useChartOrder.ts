import { useState, useEffect, useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";

const STORAGE_KEY = "analytics_chart_order";

interface UseChartOrderOptions {
  defaultOrder: string[];
  viewMode: string;
}

export function useChartOrder({ defaultOrder, viewMode }: UseChartOrderOptions) {
  const storageKey = `${STORAGE_KEY}_${viewMode}`;
  
  const [chartOrder, setChartOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that all default charts are present (handles new charts being added)
        const validOrder = parsed.filter((id: string) => defaultOrder.includes(id));
        const missingCharts = defaultOrder.filter(id => !validOrder.includes(id));
        return [...validOrder, ...missingCharts];
      }
    } catch (e) {
      console.warn("Failed to parse chart order from localStorage", e);
    }
    return defaultOrder;
  });

  // Persist to localStorage whenever order changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(chartOrder));
  }, [chartOrder, storageKey]);

  // Handle drag end event
  const handleDragEnd = useCallback((activeId: string, overId: string) => {
    if (activeId !== overId) {
      setChartOrder((items) => {
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  // Move chart up or down using arrows
  const moveChart = useCallback((chartId: string, direction: "up" | "down") => {
    setChartOrder((items) => {
      const currentIndex = items.indexOf(chartId);
      if (currentIndex === -1) return items;
      
      const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= items.length) return items;
      
      return arrayMove(items, currentIndex, newIndex);
    });
  }, []);

  // Reset to default order
  const resetOrder = useCallback(() => {
    setChartOrder(defaultOrder);
  }, [defaultOrder]);

  // Check if order differs from default
  const isCustomOrder = chartOrder.join(",") !== defaultOrder.join(",");

  return {
    chartOrder,
    handleDragEnd,
    moveChart,
    resetOrder,
    isCustomOrder,
  };
}
