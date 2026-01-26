import { useState } from "react";
import { format, addMonths, addYears } from "date-fns";
import { fr } from "date-fns/locale";

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
import { CalendarIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type DurationType = "1year" | "6months" | "custom";

export interface TimeSlot {
  startTime: string;
  endTime: string;
  daysOfWeek: number[]; // Each slot has its own days
}

export interface CustomSchedule {
  startDate: Date | undefined;
  endDate: Date | undefined;
  daysOfWeek: number[]; // Legacy - keeping for compatibility
  timeSlots: TimeSlot[];
}

interface BogoDurationSelectorProps {
  durationType: DurationType;
  onDurationTypeChange: (type: DurationType) => void;
  customSchedule: CustomSchedule;
  onCustomScheduleChange: (schedule: CustomSchedule) => void;
}

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

// Start hours: 0:00 to 23:00
const START_HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  return { value: `${hour}:00`, label: `${hour}:00` };
});

// End hours: 0:00 to 23:00 + next day hours until 3:00 AM
const END_HOURS = [
  ...Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, "0");
    return { value: `${hour}:00`, label: `${hour}:00`, nextDay: false };
  }),
  { value: "24:00", label: "00:00 (+1 jour)", nextDay: true },
  { value: "25:00", label: "01:00 (+1 jour)", nextDay: true },
  { value: "26:00", label: "02:00 (+1 jour)", nextDay: true },
  { value: "27:00", label: "03:00 (+1 jour)", nextDay: true },
];

export function BogoDurationSelector({
  durationType,
  onDurationTypeChange,
  customSchedule,
  onCustomScheduleChange,
}: BogoDurationSelectorProps) {
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [tempSchedule, setTempSchedule] = useState<CustomSchedule>(customSchedule);

  const handleOpenScheduleDialog = () => {
    // Migrate old format to new format if needed
    const migratedSlots = customSchedule.timeSlots.map(slot => ({
      ...slot,
      daysOfWeek: slot.daysOfWeek || customSchedule.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
    }));
    setTempSchedule({ ...customSchedule, timeSlots: migratedSlots });
    setShowScheduleDialog(true);
  };

  const handleSaveSchedule = () => {
    onCustomScheduleChange(tempSchedule);
    setShowScheduleDialog(false);
  };

  const handleSlotDayToggle = (slotIndex: number, dayValue: number) => {
    const newSlots = [...tempSchedule.timeSlots];
    const currentDays = newSlots[slotIndex].daysOfWeek || [];
    newSlots[slotIndex] = {
      ...newSlots[slotIndex],
      daysOfWeek: currentDays.includes(dayValue)
        ? currentDays.filter((d) => d !== dayValue)
        : [...currentDays, dayValue],
    };
    setTempSchedule({ ...tempSchedule, timeSlots: newSlots });
  };

  const handleSlotWeekdaysToggle = (slotIndex: number, checked: boolean) => {
    const newSlots = [...tempSchedule.timeSlots];
    const currentDays = newSlots[slotIndex].daysOfWeek || [];
    if (checked) {
      const weekdays = [1, 2, 3, 4, 5];
      newSlots[slotIndex] = {
        ...newSlots[slotIndex],
        daysOfWeek: [...new Set([...currentDays, ...weekdays])],
      };
    } else {
      newSlots[slotIndex] = {
        ...newSlots[slotIndex],
        daysOfWeek: currentDays.filter((d) => ![1, 2, 3, 4, 5].includes(d)),
      };
    }
    setTempSchedule({ ...tempSchedule, timeSlots: newSlots });
  };

  const handleSlotWeekendToggle = (slotIndex: number, checked: boolean) => {
    const newSlots = [...tempSchedule.timeSlots];
    const currentDays = newSlots[slotIndex].daysOfWeek || [];
    if (checked) {
      const weekend = [0, 6];
      newSlots[slotIndex] = {
        ...newSlots[slotIndex],
        daysOfWeek: [...new Set([...currentDays, ...weekend])],
      };
    } else {
      newSlots[slotIndex] = {
        ...newSlots[slotIndex],
        daysOfWeek: currentDays.filter((d) => ![0, 6].includes(d)),
      };
    }
    setTempSchedule({ ...tempSchedule, timeSlots: newSlots });
  };

  const handleTimeSlotChange = (index: number, field: "startTime" | "endTime", value: string) => {
    const newSlots = [...tempSchedule.timeSlots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setTempSchedule({ ...tempSchedule, timeSlots: newSlots });
  };

  const handleAddTimeSlot = () => {
    setTempSchedule({
      ...tempSchedule,
      timeSlots: [
        ...tempSchedule.timeSlots,
        { startTime: "11:00", endTime: "22:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      ],
    });
  };

  const handleRemoveTimeSlot = (index: number) => {
    const newSlots = tempSchedule.timeSlots.filter((_, i) => i !== index);
    setTempSchedule({
      ...tempSchedule,
      timeSlots: newSlots.length > 0 
        ? newSlots 
        : [{ startTime: "11:00", endTime: "22:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }],
    });
  };

  const getEndDate = () => {
    const now = new Date();
    if (durationType === "1year") return addYears(now, 1);
    if (durationType === "6months") return addMonths(now, 6);
    return customSchedule.endDate || addYears(now, 1);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sélectionnez la période durant laquelle vous proposerez votre offre.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDurationTypeChange("1year")}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors",
            durationType === "1year"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          1 an
        </button>
        <button
          type="button"
          onClick={() => onDurationTypeChange("6months")}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors",
            durationType === "6months"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          6 mois
        </button>
        <button
          type="button"
          onClick={() => {
            onDurationTypeChange("custom");
            // Migrate old format to new format if needed
            const migratedSlots = customSchedule.timeSlots.map(slot => ({
              ...slot,
              daysOfWeek: slot.daysOfWeek || customSchedule.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
            }));
            setTempSchedule({ ...customSchedule, timeSlots: migratedSlots });
            setShowScheduleDialog(true);
          }}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors",
            durationType === "custom"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Personnalisé
        </button>
      </div>

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
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
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

            {/* Time Slots - Each with its own days */}
            <div className="space-y-6">
              {tempSchedule.timeSlots.map((slot, index) => {
                const slotDays = slot.daysOfWeek || [];
                const isWeekdaysSelected = [1, 2, 3, 4, 5].every((d) => slotDays.includes(d));
                const isWeekendSelected = [0, 6].every((d) => slotDays.includes(d));

                return (
                  <div key={index} className="space-y-4 pb-4 border-b last:border-b-0">
                    {/* Days of Week for this slot */}
                    <div className="space-y-3">
                      <Label>Jours de disponibilité</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {DAYS.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => handleSlotDayToggle(index, day.value)}
                            className={cn(
                              "w-12 h-10 rounded-md text-sm font-medium transition-colors border-2",
                              slotDays.includes(day.value)
                                ? "bg-foreground text-background border-foreground"
                                : "bg-background text-foreground border-foreground hover:bg-muted"
                            )}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`weekdays-${index}`}
                            checked={isWeekdaysSelected}
                            onCheckedChange={(checked) => handleSlotWeekdaysToggle(index, !!checked)}
                          />
                          <Label htmlFor={`weekdays-${index}`} className="text-sm cursor-pointer">
                            En semaine
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`weekend-${index}`}
                            checked={isWeekendSelected}
                            onCheckedChange={(checked) => handleSlotWeekendToggle(index, !!checked)}
                          />
                          <Label htmlFor={`weekend-${index}`} className="text-sm cursor-pointer">
                            Le week-end
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Time selection for this slot */}
                    <div className="space-y-2">
                      <Label>Heure de début</Label>
                      <Select
                        value={slot.startTime}
                        onValueChange={(v) => handleTimeSlotChange(index, "startTime", v)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {START_HOURS.map((h) => (
                            <SelectItem key={h.value} value={h.value}>
                              {h.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Heure de fin</Label>
                      <Select
                        value={slot.endTime}
                        onValueChange={(v) => handleTimeSlotChange(index, "endTime", v)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue>
                            {END_HOURS.find(h => h.value === slot.endTime)?.label || slot.endTime}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {END_HOURS.map((h) => (
                            <SelectItem key={h.value} value={h.value}>
                              {h.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Remove slot link */}
                    <button
                      type="button"
                      onClick={() => handleRemoveTimeSlot(index)}
                      className="text-sm text-destructive hover:text-destructive/80 hover:underline"
                    >
                      Supprimer la plage horaire
                    </button>
                  </div>
                );
              })}

              <button
                onClick={handleAddTimeSlot}
                className="text-sm text-foreground hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="h-4 w-4" />
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
