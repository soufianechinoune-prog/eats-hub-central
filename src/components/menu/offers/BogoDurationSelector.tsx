import { useState } from "react";
import { format, addMonths, addYears } from "date-fns";
import { fr } from "date-fns/locale";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type DurationType = "1year" | "6months" | "custom";

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface CustomSchedule {
  startDate: Date | undefined;
  endDate: Date | undefined;
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  timeSlots: TimeSlot[];
}

interface BogoDurationSelectorProps {
  durationType: DurationType;
  onDurationTypeChange: (type: DurationType) => void;
  customSchedule: CustomSchedule;
  onCustomScheduleChange: (schedule: CustomSchedule) => void;
}

const DAYS = [
  { value: 0, label: "Dim", fullLabel: "Dimanche" },
  { value: 1, label: "Lun", fullLabel: "Lundi" },
  { value: 2, label: "Mar", fullLabel: "Mardi" },
  { value: 3, label: "Mer", fullLabel: "Mercredi" },
  { value: 4, label: "Jeu", fullLabel: "Jeudi" },
  { value: 5, label: "Ven", fullLabel: "Vendredi" },
  { value: 6, label: "Sam", fullLabel: "Samedi" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  return { value: `${hour}:00`, label: `${hour}:00` };
});

export function BogoDurationSelector({
  durationType,
  onDurationTypeChange,
  customSchedule,
  onCustomScheduleChange,
}: BogoDurationSelectorProps) {
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [tempSchedule, setTempSchedule] = useState<CustomSchedule>(customSchedule);

  const handleOpenScheduleDialog = () => {
    setTempSchedule({ ...customSchedule });
    setShowScheduleDialog(true);
  };

  const handleSaveSchedule = () => {
    onCustomScheduleChange(tempSchedule);
    setShowScheduleDialog(false);
  };

  const handleDayToggle = (dayValue: number) => {
    const newDays = tempSchedule.daysOfWeek.includes(dayValue)
      ? tempSchedule.daysOfWeek.filter((d) => d !== dayValue)
      : [...tempSchedule.daysOfWeek, dayValue];
    setTempSchedule({ ...tempSchedule, daysOfWeek: newDays });
  };

  const handleWeekdaysToggle = (checked: boolean) => {
    if (checked) {
      const weekdays = [1, 2, 3, 4, 5];
      const newDays = [...new Set([...tempSchedule.daysOfWeek, ...weekdays])];
      setTempSchedule({ ...tempSchedule, daysOfWeek: newDays });
    } else {
      const newDays = tempSchedule.daysOfWeek.filter((d) => ![1, 2, 3, 4, 5].includes(d));
      setTempSchedule({ ...tempSchedule, daysOfWeek: newDays });
    }
  };

  const handleWeekendToggle = (checked: boolean) => {
    if (checked) {
      const weekend = [0, 6];
      const newDays = [...new Set([...tempSchedule.daysOfWeek, ...weekend])];
      setTempSchedule({ ...tempSchedule, daysOfWeek: newDays });
    } else {
      const newDays = tempSchedule.daysOfWeek.filter((d) => ![0, 6].includes(d));
      setTempSchedule({ ...tempSchedule, daysOfWeek: newDays });
    }
  };

  const handleTimeSlotChange = (index: number, field: "startTime" | "endTime", value: string) => {
    const newSlots = [...tempSchedule.timeSlots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setTempSchedule({ ...tempSchedule, timeSlots: newSlots });
  };

  const handleAddTimeSlot = () => {
    setTempSchedule({
      ...tempSchedule,
      timeSlots: [...tempSchedule.timeSlots, { startTime: "11:00", endTime: "22:00" }],
    });
  };

  const handleRemoveTimeSlot = (index: number) => {
    const newSlots = tempSchedule.timeSlots.filter((_, i) => i !== index);
    setTempSchedule({ ...tempSchedule, timeSlots: newSlots.length > 0 ? newSlots : [{ startTime: "11:00", endTime: "22:00" }] });
  };

  const getEndDate = () => {
    const now = new Date();
    if (durationType === "1year") return addYears(now, 1);
    if (durationType === "6months") return addMonths(now, 6);
    return customSchedule.endDate || addYears(now, 1);
  };

  const isWeekdaysSelected = [1, 2, 3, 4, 5].every((d) => tempSchedule.daysOfWeek.includes(d));
  const isWeekendSelected = [0, 6].every((d) => tempSchedule.daysOfWeek.includes(d));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sélectionnez la période durant laquelle vous proposerez votre offre.
      </p>

      <ToggleGroup
        type="single"
        value={durationType}
        onValueChange={(v) => v && onDurationTypeChange(v as DurationType)}
        className="justify-start"
      >
        <ToggleGroupItem value="1year" className="px-4">
          1 an
        </ToggleGroupItem>
        <ToggleGroupItem value="6months" className="px-4">
          6 mois
        </ToggleGroupItem>
        <ToggleGroupItem value="custom" className="px-4">
          Personnalisé
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="text-sm text-muted-foreground">
        Fin prévue : <span className="font-medium text-foreground">{format(getEndDate(), "d MMMM yyyy", { locale: fr })}</span>
      </div>

      <button
        onClick={handleOpenScheduleDialog}
        className="text-sm text-primary hover:underline flex items-center gap-1"
      >
        <Plus className="h-3 w-3" />
        Spécifier le moment de la journée
      </button>

      {/* Custom Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Planning personnalisé</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempSchedule.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempSchedule.startDate
                        ? format(tempSchedule.startDate, "dd/MM/yyyy")
                        : "Sélectionner"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempSchedule.startDate}
                      onSelect={(date) => setTempSchedule({ ...tempSchedule, startDate: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempSchedule.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempSchedule.endDate
                        ? format(tempSchedule.endDate, "dd/MM/yyyy")
                        : "Sélectionner"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempSchedule.endDate}
                      onSelect={(date) => setTempSchedule({ ...tempSchedule, endDate: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Days of Week */}
            <div className="space-y-3">
              <Label>Jours de disponibilité</Label>
              <div className="flex gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayToggle(day.value)}
                    className={cn(
                      "w-10 h-10 rounded-full text-sm font-medium transition-colors",
                      tempSchedule.daysOfWeek.includes(day.value)
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="weekdays"
                    checked={isWeekdaysSelected}
                    onCheckedChange={handleWeekdaysToggle}
                  />
                  <Label htmlFor="weekdays" className="text-sm cursor-pointer">
                    En semaine
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="weekend"
                    checked={isWeekendSelected}
                    onCheckedChange={handleWeekendToggle}
                  />
                  <Label htmlFor="weekend" className="text-sm cursor-pointer">
                    Le week-end
                  </Label>
                </div>
              </div>
            </div>

            {/* Time Slots */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Plages horaires
              </Label>
              
              {tempSchedule.timeSlots.map((slot, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={slot.startTime}
                    onValueChange={(v) => handleTimeSlotChange(index, "startTime", v)}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">à</span>
                  <Select
                    value={slot.endTime}
                    onValueChange={(v) => handleTimeSlotChange(index, "endTime", v)}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {tempSchedule.timeSlots.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTimeSlot(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}

              <button
                onClick={handleAddTimeSlot}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Ajouter une autre plage horaire
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveSchedule}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
