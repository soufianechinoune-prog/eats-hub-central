import { useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

export function MijoSplitView({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(29);
  const updateWidth = (value: number) => setWidth(Math.min(55, Math.max(22, value)));

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-w-0 shrink-0 overflow-hidden" style={{ width: `${width}%` }}>
        {sidebar}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-label="Largeur de la liste des conversations"
        aria-orientation="vertical"
        aria-valuemin={22}
        aria-valuemax={55}
        aria-valuenow={Math.round(width)}
        title="Redimensionner la liste des conversations"
        className="relative flex w-2 shrink-0 touch-none cursor-col-resize items-center justify-center border-x border-border/50 bg-muted/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const bounds = containerRef.current?.getBoundingClientRect();
          if (!bounds || bounds.width === 0) return;
          updateWidth(((event.clientX - bounds.left) / bounds.width) * 100);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          updateWidth(event.key === "Home" ? 22 : event.key === "End" ? 55 : width + (event.key === "ArrowRight" ? 2 : -2));
        }}
      >
        <GripVertical className="h-4 w-3 shrink-0 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}