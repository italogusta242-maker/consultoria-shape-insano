/**
 * @purpose Centralized type definitions for the diet/nutrition domain.
 * @dependencies Used by DietPlanEditor, DietTemplatesList, FoodAutocomplete, Dieta page.
 */

/** A single food item from the food_database table */
export interface FoodDBItem {
  id: string;
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  category: string;
  created_by?: string | null;
  portion_unit?: string | null;
  portion_amount?: number | null;
  portion_grams?: number | null;
}

/** A food entry within a meal (used in plans and templates) */
export interface MealFood {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  substitute?: {
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
}

/** A single meal containing multiple foods */
export interface Meal {
  name: string;
  time: string;
  foods: MealFood[];
}

/** A full diet template record */
export interface DietTemplate {
  id: string;
  name: string;
  description: string | null;
  goal: DietGoal;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meals: Meal[];
  specialist_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Allowed diet goals */
export type DietGoal = "deficit" | "bulking" | "manutenção" | "recomposição";

/** Food categories used across the system */
export const FOOD_CATEGORIES = [
  "proteínas", "carboidratos", "gorduras", "frutas", "vegetais",
  "laticínios", "grãos", "suplementos", "outros",
] as const;

export type FoodCategory = typeof FOOD_CATEGORIES[number];
