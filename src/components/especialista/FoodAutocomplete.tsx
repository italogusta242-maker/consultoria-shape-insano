import { useState, useRef, useEffect, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Star, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";

interface FoodDBItem {
  id: string;
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  portion_unit?: string | null;
  portion_amount?: number | null;
  portion_grams?: number | null;
  fonte?: string | null;
}

interface Props {
  value: string;
  onChange: (name: string) => void;
  onSelect: (food: FoodDBItem) => void;
  className?: string;
}


const FoodAutocomplete = memo(function FoodAutocomplete({ value, onChange, onSelect, className }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const debouncedQuery = useDebounce(rawQuery.trim(), 500);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch user's favorite food IDs
  const { data: favoriteIds } = useQuery({
    queryKey: ["food-favorites", user?.id],
    queryFn: async () => {
      if (!user?.id) return new Set<string>();
      const { data } = await supabase
        .from("food_favorites")
        .select("food_id")
        .eq("specialist_id", user.id);
      return new Set((data ?? []).map((f: any) => f.food_id));
    },
    enabled: !!user?.id,
  });

  const { data: suggestions, isLoading: isSearching } = useQuery({
    queryKey: ["food-autocomplete", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return [];

      // Use unaccent DB function for accent-insensitive search
      const { data, error } = await supabase.rpc("search_foods_unaccent", {
        search_term: debouncedQuery,
        max_results: 30,
      });

      if (error) {
        console.error("search_foods_unaccent error:", error);
        return [];
      }

      let items = (data ?? []) as FoodDBItem[];

      // Sort: favorites first, then shorter names, then TACO before TBCA
      items.sort((a, b) => {
        const aFav = favoriteIds?.has(a.id) ? 0 : 1;
        const bFav = favoriteIds?.has(b.id) ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        const lenDiff = a.name.length - b.name.length;
        if (lenDiff !== 0) return lenDiff;
        const aSource = a.fonte === "TACO" ? 0 : 1;
        const bSource = b.fonte === "TACO" ? 0 : 1;
        return aSource - bSource;
      });

      return items.slice(0, 20);
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInputChange = (val: string) => {
    onChange(val);
    setRawQuery(val);
    setOpen(val.trim().length >= 2);
  };

  const handleSelect = (food: FoodDBItem) => {
    onChange(food.name);
    setOpen(false);
    onSelect(food);
  };

  const toggleFavorite = async (e: React.MouseEvent, foodId: string) => {
    e.stopPropagation();
    if (!user?.id) return;
    const isFav = favoriteIds?.has(foodId);
    if (isFav) {
      await supabase.from("food_favorites").delete().eq("specialist_id", user.id).eq("food_id", foodId);
    } else {
      await supabase.from("food_favorites").insert({ specialist_id: user.id, food_id: foodId });
    }
    queryClient.invalidateQueries({ queryKey: ["food-favorites", user.id] });
  };

  const showDropdown = open && debouncedQuery.length >= 2;
  const hasResults = suggestions && suggestions.length > 0;

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="relative">
        <Input
          placeholder="Alimento"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => value.trim().length >= 2 && setOpen(true)}
          className={cn("h-7 text-xs", className)}
        />
        {isSearching && debouncedQuery.length >= 2 && (
          <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Buscando...
            </div>
          ) : hasResults ? (
            suggestions.map((food) => (
              <button
                key={food.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors border-b border-border/30 last:border-0 flex items-start gap-2"
                onClick={() => handleSelect(food)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {food.name}
                    {food.fonte && (
                      <span className="ml-1 text-[9px] font-normal text-muted-foreground">
                        [{food.fonte}]
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {food.calories} kcal · P{food.protein}g · C{food.carbs}g · G{food.fat}g
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 mt-0.5"
                  onClick={(e) => toggleFavorite(e, food.id)}
                >
                  <Star
                    size={12}
                    className={cn(
                      "transition-colors",
                      favoriteIds?.has(food.id) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"
                    )}
                  />
                </button>
              </button>
            ))
          ) : (
            <p className="py-4 px-3 text-xs text-muted-foreground text-center">
              Nenhum alimento encontrado. Tente buscar por termos mais simples.
            </p>
          )}
        </div>
      )}
    </div>
  );
});

export default FoodAutocomplete;
