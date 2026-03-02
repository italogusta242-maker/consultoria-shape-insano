import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const specialistId = claimsData.claims.sub;

    const { student_id, goal_hint, goal_type } = await req.json();
    if (!student_id) throw new Error("student_id is required");

    // Fetch all student data in parallel
    const [
      profileRes,
      anamneseRes,
      assessmentRes,
      workoutsRes,
      checkinRes,
      flameRes,
      dietPlansRes,
      dailyHabitsRes,
      aiPrefsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("nome, peso, altura, sexo, nascimento, meta_peso, body_fat").eq("id", student_id).single(),
      supabase.from("anamnese").select("*").eq("user_id", student_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("monthly_assessments").select("*").eq("user_id", student_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("workouts").select("effort_rating, duration_seconds, started_at").eq("user_id", student_id).order("started_at", { ascending: false }).limit(20),
      supabase.from("psych_checkins").select("mood, stress, sleep_hours, sleep_quality, notes, created_at").eq("user_id", student_id).order("created_at", { ascending: false }).limit(14),
      supabase.from("flame_status").select("streak, state").eq("user_id", student_id).maybeSingle(),
      supabase.from("diet_plans").select("title, meals, goal, goal_description, created_at").eq("user_id", student_id).order("created_at", { ascending: false }).limit(2),
      supabase.from("daily_habits").select("water_liters, completed_meals, date").eq("user_id", student_id).order("date", { ascending: false }).limit(14),
      supabase.from("specialist_ai_preferences").select("*").eq("specialist_id", specialistId).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const anamnese = anamneseRes.data;
    const assessment = assessmentRes.data;
    const workouts = workoutsRes.data ?? [];
    const checkins = checkinRes.data ?? [];
    const flame = flameRes.data;
    const previousDiets = dietPlansRes.data ?? [];
    const dailyHabits = dailyHabitsRes.data ?? [];
    const aiPrefs = aiPrefsRes.data;

    // Compute analytics
    const avgMood = checkins.length > 0
      ? (checkins.reduce((s, c) => s + c.mood, 0) / checkins.length).toFixed(1)
      : "N/A";
    const avgStress = checkins.length > 0
      ? (checkins.reduce((s, c) => s + c.stress, 0) / checkins.length).toFixed(1)
      : "N/A";
    const avgSleep = checkins.filter(c => c.sleep_hours).length > 0
      ? (checkins.reduce((s, c) => s + (c.sleep_hours ?? 0), 0) / checkins.filter(c => c.sleep_hours).length).toFixed(1)
      : "N/A";
    const avgWater = dailyHabits.length > 0
      ? (dailyHabits.reduce((s, h) => s + Number(h.water_liters || 0), 0) / dailyHabits.length).toFixed(1)
      : "N/A";
    const avgMealsCompleted = dailyHabits.length > 0
      ? (dailyHabits.reduce((s, h) => s + (h.completed_meals?.length || 0), 0) / dailyHabits.length).toFixed(1)
      : "N/A";
    const streak = flame?.streak ?? 0;

    const avgEffort = workouts.length > 0
      ? (workouts.reduce((s, w) => s + (w.effort_rating ?? 0), 0) / workouts.filter(w => w.effort_rating).length).toFixed(1)
      : "N/A";

    // Caloric estimation (Harris-Benedict)
    let estimatedCalories = "N/A";
    if (profile?.peso) {
      const peso = parseFloat(profile.peso);
      const altura = parseFloat(profile.altura || "170");
      const isMale = profile.sexo !== "feminino";
      if (!isNaN(peso)) {
        const bmr = isMale
          ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * 25
          : 447.593 + 9.247 * peso + 3.098 * altura - 4.330 * 25;
        estimatedCalories = String(Math.round(bmr * 1.55));
      }
    }

    // Build specialist style context
    let specialistStyle = "";
    if (aiPrefs) {
      specialistStyle = `
## ESTILO DO ESPECIALISTA (IMITE ESTE ESTILO!)
- Filosofia: ${aiPrefs.training_philosophy || "Não definida"}
- Métodos preferidos: ${aiPrefs.preferred_methods || "Não definidos"}
- Notas adicionais: ${aiPrefs.notes || "Nenhuma"}
`;
    }

    // Build explicit forbidden foods list
    const forbiddenFoods: string[] = [];
    if (anamnese?.restricoes_alimentares && anamnese.restricoes_alimentares.trim() !== "" && anamnese.restricoes_alimentares !== "Nenhuma") {
      forbiddenFoods.push(anamnese.restricoes_alimentares);
    }
    if (assessment?.alimentos_proibidos && assessment.alimentos_proibidos.trim() !== "" && assessment.alimentos_proibidos !== "Nenhum") {
      forbiddenFoods.push(assessment.alimentos_proibidos);
    }
    if (assessment?.restricao_alimentar && assessment.restricao_alimentar.trim() !== "" && assessment.restricao_alimentar !== "Nenhuma") {
      forbiddenFoods.push(assessment.restricao_alimentar);
    }
    // Check dados_extras for additional restrictions
    if (anamnese?.dados_extras && typeof anamnese.dados_extras === "object") {
      const extras = anamnese.dados_extras as Record<string, any>;
      if (extras.alimentos_nao_come) forbiddenFoods.push(String(extras.alimentos_nao_come));
      if (extras.alimentos_proibidos) forbiddenFoods.push(String(extras.alimentos_proibidos));
      if (extras.alergias) forbiddenFoods.push(String(extras.alergias));
      if (extras.alergia_outra) forbiddenFoods.push(String(extras.alergia_outra));
      if (extras.intolerâncias) forbiddenFoods.push(String(extras.intolerâncias));
      if (extras.intolerancias) forbiddenFoods.push(String(extras.intolerancias));
    }

    const forbiddenSection = forbiddenFoods.length > 0
      ? `\n⛔ ALIMENTOS/INGREDIENTES ABSOLUTAMENTE PROIBIDOS (NUNCA USE ESTES NO PLANO):\n${forbiddenFoods.map(f => `- ${f}`).join("\n")}\n\nSe qualquer alimento listado acima aparecer no plano gerado, o plano será REJEITADO. Substitua por alternativas compatíveis.\n`
      : "";

    const systemPrompt = `Você é um nutricionista esportivo altamente qualificado.
Gere planos alimentares profissionais, detalhados e individualizados.

${specialistStyle}

REGRAS CRÍTICAS (OBEDEÇA RIGOROSAMENTE):
1. Cada refeição deve conter alimentos com quantidades em gramas (unit: "g")
2. Inclua macros calculados para cada refeição baseados nos alimentos
3. ⛔ PRIORIDADE MÁXIMA: JAMAIS inclua alimentos que o aluno informou que não come, tem alergia, intolerância ou restrição. Analise CUIDADOSAMENTE os campos de restrições alimentares, alimentos proibidos e condições de saúde. Se o aluno disse que NÃO COME um alimento, esse alimento NÃO PODE aparecer no plano em nenhuma refeição, nem como substituto.
4. Analise o estado mental (sono, estresse, humor) para ajustar o plano
5. Considere o nível de atividade física e gasto calórico
6. Respeite o objetivo calórico (déficit, bulking, manutenção, recomposição)
7. Retorne APENAS o JSON válido no formato especificado
8. Antes de finalizar, revise CADA alimento e verifique se ele viola alguma restrição listada. Se violar, SUBSTITUA.
${forbiddenSection}

FORMATO DE SAÍDA (JSON):
{
  "title": "Nome do Plano",
  "goal": "deficit|bulking|manutenção|recomposição",
  "goal_description": "Descrição detalhada do objetivo e estratégia nutricional para o aluno",
  "meals": [
    {
      "name": "Café da Manhã",
      "time": "07:00",
      "foods": [
        {
          "name": "Nome do alimento",
          "quantity": "150",
          "unit": "g",
          "substitutes": [
            {
              "name": "Alimento substituto",
              "quantity": "120",
              "unit": "g",
              "portion": "120",
              "calories": 180,
              "protein": 10,
              "carbs": 20,
              "fat": 5
            }
          ]
        }
      ],
      "notes": "Observações da refeição",
      "macros": {
        "protein": 30,
        "carbs": 40,
        "fat": 15,
        "calories": 415
      }
    }
  ]
}

Nomes de refeições devem ser: Café da Manhã, Lanche da Manhã, Almoço, Lanche da Tarde, Pré-Treino, Pós-Treino, Jantar, Ceia.`;

    const userPrompt = `Gere um plano alimentar personalizado para este aluno:

## PERFIL DO ALUNO
- Nome: ${profile?.nome || "N/A"}
- Peso: ${profile?.peso || "N/A"} | Altura: ${profile?.altura || "N/A"} | Sexo: ${profile?.sexo || "N/A"}
- Gordura corporal: ${profile?.body_fat ? profile.body_fat + "%" : "N/A"}
- Meta de peso: ${profile?.meta_peso || "N/A"}
- GET estimado: ${estimatedCalories} kcal

## ANAMNESE
- Objetivo: ${anamnese?.objetivo || "N/A"}
- Dieta atual: ${anamnese?.dieta_atual || "N/A"}
- Restrições alimentares: ${anamnese?.restricoes_alimentares || "Nenhuma"}
- Suplementos: ${anamnese?.suplementos || "Nenhum"}
- Água diária: ${anamnese?.agua_diaria || "N/A"}
- Sono: ${anamnese?.sono_horas || "N/A"}h
- Nível de estresse: ${anamnese?.nivel_estresse || "N/A"}
- Ocupação: ${anamnese?.ocupacao || "N/A"}
- Condições de saúde: ${anamnese?.condicoes_saude || "Nenhuma"}
- Medicamentos: ${anamnese?.medicamentos || "Nenhum"}

## ASSESSMENT MENSAL RECENTE
- Adesão dieta: ${assessment?.adesao_dieta || "N/A"}
- Restrição alimentar: ${assessment?.restricao_alimentar || "Nenhuma"}
- Alimentos proibidos: ${assessment?.alimentos_proibidos || "Nenhum"}
- Sugestão dieta: ${assessment?.sugestao_dieta || "N/A"}
- Refeições/horários: ${assessment?.refeicoes_horarios || "N/A"}
- Motivo não seguir dieta: ${assessment?.motivo_nao_dieta || "N/A"}

## ESTADO MENTAL (últimos 14 dias)
- Humor médio: ${avgMood}/5
- Estresse médio: ${avgStress}/5
- Sono médio: ${avgSleep}h

## HÁBITOS DIÁRIOS (últimos 14 dias)
- Água média: ${avgWater}L/dia
- Refeições completas média: ${avgMealsCompleted}/dia
- Constância (streak): ${streak} dias

## PERFORMANCE TREINOS
- Esforço médio (RPE): ${avgEffort}/10

## HISTÓRICO DE PLANOS ANTERIORES
${previousDiets.length > 0
  ? previousDiets.map(p => `- "${p.title}" | Objetivo: ${p.goal} | ${p.goal_description || "Sem descrição"} | Refeições: ${(p.meals as any[])?.length || 0}`).join("\n")
  : "Nenhum plano anterior"}

## OBJETIVO SELECIONADO: ${goal_type || "manutenção"}
${goal_hint ? `## INSTRUÇÃO ADICIONAL DO NUTRICIONISTA\n${goal_hint}` : ""}
${forbiddenFoods.length > 0 ? `\n## ⛔ LEMBRETE FINAL: NÃO INCLUA ESTES ALIMENTOS NO PLANO:\n${forbiddenFoods.map(f => `❌ ${f}`).join("\n")}\nVerifique cada alimento antes de incluir.` : ""}

Gere o plano agora. Responda APENAS com o JSON válido.`;

    // Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 32768,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData.candidates?.[0];

    if (!candidate || candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION") {
      console.error("Gemini blocked response:", JSON.stringify(candidate?.safetyRatings));
      throw new Error("A IA não conseguiu gerar o plano. Tente novamente com instruções diferentes.");
    }

    const rawText = candidate.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error("Empty Gemini response. Full payload:", JSON.stringify(geminiData).slice(0, 500));
      throw new Error("Resposta vazia da IA. Tente novamente.");
    }

    // Parse JSON with multiple strategies
    let planJson;
    try {
      planJson = JSON.parse(rawText);
    } catch {
      try {
        const cleaned = rawText.replace(/```(?:json)?\n?/g, "").replace(/```\n?/g, "").trim();
        planJson = JSON.parse(cleaned);
      } catch {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            planJson = JSON.parse(jsonMatch[0]);
          } catch {
            console.error("Failed all JSON parse attempts. Raw (first 1000 chars):", rawText.slice(0, 1000));
            throw new Error("Falha ao interpretar resposta da IA. Tente novamente.");
          }
        } else {
          console.error("No JSON object found. Raw (first 1000 chars):", rawText.slice(0, 1000));
          throw new Error("Falha ao interpretar resposta da IA. Tente novamente.");
        }
      }
    }

    return new Response(JSON.stringify({ plan: planJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-diet-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
