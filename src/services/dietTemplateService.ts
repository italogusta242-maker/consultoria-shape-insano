/**
 * @purpose Service layer for diet_templates CRUD operations.
 * @dependencies supabase client.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DietTemplate, Meal } from "@/types/diet";

/** Fetch templates with optional goal filter */
export async function fetchDietTemplates(goal?: string | null): Promise<DietTemplate[]> {
  let query = supabase.from("diet_templates").select("*").order("goal").order("total_calories");
  if (goal) query = query.eq("goal", goal);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    ...t,
    meals: (typeof t.meals === "string" ? JSON.parse(t.meals) : t.meals) as Meal[],
  })) as DietTemplate[];
}

/** Create a new diet template */
export async function createDietTemplate(input: {
  name: string;
  description?: string | null;
  goal: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meals?: Meal[];
  specialist_id?: string;
}): Promise<void> {
  const { error } = await supabase.from("diet_templates").insert({
    name: input.name,
    description: input.description ?? null,
    goal: input.goal,
    total_calories: input.total_calories,
    total_protein: input.total_protein,
    total_carbs: input.total_carbs,
    total_fat: input.total_fat,
    meals: (input.meals ?? []) as any,
    specialist_id: input.specialist_id,
  });
  if (error) throw error;
}

/** Delete a diet template by ID */
export async function deleteDietTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("diet_templates").delete().eq("id", id);
  if (error) throw error;
}
