import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpeningHours, OpeningHourSlot, getDayLabel } from "@/hooks/useOpeningHours";
import { Clock, Plus, Trash2, Copy, Save, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface OpeningHoursEditorProps {
  restaurantId: string;
}

const DAYS = [0, 1, 2, 3, 4, 5, 6]; // Lundi to Dimanche

const OpeningHoursEditor = ({ restaurantId }: OpeningHoursEditorProps) => {
  const [platform, setPlatform] = useState<string>("uber_eats");
  const [isEditing, setIsEditing] = useState(false);
  const [localSlots, setLocalSlots] = useState<OpeningHourSlot[]>([]);

  const { openingHours, isLoading, saveOpeningHours, isSaving, calculateTotalHours, getHoursPerDay } = 
    useOpeningHours(restaurantId, platform);

  useEffect(() => {
    setLocalSlots(openingHours);
  }, [openingHours]);

  const handleAddSlot = (day: number) => {
    const existingDaySlots = localSlots.filter(s => s.day_of_week === day);
    const lastSlot = existingDaySlots[existingDaySlots.length - 1];
    
    // Default to 11:00-14:30 or 18:00-23:00 if no slots exist, else continue from last
    let defaultStart = "11:00";
    let defaultEnd = "14:30";
    
    if (existingDaySlots.length === 1) {
      defaultStart = "18:00";
      defaultEnd = "23:00";
    } else if (lastSlot) {
      defaultStart = lastSlot.end_time;
      defaultEnd = "23:00";
    }

    const newSlot: OpeningHourSlot = {
      restaurant_id: restaurantId,
      platform,
      day_of_week: day,
      start_time: defaultStart,
      end_time: defaultEnd,
      is_overnight: false,
    };
    
    setLocalSlots(prev => [...prev, newSlot].sort((a, b) => 
      a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
    ));
  };

  const handleRemoveSlot = (day: number, index: number) => {
    const daySlots = localSlots.filter(s => s.day_of_week === day);
    const slotToRemove = daySlots[index];
    setLocalSlots(prev => prev.filter(s => 
      !(s.day_of_week === slotToRemove.day_of_week && 
        s.start_time === slotToRemove.start_time && 
        s.end_time === slotToRemove.end_time)
    ));
  };

  const handleUpdateSlot = (day: number, index: number, field: "start_time" | "end_time", value: string) => {
    const daySlots = localSlots.filter(s => s.day_of_week === day);
    const oldSlot = daySlots[index];
    
    setLocalSlots(prev => prev.map(s => {
      if (s.day_of_week === oldSlot.day_of_week && 
          s.start_time === oldSlot.start_time && 
          s.end_time === oldSlot.end_time) {
        const updated = { ...s, [field]: value };
        // Always recalculate if overnight based on current values
        updated.is_overnight = updated.end_time < updated.start_time;
        return updated;
      }
      return s;
    }));
  };

  const handleCopyToAllDays = (sourceDay: number) => {
    const sourceSlots = localSlots.filter(s => s.day_of_week === sourceDay);
    if (sourceSlots.length === 0) return;

    const newSlots: OpeningHourSlot[] = [];
    
    DAYS.forEach(day => {
      if (day !== sourceDay) {
        sourceSlots.forEach(slot => {
          newSlots.push({
            ...slot,
            id: undefined,
            day_of_week: day,
          });
        });
      }
    });

    // Keep source day slots and add copies to other days
    setLocalSlots([...sourceSlots, ...newSlots].sort((a, b) => 
      a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
    ));
  };

  const handleSave = () => {
    saveOpeningHours(localSlots);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalSlots(openingHours);
    setIsEditing(false);
  };

  const totalHours = calculateTotalHours(localSlots);
  const hoursPerDay = getHoursPerDay(localSlots);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement des horaires...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Horaires d'ouverture</CardTitle>
            <CardDescription>
              {totalHours > 0 ? `${totalHours}h/semaine` : "Non configuré"}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="mr-1 h-3 w-3" />
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="mr-1 h-3 w-3" />
                Enregistrer
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-1 h-3 w-3" />
              Modifier
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform Tabs */}
        <Tabs value={platform} onValueChange={setPlatform}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="uber_eats">Uber Eats</TabsTrigger>
            <TabsTrigger value="deliveroo">Deliveroo</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Days Grid */}
        <div className="space-y-3">
          {DAYS.map(day => {
            const daySlots = localSlots.filter(s => s.day_of_week === day);
            const dayHours = hoursPerDay[day] || 0;
            
            return (
              <div 
                key={day} 
                className={cn(
                  "p-3 rounded-lg border",
                  daySlots.length > 0 ? "bg-muted/30" : "bg-muted/10"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium w-20">{getDayLabel(day)}</span>
                    {dayHours > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayHours}h
                      </Badge>
                    )}
                  </div>
                  {isEditing && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddSlot(day)}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Créneau
                      </Button>
                      {daySlots.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyToAllDays(day)}
                          className="h-7 text-xs"
                          title="Copier vers tous les jours"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                
                {daySlots.length === 0 ? (
                  <span className="text-sm text-muted-foreground italic">Fermé</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot, idx) => (
                      <div 
                        key={`${day}-${idx}`}
                        className={cn(
                          "flex items-center gap-1 rounded-md px-2 py-1",
                          isEditing ? "bg-background border" : "bg-primary/10"
                        )}
                      >
                        {isEditing ? (
                          <>
                            <Input
                              type="time"
                              value={slot.start_time}
                              onChange={(e) => handleUpdateSlot(day, idx, "start_time", e.target.value)}
                              className="h-7 w-24 text-xs"
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                              type="time"
                              value={slot.end_time}
                              onChange={(e) => handleUpdateSlot(day, idx, "end_time", e.target.value)}
                              className="h-7 w-24 text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSlot(day, idx)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-sm font-medium">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            {slot.is_overnight && " (+1)"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {totalHours > 0 && !isEditing && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total hebdomadaire</span>
              <span className="font-semibold">{totalHours} heures</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OpeningHoursEditor;
