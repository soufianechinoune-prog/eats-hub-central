import { Target } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface ObjectiveSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
}

export const ObjectiveSlider = ({
  value,
  onChange,
  min = 5,
  max = 30,
  step = 1,
  unit = "min",
  label = "Objectif:",
}: ObjectiveSliderProps) => {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 shadow-sm">
      <Target className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{label}</span>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-32"
      />
      <span className="text-sm font-semibold text-primary min-w-[3.5rem] text-right">
        {value} {unit}
      </span>
    </div>
  );
};
