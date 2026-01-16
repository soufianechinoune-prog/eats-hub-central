import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode, useState } from "react";

interface SortableChartCardProps {
  id: string;
  children: ReactNode;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  disabled?: boolean;
}

export function SortableChartCard({
  id,
  children,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  disabled = false,
}: SortableChartCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50 opacity-90 shadow-2xl"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle & arrows - visible on hover */}
      <div
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex flex-col items-center gap-1 transition-opacity duration-200 z-10",
          isHovered || isDragging ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Move up button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-full bg-background border shadow-sm hover:bg-muted",
            !canMoveUp && "opacity-30 cursor-not-allowed"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (canMoveUp) onMoveUp?.();
          }}
          disabled={!canMoveUp}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>

        {/* Drag handle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-background border shadow-sm hover:bg-muted cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>

        {/* Move down button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-full bg-background border shadow-sm hover:bg-muted",
            !canMoveDown && "opacity-30 cursor-not-allowed"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (canMoveDown) onMoveDown?.();
          }}
          disabled={!canMoveDown}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Chart content */}
      {children}
    </div>
  );
}

// Simple arrow-based reordering wrapper (no DnD, just arrows)
interface ReorderableChartCardProps {
  children: ReactNode;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function ReorderableChartCard({
  children,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}: ReorderableChartCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Arrows - visible on hover */}
      <div
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex flex-col items-center gap-1 transition-opacity duration-200 z-10",
          isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Move up button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-full bg-background border shadow-sm hover:bg-muted transition-colors",
            !canMoveUp && "opacity-30 cursor-not-allowed"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (canMoveUp) onMoveUp?.();
          }}
          disabled={!canMoveUp}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>

        {/* Move down button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-full bg-background border shadow-sm hover:bg-muted transition-colors",
            !canMoveDown && "opacity-30 cursor-not-allowed"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (canMoveDown) onMoveDown?.();
          }}
          disabled={!canMoveDown}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Chart content */}
      {children}
    </div>
  );
}
