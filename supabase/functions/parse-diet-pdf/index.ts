import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Accept multipart form data with PDF file
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("No PDF file provided");

    // Convert to base64 for Gemini
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const systemPrompt = `Você é um especialista em nutrição que extrai dados de planos alimentares em PDF.

Extraia TODAS as refeições do PDF, incluindo opções alternativas (Opção 2) como refeições separadas.

Para cada alimento, extraia:
- name: nome do alimento
- portion: formato "X [medida caseira] ou Yg" (ex: "1 unidade ou 50g", "3 colheres de sopa cheias ou 45g")
- calories, protein, carbs, fat: macros estimados para a porção indicada (use valores padrão TBCA/TACO se não informados no PDF)
- substitutes: array com TODOS os substitutos listados no PDF, cada um com {name, portion, calories, protein, carbs, fat}

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

IMPORTANTE:
- Não invente dados que não estão no PDF
- Use valores nutricionais da TBCA/TACO brasileira para estimar macros quando o PDF não os fornecer
- Inclua TODOS os substitutos listados para cada alimento
- Porções devem incluir medida caseira E gramas quando disponíveis
- "À vontade" é uma porção válida para saladas`;

    // Call Gemini with the PDF
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
              text: "Extraia o plano alimentar completo deste PDF seguindo as instruções do sistema. Responda APENAS com JSON válido, sem markdown.",
            },
          ],
        },
      ],
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 16000,
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
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Gemini");

    // Parse JSON (strip markdown fences if present)
    const cleanJson = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const plan = JSON.parse(cleanJson);

    return new Response(JSON.stringify({ plan }), {
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
