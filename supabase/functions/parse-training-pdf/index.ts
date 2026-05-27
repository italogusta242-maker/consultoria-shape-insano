import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Fetch exercise library for fuzzy matching
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: exercises } = await sb
      .from("exercise_library")
      .select("id, name, muscle_group, default_sets, default_reps, gif_url");

    const exerciseNames = (exercises ?? []).map((e: any) => e.name).join("\n");

    const systemPrompt = `Você é um especialista em treinamento físico que extrai dados de planos de treino em PDF (especialmente do app MFIT).

CATÁLOGO DE EXERCÍCIOS DISPONÍVEIS (use esses nomes EXATAMENTE quando possível):
${exerciseNames}

Extraia TODOS os grupos de treino (A, B, C, etc.) do PDF.

Para cada exercício extraído:
1. Tente mapear para um exercício do catálogo acima (fuzzy match pelo nome)
2. Se encontrar correspondência, use o campo "name" exatamente como no catálogo
3. Se não encontrar, use o nome como está no PDF e marque "matched": false

Responda APENAS com JSON válido neste formato:
{
  "title": "título do plano como está no PDF",
  "groups": [
    {
      "name": "A - Peito e Tríceps",
      "exercises": [
        {
          "name": "Nome do Exercício (do catálogo se possível)",
          "sets": 4,
          "reps": "10-12",
          "rest": "1'30''",
          "matched": true,
          "notes": "observações opcionais do PDF",
          "stages": [
            { "label": "Working sets", "sets": 3, "reps": "10-12", "rest": "1'30''" }
          ]
        }
      ]
    }
  ]
}

REGRAS:
- Mantenha a ordem exata dos exercícios como no PDF
- "sets" e "reps" devem refletir o que está no PDF
- "rest" no formato minutos e segundos (ex: "1'30''", "2'00''")
- Se o PDF tiver fases (aquecimento, feeder, working, top set), inclua em "stages"
- Se não tiver fases, deixe "stages" como array vazio []
- "matched" = true se o nome bate com o catálogo, false se não encontrou correspondência`;

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
              text: "Extraia o plano de treino completo deste PDF seguindo as instruções do sistema. Responda APENAS com JSON válido, sem markdown.",
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

    // Modelos em ordem de preferência (fallback automático em caso de sobrecarga)
    const models = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];
    let geminiRes: Response | null = null;
    let lastErrorBody = "";
    let lastStatus = 0;

    outer: for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

      // Retry com backoff exponencial para erros transitórios (429/500/503)
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        });

        if (res.ok) {
          geminiRes = res;
          break outer;
        }

        lastStatus = res.status;
        lastErrorBody = await res.text();
        console.error(`Gemini ${model} attempt ${attempt + 1} failed (${res.status}):`, lastErrorBody);

        // Erros não transitórios → tenta próximo modelo direto
        if (![429, 500, 502, 503, 504].includes(res.status)) break;

        // Aguarda antes de retentar (1s, 2s, 4s)
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    if (!geminiRes) {
      const friendly =
        lastStatus === 503 || lastStatus === 429
          ? "A IA está sobrecarregada no momento. Aguarde alguns segundos e tente novamente."
          : `Erro ao processar o PDF (${lastStatus}). Tente novamente.`;
      return new Response(JSON.stringify({ error: friendly, details: lastErrorBody }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Gemini");

    let cleanJson = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let plan: any;
    try {
      plan = JSON.parse(cleanJson);
    } catch (parseErr) {
      // Try to repair truncated JSON
      let repaired = cleanJson;
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;

      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";

      plan = JSON.parse(repaired);
    }

    // Fuzzy match exercises to library
    const exerciseMap = new Map<string, any>();
    for (const ex of exercises ?? []) {
      exerciseMap.set((ex as any).name.toLowerCase(), ex);
    }

    // Dice coefficient for fuzzy matching
    function bigrams(str: string): Set<string> {
      const s = str.toLowerCase().replace(/\s+/g, " ");
      const bg = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) bg.add(s.substring(i, i + 2));
      return bg;
    }

    function dice(a: string, b: string): number {
      const bgA = bigrams(a);
      const bgB = bigrams(b);
      let intersection = 0;
      bgA.forEach((bg) => { if (bgB.has(bg)) intersection++; });
      return bgA.size + bgB.size === 0 ? 0 : (2 * intersection) / (bgA.size + bgB.size);
    }

    for (const group of plan.groups ?? []) {
      for (const ex of group.exercises ?? []) {
        // Try exact match first
        const exactMatch = exerciseMap.get(ex.name.toLowerCase());
        if (exactMatch) {
          ex.exercise_id = exactMatch.id;
          ex.gif_url = exactMatch.gif_url;
          ex.matched = true;
          continue;
        }

        // Fuzzy match
        let bestScore = 0;
        let bestMatch: any = null;
        for (const [, libEx] of exerciseMap) {
          const score = dice(ex.name, libEx.name);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = libEx;
          }
        }

        if (bestScore >= 0.55 && bestMatch) {
          ex.name = bestMatch.name;
          ex.exercise_id = bestMatch.id;
          ex.gif_url = bestMatch.gif_url;
          ex.matched = true;
        } else {
          ex.matched = false;
        }
      }
    }

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("parse-training-pdf error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
