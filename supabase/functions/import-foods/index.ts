import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  "Alimentos para fins especiais": "outros",
  "Nozes e sementes": "gorduras",
  "Miscelâneas": "outros",
  "Produtos açucarados": "carboidratos",
};

function mapCategory(classe: string): string {
  const trimmed = classe.trim().toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (key.toLowerCase() === trimmed) return val;
  }
  return "outros";
}

function parseNum(val: string): number {
  if (!val || val === "-" || val === "NA" || val === "Tr" || val === "tr" || val === "*") return 0;
  const cleaned = val.replace(",", ".").replace(/[^\d.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function parseCSVLine(line: string, delimiter = ","): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authUser.id;

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    const allowedRoles = ["admin", "especialista", "nutricionista"];
    const hasPermission = roles?.some((r: any) => allowedRoles.includes(r.role));
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csvText = await req.text();
    const lines = csvText.split("\n").filter(l => l.trim().length > 0);

    // Auto-detect delimiter: if header contains ";" use semicolon
    const header = lines[0];
    const delimiter = header.includes(";") ? ";" : ",";
    const dataLines = lines.slice(1);

    const results = { total: dataLines.length, inserted: 0, errors: 0, errorMessages: [] as string[] };
    const BATCH_SIZE = 200;

    for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
      const batch = dataLines.slice(i, i + BATCH_SIZE);
      const rows = [];

      for (const line of batch) {
        try {
          const fields = parseCSVLine(line, delimiter);
          // Expected: codigo;classe;descricao;kcal;proteina_g;carboidratos_g;gorduras_g;fibras_g;sodio_mg
          if (fields.length < 7) continue;

          const [codigo, classe, descricao, kcal, proteina, carboidratos, gorduras, fibras] = fields;

          if (!descricao || descricao.length < 2) continue;

          rows.push({
            name: descricao,
            calories: parseNum(kcal),
            protein: parseNum(proteina),
            carbs: parseNum(carboidratos),
            fat: parseNum(gorduras),
            fiber: parseNum(fibras || "0"),
            category: mapCategory(classe),
            portion: "100g",
            portion_unit: "g",
            portion_amount: 1,
            portion_grams: 100,
            fonte: "TBCA",
          });
        } catch (e) {
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
