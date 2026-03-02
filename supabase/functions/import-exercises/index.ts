import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const MUSCLE_MAP: Record<string, string> = {
  "abdominais": "abdominais",
  "abdutores": "abdutores",
  "adutores": "adutores",
  "antebracos": "antebraços",
  "biceps": "bíceps",
  "gemeos": "panturrilhas",
  "panturrilhas": "panturrilhas",
  "peito": "peito",
  "gluteos": "glúteos",
  "isquiotibiais": "posteriores",
  "dorsais": "costas",
  "lombares": "lombar",
  "meio-das-costas": "costas",
  "pescoco": "pescoço",
  "quadriceps": "quadríceps",
  "trapezios": "trapézio",
  "triceps": "tríceps",
  "ombros": "ombros",
};

function mapMuscle(m: string): string {
  const key = m.trim().toLowerCase();
  return MUSCLE_MAP[key] || key;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const fetchUrl = url.searchParams.get("url");
    
    let csvText: string;
    if (fetchUrl) {
      const resp = await fetch(fetchUrl);
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch: ${resp.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      csvText = await resp.text();
    } else {
      csvText = await req.text();
    }
    const lines = csvText.split("\n").filter(l => l.trim().length > 0);
    const dataLines = lines.slice(1); // skip header

    // Header: id,nome,categoria,nivel,equipamento,musculo_principal,musculos_secundarios,instrucoes,video_url,real_video_id,gif_url
    const results = { total: dataLines.length, inserted: 0, updated: 0, errors: 0, errorMessages: [] as string[] };
    const BATCH_SIZE = 100;

    for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
      const batch = dataLines.slice(i, i + BATCH_SIZE);
      const rows = [];

      for (const line of batch) {
        try {
          const fields = parseCSVLine(line);
          if (fields.length < 6) continue;

          const [externalId, nome, categoria, nivel, equipamento, musculoPrincipal, musculosSecundarios, instrucoes, videoUrl, realVideoId, gifUrl] = fields;

          if (!nome || nome.length < 2) continue;

          rows.push({
            external_id: externalId || null,
            name: nome,
            muscle_group: mapMuscle(musculoPrincipal || ""),
            category: categoria || null,
            level: nivel || null,
            equipment: equipamento || null,
            secondary_muscles: musculosSecundarios || null,
            instructions: instrucoes || null,
            video_id: realVideoId || null,
            gif_url: gifUrl || null,
            default_sets: 3,
            default_reps: "10",
          });
        } catch (_e) {
          results.errors++;
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from("exercise_library")
          .insert(rows);

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
