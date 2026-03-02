import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORY_MAP: Record<string, string> = {
  "Cereais e derivados": "carboidratos",
  "Leguminosas e derivados": "grãos",
  "Vegetais e derivados": "vegetais",
  "Frutas e derivados": "frutas",
  "Carnes e derivados": "proteínas",
  "Pescados e frutos do mar": "proteínas",
  "Leite e derivados": "laticínios",
  "Ovos e derivados": "proteínas",
  "Gorduras e óleos": "gorduras",
  "Bebidas (alcoólicas e não alcoólicas)": "outros",
  "Bebidas": "outros",
  "Alimentos preparados": "outros",
  "Outros alimentos industrializados": "outros",
  "Nozes e sementes": "gorduras",
  "Miscelâneas": "outros",
  "Produtos açucarados": "carboidratos",
};

function mapCategory(cat: string): string {
  const trimmed = cat.trim().toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (key.toLowerCase() === trimmed) return val;
  }
  return "outros";
}

function parseNum(val: any): number {
  if (val === null || val === undefined || val === "" || val === "NA" || val === "Tr" || val === "tr" || val === "*") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if action=fetch-url to download from GitHub
    const url = new URL(req.url);
    const fetchUrl = url.searchParams.get("url");
    
    let tacoData: any[];
    
    if (fetchUrl) {
      // Fetch JSON from remote URL
      const resp = await fetch(fetchUrl);
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch: ${resp.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tacoData = await resp.json();
    } else {
      tacoData = await req.json();
    }
    
    if (!Array.isArray(tacoData)) {
      return new Response(JSON.stringify({ error: "Expected JSON array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { total: tacoData.length, inserted: 0, errors: 0, errorMessages: [] as string[] };
    const BATCH_SIZE = 200;

    for (let i = 0; i < tacoData.length; i += BATCH_SIZE) {
      const batch = tacoData.slice(i, i + BATCH_SIZE);
      const rows = [];

      for (const item of batch) {
        try {
          if (!item.description || item.description.length < 2) continue;

          rows.push({
            name: item.description,
            calories: parseNum(item.energy_kcal),
            protein: parseNum(item.protein_g),
            carbs: parseNum(item.carbohydrate_g),
            fat: parseNum(item.lipid_g),
            fiber: parseNum(item.fiber_g),
            category: mapCategory(item.category || ""),
            portion: "100g",
            portion_unit: "g",
            portion_amount: 1,
            portion_grams: 100,
            fonte: "TACO",
          });
        } catch (_e) {
          results.errors++;
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase.from("food_database").insert(rows);
        if (error) {
          results.errors += rows.length;
          results.errorMessages.push(`Batch ${i}: ${error.message}`);
        } else {
          results.inserted += rows.length;
        }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
