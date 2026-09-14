import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

export interface ChartNote {
  id: string;
  chain_id: string;
  restaurant_ids: string[];
  note_date: string; // yyyy-MM-dd
  title: string;
  description: string | null;
  color: string;
  created_by: string | null;
  created_at: string;
}

export type ChartNoteColor = "amber" | "red" | "blue" | "green";

export const CHART_NOTE_COLORS: Record<string, { dot: string; line: string; label: string }> = {
  amber: { dot: "bg-amber-500", line: "hsl(38 92% 50%)", label: "Info" },
  red: { dot: "bg-red-500", line: "hsl(0 84% 60%)", label: "Incident" },
  blue: { dot: "bg-blue-500", line: "hsl(217 91% 60%)", label: "Note" },
  green: { dot: "bg-emerald-500", line: "hsl(142 71% 45%)", label: "Positif" },
};

export function useChartNotes(start: string, end: string) {
  const { selectedChainId } = useAnalyticsContext();

  return useQuery({
    queryKey: ["chart_notes", selectedChainId, start, end],
    queryFn: async (): Promise<ChartNote[]> => {
      if (!selectedChainId) return [];
      const { data, error } = await supabase
        .from("chart_notes")
        .select("*")
        .eq("chain_id", selectedChainId)
        .gte("note_date", start)
        .lte("note_date", end)
        .order("note_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChartNote[];
    },
    enabled: !!selectedChainId && !!start && !!end,
  });
}

/** Filtre les notes selon le scope restaurant courant (undefined = pas encore résolu). */
export function filterNotesByScope(
  notes: ChartNote[] | undefined,
  restaurantFilter: string[] | null | undefined
): ChartNote[] {
  if (!notes) return [];
  if (restaurantFilter === undefined) return [];
  if (restaurantFilter === null) return notes; // toute la chaîne
  return notes.filter(
    (n) => n.restaurant_ids.length === 0 || n.restaurant_ids.some((id) => restaurantFilter.includes(id))
  );
}

export function useChartNoteMutations() {
  const queryClient = useQueryClient();
  const { selectedChainId } = useAnalyticsContext();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["chart_notes", selectedChainId] });

  const createNote = useMutation({
    mutationFn: async (note: {
      note_date: string;
      title: string;
      description?: string;
      color: ChartNoteColor;
      restaurant_ids: string[];
    }) => {
      if (!selectedChainId) throw new Error("Aucune enseigne sélectionnée");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("chart_notes").insert({
        chain_id: selectedChainId,
        note_date: note.note_date,
        title: note.title,
        description: note.description || null,
        color: note.color,
        restaurant_ids: note.restaurant_ids,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: async (note: {
      id: string;
      note_date: string;
      title: string;
      description?: string;
      color: ChartNoteColor;
    }) => {
      const { error } = await supabase
        .from("chart_notes")
        .update({
          note_date: note.note_date,
          title: note.title,
          description: note.description || null,
          color: note.color,
          updated_at: new Date().toISOString(),
        })
        .eq("id", note.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createNote, updateNote, deleteNote };
}
