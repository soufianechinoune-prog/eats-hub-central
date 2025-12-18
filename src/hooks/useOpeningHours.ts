import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OpeningHourSlot {
  id?: string;
  restaurant_id: string;
  platform: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_overnight?: boolean;
}

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export const getDayLabel = (dayIndex: number): string => DAY_LABELS[dayIndex] || "";

export const useOpeningHours = (restaurantId: string | undefined, platform: string = "uber_eats") => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: openingHours, isLoading } = useQuery({
    queryKey: ["opening-hours", restaurantId, platform],
    queryFn: async () => {
      if (!restaurantId) return [];
      
      const { data, error } = await supabase
        .from("restaurant_opening_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("platform", platform)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return data as OpeningHourSlot[];
    },
    enabled: !!restaurantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (slots: OpeningHourSlot[]) => {
      if (!restaurantId) throw new Error("Restaurant ID required");

      // Delete existing slots for this restaurant/platform
      const { error: deleteError } = await supabase
        .from("restaurant_opening_hours")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("platform", platform);

      if (deleteError) throw deleteError;

      // Insert new slots if any
      if (slots.length > 0) {
        const slotsToInsert = slots.map(slot => ({
          restaurant_id: restaurantId,
          platform,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_overnight: slot.is_overnight || false,
        }));

        const { error: insertError } = await supabase
          .from("restaurant_opening_hours")
          .insert(slotsToInsert);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opening-hours", restaurantId, platform] });
      toast({ title: "Succès", description: "Horaires enregistrés" });
    },
    onError: (error) => {
      console.error("Error saving opening hours:", error);
      toast({ title: "Erreur", description: "Impossible d'enregistrer les horaires", variant: "destructive" });
    },
  });

  // Calculate total weekly hours
  const calculateTotalHours = (slots: OpeningHourSlot[]): number => {
    let totalMinutes = 0;
    
    slots.forEach(slot => {
      const [startH, startM] = slot.start_time.split(":").map(Number);
      const [endH, endM] = slot.end_time.split(":").map(Number);
      
      let startMinutes = startH * 60 + startM;
      let endMinutes = endH * 60 + endM;
      
      // Handle overnight slots
      if (endMinutes <= startMinutes || slot.is_overnight) {
        endMinutes += 24 * 60;
      }
      
      totalMinutes += endMinutes - startMinutes;
    });
    
    return Math.round(totalMinutes / 60 * 10) / 10; // Round to 1 decimal
  };

  // Get hours per day
  const getHoursPerDay = (slots: OpeningHourSlot[]): Record<number, number> => {
    const result: Record<number, number> = {};
    
    for (let day = 0; day < 7; day++) {
      const daySlots = slots.filter(s => s.day_of_week === day);
      let totalMinutes = 0;
      
      daySlots.forEach(slot => {
        const [startH, startM] = slot.start_time.split(":").map(Number);
        const [endH, endM] = slot.end_time.split(":").map(Number);
        
        let startMinutes = startH * 60 + startM;
        let endMinutes = endH * 60 + endM;
        
        if (endMinutes <= startMinutes || slot.is_overnight) {
          endMinutes += 24 * 60;
        }
        
        totalMinutes += endMinutes - startMinutes;
      });
      
      result[day] = Math.round(totalMinutes / 60 * 10) / 10;
    }
    
    return result;
  };

  return {
    openingHours: openingHours || [],
    isLoading,
    saveOpeningHours: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    calculateTotalHours,
    getHoursPerDay,
    getDayLabel,
  };
};
