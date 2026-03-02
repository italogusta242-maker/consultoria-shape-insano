import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Reference macros per 100g for common Brazilian foods (TBCA/TACO) */
const MACRO_REFERENCE: Record<string, { cal: number; p: number; c: number; f: number; defaultPortion: string }> = {
  "arroz": { cal: 128, p: 2.5, c: 28, f: 0.2, defaultPortion: "4 colheres de sopa ou 120g" },
  "feijão": { cal: 77, p: 4.5, c: 14, f: 0.5, defaultPortion: "1 concha ou 100g" },
  "frango": { cal: 159, p: 32, c: 0, f: 3, defaultPortion: "1 filé ou 120g" },
  "ovo": { cal: 143, p: 13, c: 0.7, f: 9.5, defaultPortion: "1 unidade ou 50g" },
  "banana": { cal: 89, p: 1.1, c: 22, f: 0.3, defaultPortion: "1 unidade ou 100g" },
  "aveia": { cal: 394, p: 14, c: 67, f: 8, defaultPortion: "3 colheres de sopa ou 30g" },
  "whey": { cal: 400, p: 80, c: 8, f: 4, defaultPortion: "1 scoop ou 30g" },
  "batata doce": { cal: 86, p: 1.6, c: 20, f: 0.1, defaultPortion: "1 unidade média ou 150g" },
  "leite": { cal: 42, p: 3.4, c: 5, f: 1, defaultPortion: "1 copo ou 200ml" },
  "pão": { cal: 265, p: 9, c: 49, f: 3.2, defaultPortion: "2 fatias ou 50g" },
  "maçã": { cal: 52, p: 0.3, c: 14, f: 0.2, defaultPortion: "1 unidade ou 150g" },
  "carne": { cal: 200, p: 26, c: 0, f: 10, defaultPortion: "1 bife ou 120g" },
  "queijo": { cal: 350, p: 23, c: 1.3, f: 28, defaultPortion: "2 fatias ou 40g" },
  "azeite": { cal: 884, p: 0, c: 0, f: 100, defaultPortion: "1 colher de sopa ou 13ml" },
  "manteiga de amendoim": { cal: 588, p: 25, c: 20, f: 50, defaultPortion: "1 colher de sopa ou 15g" },
  "iogurte": { cal: 63, p: 5, c: 7, f: 1.5, defaultPortion: "1 pote ou 170g" },
  "pasta de amendoim": { cal: 588, p: 25, c: 20, f: 50, defaultPortion: "1 colher de sopa ou 15g" },
  "doce de leite": { cal: 315, p: 6, c: 56, f: 8, defaultPortion: "1 colher de sopa ou 20g" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("No PDF file provided");

    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const systemPrompt = `Você é um especialista em nutrição que extrai dados de planos alimentares em PDF.

Extraia TODAS as refeições do PDF, incluindo opções alternativas (Opção 2) como refeições separadas.

REGRAS CRÍTICAS PARA CADA ALIMENTO:
1. **portion** OBRIGATÓRIA: SEMPRE inclua a porção no formato "X [medida caseira] ou Yg" (ex: "1 unidade ou 50g", "3 colheres de sopa cheias ou 45g", "200ml"). Se o PDF não especificar, ESTIME uma porção padrão razoável.
2. **macros** OBRIGATÓRIOS: SEMPRE calcule calories, protein, carbs, fat com valores > 0 baseados na porção indicada. Use a TBCA/TACO brasileira. NUNCA deixe macros em 0.
3. **substitutes**: array com TODOS os substitutos listados no PDF, cada um com {name, portion, calories, protein, carbs, fat} - todos com valores > 0.

Referências rápidas de macros por 100g (use para estimar quando o PDF não informar):
- Arroz branco cozido: 128kcal, 2.5P, 28C, 0.2G
- Feijão cozido: 77kcal, 4.5P, 14C, 0.5G  
- Peito de frango grelhado: 159kcal, 32P, 0C, 3G
- Ovo inteiro: 143kcal, 13P, 0.7C, 9.5G (1 un = 50g)
- Banana: 89kcal, 1.1P, 22C, 0.3G (1 un = 100g)
- Aveia em flocos: 394kcal, 14P, 67C, 8G (3 col sopa = 30g)
- Whey protein: 400kcal, 80P, 8C, 4G (1 scoop = 30g)
- Batata doce: 86kcal, 1.6P, 20C, 0.1G
- Leite desnatado: 35kcal, 3.4P, 5C, 0.1G (1 copo = 200ml)
- Pão integral: 265kcal, 9P, 49C, 3.2G (1 fatia = 25g)
- Azeite: 884kcal, 0P, 0C, 100G (1 col sopa = 13ml)
- Doce de leite: 315kcal, 6P, 56C, 8G (1 col sopa = 20g)

Para refeições com "Opção 2", crie uma refeição separada com nome "NomeDaRefeição - Opção 2" e mesmo horário.

Se houver observações/notas para uma refeição, inclua no campo "notes".

Responda APENAS com JSON válido neste formato:
{
  "title": "título do plano como está no PDF",
  "goal": "deficit" | "bulking" | "manutenção" | "recomposição",
  "meals": [
    {
      "name": "Nome da Refeição",
      "time": "HH:MM",
      "notes": "observações opcionais",
      "foods": [
        {
          "name": "Nome do Alimento",
          "portion": "medida caseira ou Xg",
          "calories": 150,
          "protein": 5,
          "carbs": 30,
          "fat": 1,
          "substitutes": [
            {
              "name": "Substituto",
              "portion": "medida caseira ou Xg",
              "calories": 120,
              "protein": 4,
              "carbs": 25,
              "fat": 1
            }
          ]
        }
      ]
    }
  ]
}

VALIDAÇÃO FINAL - Antes de responder, verifique que:
✅ Todos os alimentos têm porção definida (não vazia)
✅ Todos os alimentos têm calories > 0
✅ Todos os alimentos têm pelo menos protein OU carbs OU fat > 0
✅ Substitutos também têm porção e macros > 0
Se algum valor estiver 0, ESTIME usando a TBCA/TACO`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: "application/pdf",
                data: base64,
              },
            },
            {
              text: "Extraia o plano alimentar completo deste PDF seguindo as instruções do sistema. IMPORTANTE: Todos os alimentos DEVEM ter porção definida e macros (calories, protein, carbs, fat) com valores maiores que zero. Responda APENAS com JSON válido, sem markdown.",
            },
          ],
        },
      ],
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini error:", errBody);
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    
    // Check if response was truncated
    const finishReason = geminiData?.candidates?.[0]?.finishReason;
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Gemini");

    let cleanJson = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    // Try to repair truncated JSON
    let plan: any;
    try {
      plan = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn("JSON parse failed, attempting repair. finishReason:", finishReason);
      // Try to close open structures
      let repaired = cleanJson;
      // Count open/close braces and brackets
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;
      
      // Remove trailing incomplete key-value or comma
      repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*[^,\]\}]*$/, "");
      repaired = repaired.replace(/,\s*$/, "");
      
      // Close missing brackets and braces
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
      
      try {
        plan = JSON.parse(repaired);
        console.log("JSON repaired successfully");
      } catch (repairErr) {
        console.error("JSON repair also failed:", repairErr);
        throw new Error("O PDF gerou uma resposta muito longa. Tente um PDF menor ou com menos refeições.");
      }
    }

    // === POST-PROCESSING: Fix missing macros and portions ===
    let fixedCount = 0;
    
    // Try to cross-reference with food_database
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    let dbClient: any = null;
    
    if (supabaseUrl && serviceKey) {
      dbClient = createClient(supabaseUrl, serviceKey);
    }

    if (plan.meals) {
      for (const meal of plan.meals) {
        if (!meal.foods) continue;
        for (const food of meal.foods) {
          const hasMacros = (food.calories > 0) || (food.protein > 0) || (food.carbs > 0) || (food.fat > 0);
          const hasPortion = food.portion && food.portion.trim() !== "";

          if (!hasMacros || !hasPortion) {
            // Try food_database lookup
            if (dbClient && food.name) {
              try {
                const { data: dbFoods } = await dbClient
                  .rpc("search_foods_unaccent", { search_term: food.name, max_results: 1 });
                
                if (dbFoods?.length) {
                  const dbFood = dbFoods[0];
                  if (!hasMacros) {
                    food.calories = dbFood.calories || food.calories;
                    food.protein = dbFood.protein || food.protein;
                    food.carbs = dbFood.carbs || food.carbs;
                    food.fat = dbFood.fat || food.fat;
                  }
                  if (!hasPortion) {
                    food.portion = dbFood.portion || "1 porção";
                  }
                  fixedCount++;
                  continue;
                }
              } catch (e) {
                console.warn("DB lookup failed for:", food.name, e);
              }
            }

            // Fallback: match against local reference table
            const lowerName = (food.name || "").toLowerCase();
            for (const [key, ref] of Object.entries(MACRO_REFERENCE)) {
              if (lowerName.includes(key)) {
                if (!hasPortion) {
                  food.portion = ref.defaultPortion;
                }
                if (!hasMacros) {
                  // Estimate based on default portion
                  const portionMatch = ref.defaultPortion.match(/(\d+)g/);
                  const grams = portionMatch ? parseInt(portionMatch[1]) : 100;
                  const ratio = grams / 100;
                  food.calories = Math.round(ref.cal * ratio);
                  food.protein = Math.round(ref.p * ratio);
                  food.carbs = Math.round(ref.c * ratio);
                  food.fat = Math.round(ref.f * ratio);
                }
                fixedCount++;
                break;
              }
            }
          }

          // Also fix substitutes
          if (food.substitutes) {
            for (const sub of food.substitutes) {
              const subHasMacros = (sub.calories > 0) || (sub.protein > 0) || (sub.carbs > 0) || (sub.fat > 0);
              if (!subHasMacros && dbClient) {
                try {
                  const { data: dbFoods } = await dbClient
                    .rpc("search_foods_unaccent", { search_term: sub.name, max_results: 1 });
                  if (dbFoods?.length) {
                    sub.calories = dbFoods[0].calories || sub.calories;
                    sub.protein = dbFoods[0].protein || sub.protein;
                    sub.carbs = dbFoods[0].carbs || sub.carbs;
                    sub.fat = dbFoods[0].fat || sub.fat;
                    if (!sub.portion) sub.portion = dbFoods[0].portion || "1 porção";
                  }
                } catch (_) { /* skip */ }
              }
            }
          }
        }
      }
    }

    console.log(`PDF parsed successfully. Fixed ${fixedCount} foods with missing data.`);

    return new Response(JSON.stringify({ plan, fixedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-diet-pdf error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
