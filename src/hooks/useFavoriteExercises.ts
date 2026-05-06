/**
 * @purpose Specialist favorite exercises - load + optimistic toggle.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const FAVORITE_EXERCISES_KEY = ["favorite-exercises"] as const;

export function useFavoriteExercises() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = new Set<string>() } = useQuery({
    queryKey: FAVORITE_EXERCISES_KEY,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialist_favorite_exercises")
        .select("exercise_id")
        .eq("specialist_id", user!.id);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r) => r.exercise_id));
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ exerciseId, isFav }: { exerciseId: string; isFav: boolean }) => {
      if (!user?.id) throw new Error("Não autenticado");
      if (isFav) {
        const { error } = await supabase
          .from("specialist_favorite_exercises")
          .delete()
          .eq("specialist_id", user.id)
          .eq("exercise_id", exerciseId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("specialist_favorite_exercises")
          .insert({ specialist_id: user.id, exercise_id: exerciseId });
        if (error) throw error;
      }
    },
    onMutate: async ({ exerciseId, isFav }) => {
      await queryClient.cancelQueries({ queryKey: FAVORITE_EXERCISES_KEY });
      const previous = queryClient.getQueryData<Set<string>>(FAVORITE_EXERCISES_KEY);
      const next = new Set(previous ?? []);
      if (isFav) next.delete(exerciseId);
      else next.add(exerciseId);
      queryClient.setQueryData(FAVORITE_EXERCISES_KEY, next);
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(FAVORITE_EXERCISES_KEY, ctx.previous);
      toast.error(err.message);
    },
  });

  return {
    favorites,
    isFavorite: (id: string) => favorites.has(id),
    toggle: (exerciseId: string) =>
      toggleFavorite.mutate({ exerciseId, isFav: favorites.has(exerciseId) }),
  };
}
